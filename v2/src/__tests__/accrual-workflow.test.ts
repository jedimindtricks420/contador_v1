import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockGetActiveOrgId = vi.fn().mockResolvedValue("org-test");
const mockGetUser = vi.fn().mockResolvedValue({ id: "user-test" });
vi.mock("@/lib/context", () => ({
  getActiveOrgId: mockGetActiveOrgId,
  getUser: mockGetUser
}));

const mockPrisma = {
  period: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
  },
  organization: {
    findUnique: vi.fn(),
  },
  openItem: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
    deleteMany: vi.fn(),
  },
  documentType: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
  },
  document: {
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  account: {
    findUnique: vi.fn(),
  },
  journalEntry: {
    create: vi.fn(),
    findMany: vi.fn(),
  },
  auditLog: {
    create: vi.fn(),
  },
  taxCalendarEvent: {
    findFirst: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
    deleteMany: vi.fn(),
  },
  $queryRaw: vi.fn(),
  $transaction: vi.fn((cb) => cb(mockPrisma))
};

vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));

vi.mock("@/lib/closing", () => ({
  upsertTaxCalendarEventsForPeriod: vi.fn().mockResolvedValue(undefined)
}));

describe("Accrual Method Pending Invoices Route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GET returns all open items for accounts 6310/4310 in the period", async () => {
    const { GET } = await import("@/app/api/closing/[periodId]/pending-invoices/route");
    
    mockPrisma.period.findFirst.mockResolvedValue({ id: "period-test", orgId: "org-test" });
    
    const mockItems = [
      {
        id: "item-1",
        amount: 500000,
        account: { code: "6310", name: "Авансы полученные" },
        counterparty: { name: "Client A", inn: "123456789" }
      }
    ];
    mockPrisma.openItem.findMany.mockResolvedValue(mockItems);

    const req = new NextRequest("http://localhost/api/closing/period-test/pending-invoices");
    const res = await GET(req, { params: Promise.resolve({ periodId: "period-test" }) });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].id).toBe("item-1");
    expect(body[0].account.code).toBe("6310");
    expect(mockPrisma.openItem.findMany).toHaveBeenCalledWith({
      where: {
        orgId: "org-test",
        affectedPeriodId: "period-test",
        status: { in: ["OPEN", "RISK"] },
        account: { code: { in: ["6310", "4310"] } }
      },
      include: {
        counterparty: true,
        account: true,
        // тип исходного платежа нужен для подсказки suggestedReceiptKind (товары/услуги)
        openingDocument: { include: { type: { select: { code: true } } } }
      }
    });
    // для полученных авансов (6310) нет надёжного сигнала из платежа клиента —
    // дефолт "services" (сохраняет прежнее поведение, выручка на 9030), но теперь
    // это реальная подсказка, а не null: бухгалтер может явно выбрать "goods" в UI
    // и провести выручку на 9020 (см. receiptKind.ts:saleDocTypeCode).
    expect(body[0].suggestedReceiptKind).toBe("services");
  });

  it("POST manually confirms pending invoice and creates prepaid document", async () => {
    const { POST } = await import("@/app/api/closing/[periodId]/pending-invoices/route");

    mockPrisma.period.findFirst.mockResolvedValue({ id: "period-test", orgId: "org-test", year: 2026, month: 6 });
    mockPrisma.period.findUnique.mockResolvedValue({ id: "period-test", orgId: "org-test", year: 2026, month: 6, status: "OPEN", lockDate: null });
    mockPrisma.openItem.findFirst.mockResolvedValue({
      id: "item-1",
      amount: 112000,
      status: "OPEN",
      account: { code: "6310", name: "Авансы полученные" },
      counterparty: { name: "Client A", inn: "123456789" }
    });
    mockPrisma.organization.findUnique.mockResolvedValue({ id: "org-test", isVatPayer: true });
    mockPrisma.documentType.findUnique.mockResolvedValue({ id: "type-1", code: "INVOICE_CONFIRMED_PREPAID", postingTemplate: { lines: [] } });
    mockPrisma.$queryRaw.mockResolvedValue([{ status: "OPEN" }]);

    // Mock the postDocument flow internally
    mockPrisma.document.create.mockResolvedValue({ id: "doc-1", orgId: "org-test", periodId: "period-test", date: new Date(), payload: {} });
    mockPrisma.document.findUnique.mockResolvedValue({ id: "doc-1", orgId: "org-test", periodId: "period-test", type: { postingTemplate: { lines: [] } } });
    mockPrisma.account.findUnique.mockResolvedValue({ id: "acc-1", code: "6310" });
    mockPrisma.openItem.update.mockResolvedValue({ id: "item-1", status: "CLOSED" });

    const req = new NextRequest("http://localhost/api/closing/period-test/pending-invoices", {
      method: "POST",
      body: JSON.stringify({ openItemId: "item-1" })
    });

    const res = await POST(req, { params: Promise.resolve({ periodId: "period-test" }) });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.status).toBe("CLOSED");

    expect(mockPrisma.document.create).toHaveBeenCalledWith({
      data: {
        orgId: "org-test",
        periodId: "period-test",
        typeId: "type-1",
        date: expect.any(Date),
        status: "POSTED",
        payload: {
          amount: 112000,
          vatAmount: 12000, // 112000 - (112000/1.12)
          counterpartyInn: "123456789",
          counterpartyHint: "Client A"
        }
      }
    });
  });
});

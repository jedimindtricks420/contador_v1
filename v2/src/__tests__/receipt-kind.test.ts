import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import { NextRequest } from "next/server";
import { ensureBaseData } from "@/lib/ensureBaseData";
import { receiptKindFromPaymentType, receiptDocTypeCode } from "@/lib/receiptKind";

// Мастер закрытия больше не создаёт «Поступление товаров» (Дт 2910) для любого
// входящего ЭСФ: вид поступления определяется категорией исходного платежа
// (SUPPLIER_PAYMENT_SERVICES → услуга, Дт 9420) с возможностью явного выбора в UI.

let currentOrgId = "";
let currentUserId = "";
vi.mock("@/lib/context", () => ({
  getActiveOrgId: async () => currentOrgId,
  getUser: async () => ({ id: currentUserId }),
}));

const prisma = new PrismaClient();
const orgIds: string[] = [];

beforeAll(async () => {
  await ensureBaseData();
  const user = await prisma.user.create({
    data: { email: `rk_${Date.now()}@test.local`, name: "RK Test", passwordHash: "x" },
  });
  currentUserId = user.id;
}, 60_000);

afterAll(async () => {
  for (const id of orgIds) await prisma.organization.delete({ where: { id } }).catch(() => {});
  if (currentUserId) await prisma.user.delete({ where: { id: currentUserId } }).catch(() => {});
  await prisma.$disconnect();
});

describe("receiptKind — маппинг категории платежа на тип поступления", () => {
  it("категория «за услуги» даёт SERVICE_RECEIVED*, остальные — GOODS_RECEIVED*", () => {
    expect(receiptKindFromPaymentType("SUPPLIER_PAYMENT_SERVICES")).toBe("services");
    expect(receiptKindFromPaymentType("SUPPLIER_PAYMENT_GOODS")).toBe("goods");
    expect(receiptKindFromPaymentType("SUPPLIER_PAYMENT")).toBe("goods");
    expect(receiptKindFromPaymentType(null)).toBe("goods");
    expect(receiptDocTypeCode("services", true)).toBe("SERVICE_RECEIVED_PREPAID");
    expect(receiptDocTypeCode("services", false)).toBe("SERVICE_RECEIVED");
    expect(receiptDocTypeCode("goods", true)).toBe("GOODS_RECEIVED_PREPAID");
    expect(receiptDocTypeCode("goods", false)).toBe("GOODS_RECEIVED");
  });
});

describe("pending-invoices — закрытие выданного аванса", () => {
  async function setup() {
    const org = await prisma.organization.create({
      data: {
        name: `ООО RK ${orgIds.length}`,
        inn: `RK${Date.now()}${orgIds.length}`.slice(0, 20),
        taxRegime: "VAT",
        isVatPayer: true,
        members: { create: { userId: currentUserId, role: "OWNER" } },
      },
    });
    orgIds.push(org.id);
    currentOrgId = org.id;

    const period = await prisma.period.create({ data: { orgId: org.id, year: 2025, month: 4 } });

    // Платёж «за услуги»: Дт 4310 / Кт 5110 (аванс поставщику)
    const payType = await prisma.documentType.findUniqueOrThrow({ where: { code: "SUPPLIER_PAYMENT_SERVICES" } });
    const acc4310 = await prisma.account.findUniqueOrThrow({ where: { code: "4310" } });
    const acc5110 = await prisma.account.findUniqueOrThrow({ where: { code: "5110" } });
    const date = new Date(2025, 3, 10);
    const payDoc = await prisma.document.create({
      data: {
        orgId: org.id, periodId: period.id, typeId: payType.id, date, status: "POSTED",
        payload: { amount: 1_120_000 } as any,
      },
    });
    await prisma.journalEntry.createMany({
      data: [
        { documentId: payDoc.id, accountId: acc4310.id, debit: 1_120_000, credit: 0, date },
        { documentId: payDoc.id, accountId: acc5110.id, debit: 0, credit: 1_120_000, date },
      ],
    });
    const cp = await prisma.counterparty.create({ data: { orgId: org.id, name: "SOFT SUPPLIER", inn: "300000001" } });
    const openItem = await prisma.openItem.create({
      data: {
        orgId: org.id, accountId: acc4310.id, counterpartyId: cp.id,
        openingDocumentId: payDoc.id, amount: 1_120_000, dateOpened: date,
        status: "OPEN", affectedPeriodId: period.id,
      },
    });
    return { org, period, openItem };
  }

  async function confirm(periodId: string, openItemId: string, receiptKind?: string) {
    const { POST } = await import("@/app/api/closing/[periodId]/pending-invoices/route");
    const res = await POST(
      new NextRequest("http://x/api/closing/p/pending-invoices", {
        method: "POST",
        body: JSON.stringify({ openItemId, ...(receiptKind ? { receiptKind } : {}) }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ periodId }) } as any
    );
    expect(res.status).toBe(200);
  }

  async function receiptDoc(orgId: string) {
    return prisma.document.findFirstOrThrow({
      where: { orgId, type: { code: { in: ["GOODS_RECEIVED_PREPAID", "SERVICE_RECEIVED_PREPAID"] } } },
      include: { type: true, journalEntries: { include: { account: true } } },
    });
  }

  it("без явного выбора: категория «за услуги» → SERVICE_RECEIVED_PREPAID (Дт 9420)", async () => {
    const { org, period, openItem } = await setup();
    await confirm(period.id, openItem.id);

    const doc = await receiptDoc(org.id);
    expect(doc.type.code).toBe("SERVICE_RECEIVED_PREPAID");
    const debit9420 = doc.journalEntries.find(j => j.account.code === "9420" && Number(j.debit) > 0);
    expect(debit9420).toBeTruthy();
    expect(doc.journalEntries.some(j => j.account.code === "2910")).toBe(false);
    // НДС выделен на 4410: 1 120 000 × 12/112 = 120 000
    const vat = doc.journalEntries.find(j => j.account.code === "4410");
    expect(Number(vat!.debit)).toBeCloseTo(120_000, 2);
  }, 60_000);

  it("явный выбор «товары» переопределяет категорию платежа", async () => {
    const { org, period, openItem } = await setup();
    await confirm(period.id, openItem.id, "goods");

    const doc = await receiptDoc(org.id);
    expect(doc.type.code).toBe("GOODS_RECEIVED_PREPAID");
    expect(doc.journalEntries.some(j => j.account.code === "2910" && Number(j.debit) > 0)).toBe(true);
  }, 60_000);
});

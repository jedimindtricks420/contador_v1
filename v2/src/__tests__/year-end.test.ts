import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mocks must be before dynamic imports
const mockGetActiveMembership = vi.fn();
vi.mock("@/lib/context", () => ({ getActiveMembership: mockGetActiveMembership }));

const mockPrisma = {
  period: {
    findFirst: vi.fn(),
  },
  document: {
    findFirst: vi.fn(),
    create: vi.fn(),
  },
  documentType: {
    findUnique: vi.fn(),
    create: vi.fn(),
  },
  account: {
    findUnique: vi.fn(),
  },
  journalEntry: {
    createMany: vi.fn(),
  },
  $queryRaw: vi.fn(),
  $executeRaw: vi.fn(),
  $transaction: vi.fn(),
  auditLog: { create: vi.fn() },
};
vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));

describe("POST /api/closing/year-end", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockGetActiveMembership.mockResolvedValue({ orgId: "org-1", userId: "user-1", role: "OWNER" });
    mockPrisma.$transaction.mockImplementation(async (callback) => callback(mockPrisma));
  });

  it("returns 404 when period not found", async () => {
    mockPrisma.period.findFirst.mockResolvedValue(null);

    const { POST } = await import("@/app/api/closing/year-end/route");
    const req = new NextRequest("http://localhost/api/closing/year-end", {
      method: "POST",
      body: JSON.stringify({ periodId: "period-1" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/не найден/);
  });

  it("returns 400 when period is not December", async () => {
    mockPrisma.period.findFirst.mockResolvedValue({
      id: "period-1",
      orgId: "org-1",
      month: 6,
      year: 2024,
      status: "CLOSED",
    });

    const { POST } = await import("@/app/api/closing/year-end/route");
    const req = new NextRequest("http://localhost/api/closing/year-end", {
      method: "POST",
      body: JSON.stringify({ periodId: "period-1" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/декабр/);
  });

  it("returns 400 when period is not CLOSED", async () => {
    mockPrisma.period.findFirst.mockResolvedValue({
      id: "period-1",
      orgId: "org-1",
      month: 12,
      year: 2024,
      status: "OPEN",
    });

    const { POST } = await import("@/app/api/closing/year-end/route");
    const req = new NextRequest("http://localhost/api/closing/year-end", {
      method: "POST",
      body: JSON.stringify({ periodId: "period-1" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/закрыт/);
  });

  it("returns 409 when year-end close already exists (idempotency)", async () => {
    mockPrisma.period.findFirst.mockResolvedValue({
      id: "period-1",
      orgId: "org-1",
      month: 12,
      year: 2024,
      status: "CLOSED",
    });
    mockPrisma.document.findFirst.mockResolvedValue({
      id: "doc-existing",
      typeId: "year-end-type",
      status: "POSTED",
    });

    const { POST } = await import("@/app/api/closing/year-end/route");
    const req = new NextRequest("http://localhost/api/closing/year-end", {
      method: "POST",
      body: JSON.stringify({ periodId: "period-1" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/уже выполнено/);
  });

  it.each(["DRAFT", "VOIDED"])("blocks %s year-end sources without claiming successful completion", async status => {
    mockPrisma.period.findFirst.mockResolvedValue({ id: "period-1", month: 12, year: 2026, status: "CLOSED" });
    mockPrisma.document.findFirst.mockResolvedValue({ id: "existing", status });
    const { POST } = await import("@/app/api/closing/year-end/route");
    const response = await POST(new NextRequest("http://localhost/api/closing/year-end", {
      method: "POST", body: JSON.stringify({ periodId: "period-1" }),
    }));
    expect(response.status).toBe(409);
    expect((await response.json()).code).toBe("YEAR_END_REQUIRES_REVIEW");
    expect(mockPrisma.document.create).not.toHaveBeenCalled();
    expect(mockPrisma.journalEntry.createMany).not.toHaveBeenCalled();
    expect(mockPrisma.auditLog.create).not.toHaveBeenCalled();
  });

  it("returns 200 with transferred=0 when 9910 balance is zero", async () => {
    mockPrisma.period.findFirst.mockResolvedValue({
      id: "period-1",
      orgId: "org-1",
      month: 12,
      year: 2024,
      status: "CLOSED",
    });
    mockPrisma.document.findFirst.mockResolvedValue(null);
    mockPrisma.$queryRaw.mockResolvedValue([{ net: "0" }]);

    const { POST } = await import("@/app/api/closing/year-end/route");
    const req = new NextRequest("http://localhost/api/closing/year-end", {
      method: "POST",
      body: JSON.stringify({ periodId: "period-1" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.transferred).toBe(0);
  });

  it.each(["VIEWER", "REMOVED"])("rejects %s before accessing accounting data", async (role) => {
    mockGetActiveMembership.mockResolvedValue({ orgId: "org-1", userId: "user-1", role });
    const { POST } = await import("@/app/api/closing/year-end/route");
    const response = await POST(new NextRequest("http://localhost/api/closing/year-end", {
      method: "POST", body: JSON.stringify({ periodId: "period-1" }),
    }));
    expect(response.status).toBe(403);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("locks before reading the period and writes the dated transfer with its actor", async () => {
    mockPrisma.period.findFirst.mockResolvedValue({ id: "period-1", month: 12, year: 2026, status: "CLOSED" });
    mockPrisma.document.findFirst.mockResolvedValue(null);
    mockPrisma.$queryRaw.mockResolvedValue([{ net: "123.45" }]);
    mockPrisma.account.findUnique.mockImplementation(async ({ where }) => ({ id: where.code }));
    mockPrisma.documentType.findUnique.mockResolvedValue({ id: "year-end-type" });
    mockPrisma.document.create.mockResolvedValue({ id: "year-end-doc" });
    const { POST } = await import("@/app/api/closing/year-end/route");
    expect((await POST(new NextRequest("http://localhost/api/closing/year-end", {
      method: "POST", body: JSON.stringify({ periodId: "period-1" }),
    }))).status).toBe(200);
    expect(mockPrisma.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(mockPrisma.period.findFirst.mock.invocationCallOrder[0]);
    expect(mockPrisma.$queryRaw.mock.calls[1].slice(1)).toEqual([
      "org-1", new Date("2025-12-31T19:00:00Z"), new Date("2026-12-31T19:00:00Z"),
    ]);
    expect(mockPrisma.document.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      date: new Date("2026-12-31T18:59:59.999Z"), payload: { type: "year_end_close", year: 2026, net9910: "123.45" },
    }) });
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({ userId: "user-1" }) });
  });
});

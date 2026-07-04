/**
 * Regression tests for the counterparty clarification flow added to fix two things:
 *
 * 1. The old "save as rule?" modal is replaced by a modal listing every other
 *    transaction from the same counterparty (unclassified first, then classified),
 *    so several can be clarified in one go — GET /api/transactions/by-counterparty.
 * 2. POST /api/clarification/answer now accepts an empty transactionIds array when
 *    createRule is true (so ticking "save rule" with nothing else selected still
 *    works), returns the created/existing ruleId, and — together with the category
 *    route — locks the StagedTransaction row before creating a Document so two
 *    concurrent requests for the same transaction can't both post a duplicate.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockGetActiveOrgId = vi.fn().mockResolvedValue("org-1");
const mockGetActiveMembership = vi.fn().mockResolvedValue({ orgId: "org-1", userId: "user-1", role: "OWNER" });
vi.mock("@/lib/context", () => ({
  getActiveOrgId: mockGetActiveOrgId,
  getActiveMembership: mockGetActiveMembership,
}));

vi.mock("@/lib/classification/rulesEngine", () => ({ clearRulesCache: vi.fn() }));
vi.mock("@/lib/posting/postingEngine", () => ({
  postDocument: vi.fn().mockResolvedValue(undefined),
  repostDocument: vi.fn().mockResolvedValue(undefined),
}));

const mockPrisma: any = {
  stagedTransaction: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  documentType: { findUnique: vi.fn() },
  document: { create: vi.fn(), findUnique: vi.fn() },
  rule: { findFirst: vi.fn(), create: vi.fn() },
  period: { findUnique: vi.fn() },
  $queryRaw: vi.fn(),
  $transaction: vi.fn(async (fn: any) => fn(mockPrisma)),
};
vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));

function stagedTx(overrides: Partial<Record<string, any>> = {}) {
  return {
    id: "tx-1",
    orgId: "org-1",
    bankAccountId: "acc-1",
    periodId: "period-1",
    date: new Date("2026-04-06"),
    amount: "1000000",
    direction: "CREDIT",
    description: "test",
    counterpartyHint: "ООО Ромашка",
    counterpartyInn: "123456789",
    status: "IMPORTED",
    documentId: null,
    ...overrides,
  };
}

describe("GET /api/transactions/by-counterparty", () => {
  beforeEach(() => vi.clearAllMocks());

  it("puts unclassified transactions first (most recent first), classified ones after", async () => {
    mockPrisma.stagedTransaction.findMany.mockResolvedValue([
      { ...stagedTx({ id: "old-unclassified", date: new Date("2026-04-01"), status: "IMPORTED" }), document: null },
      { ...stagedTx({ id: "posted", date: new Date("2026-04-09"), status: "POSTED" }), document: { type: { id: "cat-1", name: "Комиссия банка" } } },
      { ...stagedTx({ id: "recent-unclassified", date: new Date("2026-04-08"), status: "NEEDS_CLARIFICATION" }), document: null },
      { ...stagedTx({ id: "skipped", date: new Date("2026-04-10"), status: "SKIPPED" }), document: null },
    ]);

    const { GET } = await import("@/app/api/transactions/by-counterparty/route");
    const req = new NextRequest("http://localhost/api/transactions/by-counterparty?inn=123456789&direction=CREDIT");
    const res = await GET(req);
    const data = await res.json();

    expect(data.transactions.map((t: any) => t.id)).toEqual([
      "recent-unclassified", // unclassified, newest first
      "old-unclassified",
      "posted",              // classified
      "skipped",             // skipped, last
    ]);
    expect(data.transactions.find((t: any) => t.id === "posted").categoryName).toBe("Комиссия банка");
    expect(data.transactions.find((t: any) => t.id === "recent-unclassified").selectable).toBe(true);
    expect(data.transactions.find((t: any) => t.id === "posted").selectable).toBe(false);
  });

  it("matches by INN when provided, ignoring hint", async () => {
    mockPrisma.stagedTransaction.findMany.mockResolvedValue([]);
    const { GET } = await import("@/app/api/transactions/by-counterparty/route");
    const req = new NextRequest("http://localhost/api/transactions/by-counterparty?inn=123456789&hint=ignored&direction=CREDIT");
    await GET(req);

    const whereArg = mockPrisma.stagedTransaction.findMany.mock.calls[0][0].where;
    expect(whereArg.counterpartyInn).toBe("123456789");
    expect(whereArg.counterpartyHint).toBeUndefined();
  });

  it("falls back to counterpartyHint (case-insensitive) when no INN is given", async () => {
    mockPrisma.stagedTransaction.findMany.mockResolvedValue([]);
    const { GET } = await import("@/app/api/transactions/by-counterparty/route");
    const req = new NextRequest("http://localhost/api/transactions/by-counterparty?hint=ООО%20Ромашка&direction=DEBIT");
    await GET(req);

    const whereArg = mockPrisma.stagedTransaction.findMany.mock.calls[0][0].where;
    expect(whereArg.counterpartyHint).toEqual({ equals: "ООО Ромашка", mode: "insensitive" });
    expect(whereArg.direction).toBe("DEBIT");
  });

  it("returns an empty list without querying when neither inn nor hint is given", async () => {
    const { GET } = await import("@/app/api/transactions/by-counterparty/route");
    const req = new NextRequest("http://localhost/api/transactions/by-counterparty");
    const res = await GET(req);
    const data = await res.json();
    expect(data.transactions).toEqual([]);
    expect(mockPrisma.stagedTransaction.findMany).not.toHaveBeenCalled();
  });
});

describe("POST /api/clarification/answer", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects when both transactionIds and createRule are absent", async () => {
    mockPrisma.documentType.findUnique.mockResolvedValue({ id: "cat-1" });
    const { POST } = await import("@/app/api/clarification/answer/route");
    const req = new NextRequest("http://localhost/api/clarification/answer", {
      method: "POST",
      body: JSON.stringify({ documentTypeId: "cat-1", transactionIds: [] }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("allows an empty transactionIds array when createRule is true (save-rule-only case)", async () => {
    mockPrisma.documentType.findUnique.mockResolvedValue({ id: "cat-1" });
    mockPrisma.rule.findFirst.mockResolvedValue(null);
    mockPrisma.rule.create.mockResolvedValue({ id: "new-rule-1" });

    const { POST } = await import("@/app/api/clarification/answer/route");
    const req = new NextRequest("http://localhost/api/clarification/answer", {
      method: "POST",
      body: JSON.stringify({
        documentTypeId: "cat-1",
        transactionIds: [],
        createRule: true,
        ruleMatchType: "INN",
        ruleMatchValue: "123456789",
      }),
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.classified).toBe(0);
    expect(data.ruleCreated).toBe(true);
    expect(data.ruleId).toBe("new-rule-1");
  });

  it("skips a transaction whose row lock shows a documentId already set (race-safe)", async () => {
    mockPrisma.documentType.findUnique.mockResolvedValue({ id: "cat-1" });
    mockPrisma.stagedTransaction.findFirst.mockResolvedValue(stagedTx({ id: "tx-race", documentId: null }));
    // Simulate a concurrent request having already attached a document by the
    // time this one acquires the row lock.
    mockPrisma.$queryRaw.mockResolvedValue([{ documentId: "already-created-doc" }]);

    const { POST } = await import("@/app/api/clarification/answer/route");
    const req = new NextRequest("http://localhost/api/clarification/answer", {
      method: "POST",
      body: JSON.stringify({ documentTypeId: "cat-1", transactionIds: ["tx-race"] }),
    });
    const res = await POST(req);
    const data = await res.json();

    expect(data.classified).toBe(0);
    expect(mockPrisma.document.create).not.toHaveBeenCalled();
  });

  it("classifies unlocked transactions and returns the existing ruleId when a rule already exists", async () => {
    mockPrisma.documentType.findUnique.mockResolvedValue({ id: "cat-1" });
    mockPrisma.stagedTransaction.findFirst.mockResolvedValue(stagedTx({ id: "tx-2", documentId: null }));
    mockPrisma.$queryRaw.mockResolvedValue([{ documentId: null }]);
    mockPrisma.document.create.mockResolvedValue({ id: "doc-2" });
    mockPrisma.rule.findFirst.mockResolvedValue({ id: "existing-rule" });

    const { POST } = await import("@/app/api/clarification/answer/route");
    const req = new NextRequest("http://localhost/api/clarification/answer", {
      method: "POST",
      body: JSON.stringify({
        documentTypeId: "cat-1",
        transactionIds: ["tx-2"],
        createRule: true,
        ruleMatchType: "INN",
        ruleMatchValue: "123456789",
      }),
    });
    const res = await POST(req);
    const data = await res.json();

    expect(data.classified).toBe(1);
    expect(data.ruleCreated).toBe(false);
    expect(data.ruleId).toBe("existing-rule");
    expect(mockPrisma.rule.create).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/transactions/[id]/category — race guard", () => {
  beforeEach(() => vi.clearAllMocks());

  it("reposts instead of creating a second document when a concurrent request already attached one", async () => {
    mockPrisma.stagedTransaction.findFirst.mockResolvedValue(stagedTx({ id: "tx-3", documentId: null }));
    mockPrisma.period.findUnique.mockResolvedValue({ id: "period-1", status: "OPEN", lockDate: null });
    mockPrisma.documentType.findUnique.mockResolvedValue({ id: "cat-1" });
    // The row lock reveals a documentId was set by another request in the meantime.
    mockPrisma.$queryRaw.mockResolvedValue([{ documentId: "winner-doc" }]);
    mockPrisma.document.findUnique.mockResolvedValue({ id: "winner-doc", type: { id: "cat-1", name: "Test" } });
    mockPrisma.stagedTransaction.update.mockResolvedValue({ id: "tx-3", status: "CONFIRMED", documentId: "winner-doc" });

    const { repostDocument } = await import("@/lib/posting/postingEngine");
    const { PATCH } = await import("@/app/api/transactions/[id]/category/route");
    const req = new NextRequest("http://localhost/api/transactions/tx-3/category", {
      method: "PATCH",
      body: JSON.stringify({ documentTypeId: "cat-1" }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: "tx-3" }) });

    expect(res.status).toBe(200);
    expect(repostDocument).toHaveBeenCalledWith("winner-doc", "cat-1", expect.anything(), "user-1");
    expect(mockPrisma.document.create).not.toHaveBeenCalled();
  });
});

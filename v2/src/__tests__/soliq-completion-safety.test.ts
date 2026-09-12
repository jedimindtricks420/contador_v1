import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/closing/[periodId]/step/[stepNumber]/complete/route";
import { createHash } from "node:crypto";
import { buildSoliqRows, soliqControlTotals } from "@/lib/soliqBatch";

const mocks = vi.hoisted(() => {
  const tx = {
    $queryRaw: vi.fn(), $executeRaw: vi.fn(), period: { findFirst: vi.fn() },
    documentType: { findUnique: vi.fn(), create: vi.fn(), findMany: vi.fn() },
    document: { findFirst: vi.fn(), create: vi.fn(), findMany: vi.fn() },
    soliqImportBatch: { findFirst: vi.fn(), updateMany: vi.fn() },
    openItem: { findFirst: vi.fn(), updateMany: vi.fn() },
  };
  return {
    tx, transaction: vi.fn(), period: vi.fn(), membership: vi.fn(),
    save: vi.fn(), get: vi.fn(), post: vi.fn(),
  };
});
vi.mock("@/lib/context", () => ({ getActiveMembership: mocks.membership }));
vi.mock("@/lib/closing", () => ({ saveClosingState: mocks.save, getClosingState: mocks.get }));
vi.mock("@/lib/posting/postingEngine", () => ({ postDocument: mocks.post }));
vi.mock("@/lib/prisma", () => ({ default: { period: { findFirst: mocks.period }, $transaction: mocks.transaction } }));

const batchId = "ab77abb4-1b67-4b42-bc01-8a1b35239715";
function submit(stepNumber = "6", esfItems: any[] = [], extra: Record<string, unknown> = {}) {
  const rows = buildSoliqRows(esfItems.map(item => ({ ...item, date: new Date(item.date) })), { year: 2026, month: 9 });
  mocks.tx.soliqImportBatch.findFirst.mockResolvedValue({
    id: batchId, status: "READY", rows, totals: soliqControlTotals(rows), parserVersion: "soliq-v1",
    sourceData: Buffer.from("source"), sourceHash: createHash("sha256").update("source").digest("hex"),
  });
  return POST(new NextRequest("http://localhost/api/closing/period/step/6/complete", {
    method: "POST", body: JSON.stringify({ batchId, decisions: esfItems.map((item, index) => ({
      rowId: String(index + 1), openItemId: item.matchedOpenItemId ?? null,
      ...(item.expenseMatch ? { expenseMatch: true } : {}),
    })), ...extra }),
  }), { params: Promise.resolve({ periodId: "period-safe", stepNumber }) });
}

describe("Soliq completion period protection", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.membership.mockResolvedValue({ orgId: "org-safe", userId: "user-safe", role: "ACCOUNTANT" });
    const period = { id: "period-safe", orgId: "org-safe", status: "OPEN", lockDate: null, year: 2026, month: 9 };
    mocks.period.mockResolvedValue(period);
    mocks.tx.period.findFirst.mockResolvedValue(period);
    mocks.tx.document.findFirst.mockResolvedValue(null);
    mocks.tx.documentType.findUnique.mockResolvedValue({ id: "soliq-type" });
    mocks.tx.documentType.findMany.mockResolvedValue([]);
    mocks.tx.document.create.mockImplementation(async ({ data }) => ({ id: "generated-doc", ...data }));
    mocks.tx.document.findMany.mockImplementation(async () => mocks.tx.document.create.mock.calls
      .filter(([args]) => args.data.payload.soliqRowId)
      .map(([args]) => ({ id: "generated-doc", payload: args.data.payload, status: "POSTED", type: { code: "INVOICE_CONFIRMED_PREPAID" },
        journalEntries: [
          { account: { code: "6310" }, debit: args.data.payload.amount, credit: "0" },
          { account: { code: "9030" }, debit: "0", credit: args.data.payload.amount },
        ],
      })));
    mocks.tx.soliqImportBatch.updateMany.mockResolvedValue({ count: 1 });
    mocks.transaction.mockImplementation(async (callback) => callback(mocks.tx));
    mocks.get.mockResolvedValue({});
  });

  it.each([
    { label: "closed", period: { status: "CLOSED", lockDate: null } },
    { label: "locked", period: { status: "OPEN", lockDate: new Date() } },
    { label: "inaccessible", period: null },
  ])("rejects a period that became $label before the transaction", async ({ period }) => {
    mocks.tx.period.findFirst.mockResolvedValue(period);
    const response = await submit();
    expect(response.status).toBe(500);
    expect((await response.json()).error).toMatch(/Период закрыт, заблокирован или недоступен/);
    expect(mocks.tx.$queryRaw.mock.calls[0][0].join("?")).toContain("FOR NO KEY UPDATE");
    expect(mocks.tx.period.findFirst).toHaveBeenCalledWith({ where: { id: "period-safe", orgId: "org-safe" } });
    expect(mocks.tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(mocks.tx.period.findFirst.mock.invocationCallOrder[0]);
    expect(mocks.tx.documentType.create).not.toHaveBeenCalled();
    expect(mocks.tx.document.create).not.toHaveBeenCalled();
    expect(mocks.post).not.toHaveBeenCalled();
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it("takes the period lock before the import lock and creates metadata within the transaction", async () => {
    mocks.tx.documentType.findUnique.mockResolvedValue(null);
    mocks.tx.documentType.create.mockResolvedValue({ id: "soliq-type" });
    expect((await submit()).status).toBe(200);
    expect(mocks.tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(mocks.tx.$executeRaw.mock.invocationCallOrder[0]);
    expect(mocks.tx.documentType.create).toHaveBeenCalledOnce();
    expect(mocks.tx.document.findFirst).toHaveBeenCalledWith({
      where: { orgId: "org-safe", periodId: "period-safe", type: { code: "SOLIQ_IMPORT" } },
    });
    expect(mocks.save).toHaveBeenCalledExactlyOnceWith("period-safe", {
      currentStep: 7, soliqMatched: { matched: 0, unmatched: 0 },
    }, "org-safe", mocks.tx);
  });

  it("propagates wizard save failure out of the import transaction", async () => {
    mocks.save.mockRejectedValue(new Error("injected state write failure"));
    expect((await submit()).status).toBe(500);
    await expect(mocks.transaction.mock.results[0].value).rejects.toThrow("injected state write failure");
    expect(mocks.get).not.toHaveBeenCalled();
  });

  it.each(["OWNER", "ADMIN", "ACCOUNTANT"])("allows accounting role %s", async (role) => {
    mocks.membership.mockResolvedValue({ orgId: "org-safe", userId: "user-safe", role });
    expect((await submit()).status).toBe(200);
  });

  it("rejects a non-writing role before any accounting access", async () => {
    mocks.membership.mockResolvedValue({ orgId: "org-safe", role: "VIEWER" });
    expect((await submit()).status).toBe(403);
    expect(mocks.period).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it.each([["UNAUTHORIZED", 401], ["FORBIDDEN", 403], ["NO_ACTIVE_ORG", 403]])("maps %s without writes", async (error, status) => {
    mocks.membership.mockRejectedValue(new Error(String(error)));
    expect((await submit()).status).toBe(status);
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it.each(["6garbage", "6.5", "06", "0", "9", ""])("rejects invalid step %s", async (step) => {
    expect((await submit(step)).status).toBe(400);
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.save).not.toHaveBeenCalled();
  });

  const invoice = {
    amount: 100, vatAmount: 0, inn: "111111111", counterpartyName: "Synthetic",
    direction: "REVENUE", matchStatus: "MATCHED", matchedOpenItemId: "advance",
    matchedAccountCode: "6310", date: "2026-09-10T00:00:00Z",
  };
  const advance = {
    id: "advance", orgId: "org-safe", amount: "100", status: "OPEN", closingDocumentId: null,
    dateOpened: new Date("2026-09-01T00:00:00Z"), account: { code: "6310" },
    counterpartyId: "counterparty-safe", counterparty: { orgId: "org-safe", inn: "111111111" },
    openingDocument: { orgId: "org-safe", status: "POSTED" },
  };

  it.each([
    { label: "already closed", patch: { status: "CLOSED" } },
    { label: "different INN", patch: { counterparty: { orgId: "org-safe", inn: "222222222" } } },
    { label: "different account", patch: { account: { code: "4310" } } },
    { label: "different amount", patch: { amount: "99.99" } },
    { label: "future advance", patch: { dateOpened: new Date("2026-10-01T00:00:00Z") } },
    { label: "voided source", patch: { openingDocument: { orgId: "org-safe", status: "VOIDED" } } },
    { label: "foreign counterparty", patch: { counterparty: { orgId: "foreign", inn: "111111111" } } },
  ])("refuses matched advance with $label", async ({ patch }) => {
    mocks.tx.openItem.findFirst.mockResolvedValue({ ...advance, ...patch });
    const response = await submit("6", [invoice]);
    expect(response.status).toBe(400);
    expect(mocks.post).not.toHaveBeenCalled();
    expect(mocks.tx.openItem.updateMany).not.toHaveBeenCalled();
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it("refuses unreserved bank transaction matching", async () => {
    expect((await submit("6", [{ ...invoice, expenseMatch: true, direction: "EXPENSE" }])).status).toBe(400);
    expect(mocks.post).not.toHaveBeenCalled();
  });

  it("rejects the former client financial payload before starting a transaction", async () => {
    expect((await submit("6", [], { parsedPayload: { esfItems: [] } })).status).toBe(400);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("rejects a missing or already posted tenant-scoped batch", async () => {
    mocks.tx.soliqImportBatch.findFirst.mockResolvedValueOnce(null);
    expect((await submit()).status).toBe(400);
    expect(mocks.tx.document.create).not.toHaveBeenCalled();
    expect(mocks.tx.soliqImportBatch.findFirst).toHaveBeenCalledWith({ where: { id: batchId, orgId: "org-safe", periodId: "period-safe" } });
  });

  it("refuses skipping a previously uploaded batch before saving progress", async () => {
    expect((await submit("6", [], { batchId: undefined, decisions: undefined, skip: true })).status).toBe(400);
    expect(mocks.save).not.toHaveBeenCalled();
    expect(mocks.tx.soliqImportBatch.findFirst).toHaveBeenCalledWith({
      where: { orgId: "org-safe", periodId: "period-safe", status: { in: ["READY", "POSTED"] } }, select: { id: true },
    });
  });

  it("refuses skipping a legacy import marker without a batch", async () => {
    mocks.tx.soliqImportBatch.findFirst.mockResolvedValueOnce(null);
    mocks.tx.document.findFirst.mockResolvedValue({ id: "legacy-marker" });
    expect((await submit("6", [], { batchId: undefined, decisions: undefined, skip: true })).status).toBe(400);
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it("saves skip inside the period transaction only when no import exists", async () => {
    mocks.tx.soliqImportBatch.findFirst.mockResolvedValueOnce(null);
    expect((await submit("6", [], { batchId: undefined, decisions: undefined, skip: true })).status).toBe(200);
    expect(mocks.save).toHaveBeenCalledWith("period-safe", {
      currentStep: 7, soliqMatched: { matched: 0, unmatched: 0, skipped: true },
    }, "org-safe", mocks.tx);
  });

  it("rejects corrupted control totals before creating documents", async () => {
    mocks.tx.soliqImportBatch.findFirst.mockResolvedValueOnce({
      status: "READY", rows: [], totals: { rowCount: 99 }, parserVersion: "soliq-v1",
      sourceData: Buffer.from("source"), sourceHash: createHash("sha256").update("source").digest("hex"),
    });
    expect((await submit()).status).toBe(400);
    expect(mocks.tx.document.create).not.toHaveBeenCalled();
  });

  it.each(["OPEN", "RISK"])("accepts an exact %s advance and records the real actor", async (status) => {
    mocks.tx.openItem.findFirst.mockResolvedValue({ ...advance, status });
    mocks.tx.documentType.findMany.mockResolvedValue([{ id: "invoice-type", code: "INVOICE_CONFIRMED_PREPAID" }]);
    mocks.tx.openItem.updateMany.mockResolvedValue({ count: 1 });
    expect((await submit("6", [invoice])).status).toBe(200);
    expect(mocks.post).toHaveBeenCalledWith("generated-doc", mocks.tx, "user-safe");
    expect(mocks.save).toHaveBeenCalledWith("period-safe", {
      currentStep: 7, soliqMatched: { matched: 1, unmatched: 0 },
    }, "org-safe", mocks.tx);
  });
});
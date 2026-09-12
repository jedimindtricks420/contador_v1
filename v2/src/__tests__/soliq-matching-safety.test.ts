import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/import/soliq/route";
import { createHash } from "node:crypto";
import { buildSoliqRows, soliqControlTotals } from "@/lib/soliqBatch";

const mocks = vi.hoisted(() => ({
  membership: vi.fn(), parse: vi.fn(), period: vi.fn(), openItems: vi.fn(),
  query: vi.fn(), existing: vi.fn(), create: vi.fn(), transaction: vi.fn(),
  marker: vi.fn(), posted: vi.fn(),
}));
vi.mock("@/lib/context", () => ({ getActiveMembership: mocks.membership }));
vi.mock("@/lib/parsers/parserSoliq", async importOriginal => ({
  ...await importOriginal<typeof import("@/lib/parsers/parserSoliq")>(), parseSoliqExcel: mocks.parse,
}));
vi.mock("@/lib/prisma", () => ({ default: {
  period: { findFirst: mocks.period }, openItem: { findMany: mocks.openItems }, $transaction: mocks.transaction,
} }));

const invoice = {
  date: new Date("2026-09-10T00:00:00Z"), inn: "111111111", counterpartyName: "Example",
  amount: 100, vatAmount: 0, direction: "REVENUE",
};
const advance = {
  id: "advance", status: "OPEN", amount: "100", dateOpened: new Date("2026-09-01T00:00:00Z"),
  closingDocumentId: null, counterparty: { orgId: "org-safe", inn: "111111111", name: "Example" },
  account: { code: "6310" }, openingDocument: { orgId: "org-safe", status: "POSTED" },
};
function submit() {
  const body = new FormData();
  body.set("file", new File(["synthetic"], "synthetic.xlsx"));
  body.set("periodId", "period-safe");
  return POST(new NextRequest("http://localhost/v2/api/import/soliq", { method: "POST", body }));
}

describe("server-owned Soliq upload and exact matching", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.membership.mockResolvedValue({ orgId: "org-safe", userId: "user-safe", role: "ACCOUNTANT" });
    mocks.period.mockResolvedValue({ id: "period-safe", orgId: "org-safe", year: 2026, month: 9, status: "OPEN", lockDate: null });
    mocks.parse.mockReturnValue({ esfItems: [invoice], templateRecognized: true });
    mocks.openItems.mockResolvedValue([advance]);
    mocks.existing.mockResolvedValue(null);
    mocks.marker.mockResolvedValue(null);
    mocks.posted.mockResolvedValue(null);
    mocks.create.mockImplementation(async ({ data }) => ({ ...data, id: "batch-safe", status: "READY" }));
    mocks.transaction.mockImplementation(callback => callback({
      $queryRaw: mocks.query, period: { findFirst: mocks.period },
      document: { findFirst: mocks.marker },
      soliqImportBatch: { findUnique: mocks.existing, create: mocks.create, findFirst: mocks.posted },
    }));
  });

  it("stores the original file and exact rows and returns a batch id", async () => {
    const response = await submit();
    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.batchId).toBe("batch-safe");
    expect(result.parsedPayload).toBeUndefined();
    expect(result.esfItems[0]).toMatchObject({ rowId: "1", matchStatus: "MATCHED", matchedOpenItemId: "advance" });
    expect(mocks.create.mock.calls[0][0].data).toMatchObject({ orgId: "org-safe", periodId: "period-safe", createdBy: "user-safe", sourceData: Buffer.from("synthetic"), rows: [{ amount: "100.00", vatAmount: "0.00" }] });
    expect(result.sourceHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it.each([
    { counterparty: { orgId: "org-safe", inn: "222222222", name: "Example" } },
    { counterparty: { orgId: "org-safe", inn: "", name: "Example" } },
    { counterparty: { orgId: "foreign", inn: "111111111", name: "Example" } },
    { account: { code: "4310" } }, { amount: "99.99" }, { status: "CLOSED" },
    { dateOpened: new Date("2026-10-01T00:00:00Z") },
    { openingDocument: { orgId: "org-safe", status: "VOIDED" } },
  ])("does not auto-match an incompatible advance %j", async patch => {
    mocks.openItems.mockResolvedValue([{ ...advance, ...patch }]);
    const response = await submit();
    expect(response.status).toBe(200);
    expect((await response.json()).matched).toBe(0);
  });

  it("leaves equal advances for explicit user choice", async () => {
    mocks.openItems.mockResolvedValue([advance, { ...advance, id: "another" }]);
    expect((await (await submit()).json()).esfItems[0].matchReason).toBe("AMBIGUOUS_ADVANCES");
  });

  it.each([{ inn: "" }, { date: new Date("2026-10-01") }])("rejects invalid invoice before storing a batch %j", async patch => {
    mocks.parse.mockReturnValue({ esfItems: [{ ...invoice, ...patch }], templateRecognized: true });
    expect((await submit()).status).toBe(400);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("stores a recognized empty batch with zero control totals", async () => {
    mocks.parse.mockReturnValue({ esfItems: [], templateRecognized: true });
    expect(await (await submit()).json()).toMatchObject({ batchId: "batch-safe", empty: true, totals: { rowCount: 0, gross: "0.00" } });
  });

  it("reuses only an unposted batch for the same source hash", async () => {
    const rows = buildSoliqRows([{
      ...invoice, direction: "REVENUE", amount: 200,
    }], { year: 2026, month: 9 });
    mocks.existing.mockResolvedValue({
      id: "existing", status: "READY", rows, totals: soliqControlTotals(rows), parserVersion: "soliq-v1",
      sourceData: Buffer.from("synthetic"), sourceHash: createHash("sha256").update("synthetic").digest("hex"),
    });
    const result = await (await submit()).json();
    expect(result.batchId).toBe("existing");
    expect(result.esfItems[0].amount).toBe(200);
    expect(result.totals.gross).toBe("200.00");
    expect(mocks.create).not.toHaveBeenCalled();
    mocks.existing.mockResolvedValue({ id: "existing", status: "POSTED" });
    expect((await submit()).status).toBe(400);
  });

  it.each(["marker", "posted"] as const)("refuses another upload after a completed %s", async (record) => {
    mocks[record].mockResolvedValue({ id: "existing-import" });
    expect((await submit()).status).toBe(400);
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks[record]).toHaveBeenCalledWith({
      where: record === "marker" ? { orgId: "org-safe", periodId: "period-safe", type: { code: "SOLIQ_IMPORT" } } :
        { orgId: "org-safe", periodId: "period-safe", status: "POSTED" }, select: { id: true },
    });
  });

  it("rejects read-only membership before parsing", async () => {
    mocks.membership.mockResolvedValue({ orgId: "org-safe", role: "VIEWER" });
    expect((await submit()).status).toBe(403);
    expect(mocks.parse).not.toHaveBeenCalled();
  });
});
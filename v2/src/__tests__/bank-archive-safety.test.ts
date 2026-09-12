import { createHash } from "node:crypto";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET as list } from "@/app/api/import/bank/batches/route";
import { GET as download } from "@/app/api/import/bank/batches/[batchId]/export/route";

const mocks = vi.hoisted(() => ({ membership: vi.fn(), bank: vi.fn(), batch: vi.fn(), batches: vi.fn() }));
vi.mock("@/lib/context", () => ({ getActiveMembership: mocks.membership }));
vi.mock("@/lib/prisma", () => ({ default: { bankAccount: { findFirst: mocks.bank }, bankImportBatch: { findFirst: mocks.batch, findMany: mocks.batches } } }));

const sourceData = Buffer.from([0, 255, 10, 13, 192, 224]);
const batch = {
  id: "batch", orgId: "own-org", bankAccountId: "bank", bankCurrency: "UZS", sourceName: "statement.txt", sourceData,
  sourceHash: createHash("sha256").update(sourceData).digest("hex"), parserVersion: "1c-bank-v1",
  rows: [{ amount: "9007199254740993.27" }], statement: { openingBalance: "0.00", closingBalance: "9007199254740993.27" },
  result: { imported: 1 }, status: "IMPORTED", createdBy: "uploader", createdAt: new Date("2026-09-11T00:00:00Z"),
  rolledBackAt: null, rolledBackBy: null, rollbackAuditId: null,
};
const exportRequest = (format = "protocol") => download(new NextRequest(`http://localhost/api/import/bank/batches/batch/export?format=${format}`), { params: Promise.resolve({ batchId: "batch" }) });
const listRequest = (query = "bankAccountId=bank") => list(new NextRequest(`http://localhost/api/import/bank/batches?${query}`));

describe("bank archive access", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.membership.mockResolvedValue({ orgId: "own-org", role: "VIEWER" });
    mocks.bank.mockResolvedValue({ id: "bank" });
    mocks.batch.mockResolvedValue(batch);
    mocks.batches.mockResolvedValue([]);
  });
  it("exports exact source bytes without transcoding", async () => {
    const response = await exportRequest("source");
    expect(response.status).toBe(200);
    expect(Buffer.from(await response.arrayBuffer())).toEqual(sourceData);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("content-type")).toBe("application/octet-stream");
    expect(mocks.batch).toHaveBeenCalledWith({ where: { id: "batch", orgId: "own-org", bankAccount: { orgId: "own-org" } } });
  });
  it.each(["IMPORTED", "ROLLED_BACK"])("exports persisted %s protocol with exact amounts and no bytes", async status => {
    mocks.batch.mockResolvedValue({ ...batch, status, rollbackAuditId: status === "ROLLED_BACK" ? "audit" : null });
    const response = await exportRequest();
    expect(response.status).toBe(200);
    const output = await response.json();
    expect(output).toMatchObject({ exportVersion: "bank-audit-v1", batch: { status, rows: batch.rows, statement: batch.statement, result: batch.result } });
    expect(output.batch).not.toHaveProperty("sourceData");
    expect(response.headers.get("content-disposition")).toBe('attachment; filename="bank-protocol.json"');
  });
  it("sanitizes filenames and does not inject headers", async () => {
    mocks.batch.mockResolvedValue({ ...batch, sourceName: "../dir/statement\r\nX-Test: injected'().txt" });
    const response = await exportRequest("source");
    expect(response.status).toBe(200);
    expect(response.headers.get("x-test")).toBeNull();
    expect(response.headers.get("content-disposition")).toContain("statementX-Test%3A%20injected%27%28%29.txt");
  });
  it.each(["source", "protocol"])("refuses corrupt %s", async format => {
    mocks.batch.mockResolvedValue({ ...batch, sourceHash: "corrupt" });
    expect((await exportRequest(format)).status).toBe(409);
  });
  it("does not query data for an unsupported format", async () => {
    expect((await exportRequest("html")).status).toBe(400);
    expect(mocks.batch).not.toHaveBeenCalled();
  });
  it("does not reveal whether a foreign batch exists", async () => {
    mocks.batch.mockResolvedValue(null);
    expect((await exportRequest()).status).toBe(404);
  });
  it("lists a bounded metadata page without fetching source or row data", async () => {
    mocks.batches.mockResolvedValue(Array.from({ length: 21 }, (_, index) => ({ id: String(index) })));
    const response = await listRequest();
    const output = await response.json();
    expect(output.batches).toHaveLength(20);
    expect(output.nextCursor).toBe("19");
    expect(mocks.batches).toHaveBeenCalledWith(expect.objectContaining({
      where: { orgId: "own-org", bankAccountId: "bank", bankAccount: { orgId: "own-org" } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 21,
    }));
    const select = mocks.batches.mock.calls[0][0].select;
    expect(select).not.toHaveProperty("sourceData");
    expect(select).not.toHaveProperty("rows");
    expect(select).not.toHaveProperty("result");
  });
  it("uses both time and id for stable cursor pagination", async () => {
    await listRequest("bankAccountId=bank&cursor=batch");
    expect(mocks.batch).toHaveBeenCalledWith({ where: { orgId: "own-org", bankAccountId: "bank", bankAccount: { orgId: "own-org" }, id: "batch" }, select: { id: true, createdAt: true } });
    expect(mocks.batches.mock.calls[0][0].where.OR).toEqual([
      { createdAt: { lt: batch.createdAt } }, { createdAt: batch.createdAt, id: { lt: "batch" } },
    ]);
  });
  it("refuses a foreign cursor", async () => {
    mocks.batch.mockResolvedValue(null);
    expect((await listRequest("bankAccountId=bank&cursor=foreign")).status).toBe(404);
    expect(mocks.batches).not.toHaveBeenCalled();
  });
  it("refuses a foreign bank before looking up archive data", async () => {
    mocks.bank.mockResolvedValue(null);
    expect((await listRequest()).status).toBe(404);
    expect(mocks.batches).not.toHaveBeenCalled();
  });
  it.each(["", "bankAccountId=", "bankAccountId=bank&cursor="])("rejects malformed list query %s", async query => {
    expect((await listRequest(query)).status).toBe(400);
    expect(mocks.bank).not.toHaveBeenCalled();
  });
  it.each(["UNAUTHORIZED", "FORBIDDEN", "NO_ACTIVE_ORG"])("blocks %s before reads", async message => {
    mocks.membership.mockRejectedValue(new Error(message));
    expect((await exportRequest()).status).toBe(message === "UNAUTHORIZED" ? 401 : 403);
    expect((await listRequest()).status).toBe(message === "UNAUTHORIZED" ? 401 : 403);
    expect(mocks.bank).not.toHaveBeenCalled();
    expect(mocks.batch).not.toHaveBeenCalled();
  });
});
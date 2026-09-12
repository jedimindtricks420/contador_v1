import { createHash } from "node:crypto";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/import/soliq/[batchId]/export/route";

const mocks = vi.hoisted(() => ({ membership: vi.fn(), batch: vi.fn() }));
vi.mock("@/lib/context", () => ({ getActiveMembership: mocks.membership }));
vi.mock("@/lib/prisma", () => ({ default: { soliqImportBatch: { findFirst: mocks.batch } } }));

const sourceData = Buffer.from([0, 255, 80, 75, 13, 10]);
const fixture = {
  id: "batch-safe", orgId: "org-safe", periodId: "period-safe",
  sourceName: "registry.xlsx", sourceData,
  sourceHash: createHash("sha256").update(sourceData).digest("hex"),
  parserVersion: "soliq-v1", rows: [], totals: { rowCount: 0, gross: "0.00" },
  status: "POSTED", createdBy: "uploader", createdAt: new Date("2026-09-10T00:00:00Z"),
  postedBy: "accountant", postedAt: new Date("2026-09-10T01:00:00Z"),
  result: { markerId: "marker-safe", rows: [], ledgerControl: { version: "soliq-v1" } },
};

function request(query = "") {
  return GET(new NextRequest(`http://localhost/api/import/soliq/batch-safe/export${query}`), {
    params: Promise.resolve({ batchId: "batch-safe" }),
  });
}

describe("Soliq audit export", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.membership.mockResolvedValue({ orgId: "org-safe", userId: "viewer", role: "VIEWER" });
    mocks.batch.mockResolvedValue(fixture);
  });

  it("exports persisted protocol for a current read-only member without source bytes", async () => {
    const response = await request();
    expect(response.status).toBe(200);
    const output = await response.json();
    expect(output).toMatchObject({ exportVersion: "soliq-audit-v1", batch: {
      id: fixture.id, sourceHash: fixture.sourceHash, sourceSize: sourceData.length,
      rows: fixture.rows, totals: fixture.totals, result: fixture.result,
      postedBy: "accountant", postedAt: fixture.postedAt.toISOString(),
    } });
    expect(output.batch).not.toHaveProperty("sourceData");
    expect(mocks.batch).toHaveBeenCalledWith({ where: { id: "batch-safe", orgId: "org-safe", period: { orgId: "org-safe" } } });
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("content-disposition")).toBe('attachment; filename="soliq-protocol.json"');
  });

  it("exports exact original bytes and safely encodes an untrusted filename", async () => {
    mocks.batch.mockResolvedValue({ ...fixture, sourceName: "registry\r\nX-Test: injected'().xlsx" });
    const response = await request("?format=source");
    expect(response.status).toBe(200);
    expect(Buffer.from(await response.arrayBuffer())).toEqual(sourceData);
    expect(response.headers.get("content-type")).toBe("application/octet-stream");
    expect(response.headers.get("content-disposition")).toContain("registry%0D%0AX-Test%3A%20injected%27%28%29.xlsx");
    expect(response.headers.get("x-test")).toBeNull();
  });

  it.each(["READY", "CANCELLED"])("preserves the %s protocol without a write", async status => {
    mocks.batch.mockResolvedValue({ ...fixture, status, postedAt: null, postedBy: null,
      result: status === "READY" ? null : { reason: "Wrong source", userId: "actor", cancelledAt: "2026-09-10T01:00:00Z" } });
    const response = await request("?format=protocol");
    expect(response.status).toBe(200);
    expect((await response.json()).batch).toMatchObject({ status, postedAt: null, postedBy: null });
  });

  it.each(["UNAUTHORIZED", "FORBIDDEN", "NO_ACTIVE_ORG"])("refuses %s before accessing a batch", async message => {
    mocks.membership.mockRejectedValue(new Error(message));
    expect((await request()).status).toBe(message === "UNAUTHORIZED" ? 401 : 403);
    expect(mocks.batch).not.toHaveBeenCalled();
  });

  it("returns 404 for a missing or foreign batch", async () => {
    mocks.batch.mockResolvedValue(null);
    expect((await request()).status).toBe(404);
  });

  it.each(["source", "protocol"])("refuses %s when source integrity fails", async format => {
    mocks.batch.mockResolvedValue({ ...fixture, sourceHash: "corrupt" });
    expect((await request(`?format=${format}`)).status).toBe(409);
  });

  it("rejects an unknown format before querying data", async () => {
    expect((await request("?format=html")).status).toBe(400);
    expect(mocks.batch).not.toHaveBeenCalled();
  });

  it("does not disclose database errors", async () => {
    mocks.batch.mockRejectedValue(new Error("internal database details"));
    const response = await request();
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain("internal database details");
  });
});
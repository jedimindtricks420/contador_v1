import { createHash } from "node:crypto";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET as list } from "@/app/api/posting/revisions/route";
import { GET as download } from "@/app/api/posting/revisions/[revisionId]/export/route";

const mocks = vi.hoisted(() => ({ membership: vi.fn(), anchor: vi.fn(), revisions: vi.fn(), query: vi.fn() }));
vi.mock("@/lib/context", () => ({ getActiveMembership: mocks.membership }));
vi.mock("@/lib/prisma", () => ({ default: {
  postingRevision: { findFirst: mocks.anchor, findMany: mocks.revisions }, $queryRaw: mocks.query,
} }));

const snapshotCanonical = '{"payload": {"amount": "9007199254740993.27", "legacyNumber": 9007199254740993.27}}';
const revision = {
  id: "revision", orgId: "own-org", documentId: "document", periodId: "period", revision: 21,
  previousId: "previous", action: "POST", createdBy: "actor", createdAt: new Date("2026-09-11T00:00:00Z"),
  snapshotCanonical, snapshotHash: createHash("sha256").update(snapshotCanonical).digest("hex"),
};
const listRequest = (query = "documentId=document") => list(new NextRequest(`http://localhost/api/posting/revisions?${query}`));
const exportRequest = (revisionId = "revision") => download(new NextRequest("http://localhost/api/posting/revisions/revision/export"), {
  params: Promise.resolve({ revisionId }),
});

describe("posting revision archive API", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.membership.mockResolvedValue({ orgId: "own-org", role: "ACCOUNTANT" });
    mocks.anchor.mockResolvedValue({ revision: 21 });
    mocks.revisions.mockResolvedValue([]);
    mocks.query.mockResolvedValue([revision]);
  });

  it("exports exact canonical text and independently verifiable hash", async () => {
    const response = await exportRequest();
    expect(response.status).toBe(200);
    const output = await response.json();
    expect(output).toMatchObject({ exportVersion: "posting-revision-v1", revision: { snapshotCanonical, snapshotHash: revision.snapshotHash } });
    expect(output.revision).not.toHaveProperty("snapshot");
    expect(createHash("sha256").update(output.revision.snapshotCanonical).digest("hex")).toBe(output.revision.snapshotHash);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("content-disposition")).toBe('attachment; filename="posting-revision.json"');
    expect(mocks.query.mock.calls[0].slice(1)).toEqual(["revision", "own-org"]);
    expect(mocks.query.mock.calls[0][0].join("?")).toContain('WHERE "id" = ? AND "orgId" = ?');
  });

  it("rejects corrupt snapshots without exporting their content", async () => {
    mocks.query.mockResolvedValue([{ ...revision, snapshotHash: "corrupt" }]);
    const response = await exportRequest();
    expect(response.status).toBe(409);
    expect(await response.text()).not.toContain("9007199254740993");
  });

  it("does not distinguish missing and foreign revisions", async () => {
    mocks.query.mockResolvedValue([]);
    expect((await exportRequest()).status).toBe(404);
  });

  it("lists bounded metadata without loading snapshots or live documents", async () => {
    mocks.revisions.mockResolvedValue(Array.from({ length: 21 }, (_, index) => ({ id: String(index) })));
    const response = await listRequest();
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ revisions: expect.any(Array), nextCursor: "19" });
    const query = mocks.revisions.mock.calls[0][0];
    expect(query).toMatchObject({ where: { orgId: "own-org", documentId: "document" }, orderBy: { revision: "desc" }, take: 21 });
    expect(query.select).not.toHaveProperty("snapshot");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it("uses tenant and document scoped revision keyset pagination", async () => {
    await listRequest("documentId=document&cursor=revision");
    expect(mocks.anchor).toHaveBeenCalledWith({ where: { orgId: "own-org", documentId: "document", id: "revision" }, select: { revision: true } });
    expect(mocks.revisions.mock.calls[0][0].where).toEqual({ orgId: "own-org", documentId: "document", revision: { lt: 21 } });
  });

  it("rejects a foreign or other-document cursor before listing", async () => {
    mocks.anchor.mockResolvedValue(null);
    expect((await listRequest("documentId=document&cursor=foreign")).status).toBe(404);
    expect(mocks.revisions).not.toHaveBeenCalled();
  });

  it("returns an empty final page for missing history", async () => {
    const response = await listRequest();
    expect(await response.json()).toEqual({ revisions: [], nextCursor: null });
  });

  it.each(["", "documentId=", `documentId=${"x".repeat(101)}`, "documentId=document&cursor=", `documentId=document&cursor=${"x".repeat(101)}`])("rejects malformed list query %s", async query => {
    expect((await listRequest(query)).status).toBe(400);
    expect(mocks.revisions).not.toHaveBeenCalled();
    expect(mocks.anchor).not.toHaveBeenCalled();
  });

  it.each(["", "x".repeat(101)])("rejects malformed revision id", async revisionId => {
    expect((await exportRequest(revisionId)).status).toBe(400);
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it.each(["UNAUTHORIZED", "FORBIDDEN", "NO_ACTIVE_ORG"])("blocks %s before all archive reads", async message => {
    mocks.membership.mockRejectedValue(new Error(message));
    for (const response of [await listRequest(), await exportRequest()]) {
      expect(response.status).toBe(message === "UNAUTHORIZED" ? 401 : 403);
      expect(response.headers.get("cache-control")).toBe("private, no-store");
    }
    expect(mocks.revisions).not.toHaveBeenCalled();
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("hides internal database errors", async () => {
    mocks.revisions.mockRejectedValue(new Error("private database detail"));
    mocks.query.mockRejectedValue(new Error("private database detail"));
    for (const response of [await listRequest(), await exportRequest()]) {
      expect(response.status).toBe(500);
      expect(await response.text()).not.toContain("private database detail");
    }
  });
});
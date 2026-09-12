import { createHash, randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as list } from "@/app/api/posting/revisions/route";
import { GET as download } from "@/app/api/posting/revisions/[revisionId]/export/route";
import { appendPostingRevision } from "@/lib/posting/postingRevision";

const fixture = vi.hoisted(() => ({ client: null as PrismaClient | null, session: null as { userId: string; activeOrgId: string } | null }));
vi.mock("@/lib/auth", () => ({ getSessionFromCookie: async () => fixture.session }));
vi.mock("@/lib/prisma", () => ({ default: {
  get orgMember() { return fixture.client!.orgMember; },
  get postingRevision() { return fixture.client!.postingRevision; },
  $queryRaw: (...args: Parameters<PrismaClient["$queryRaw"]>) => fixture.client!.$queryRaw(...args),
} }));

const databaseUrl = process.env.ACC_TEST_DATABASE_URL;
if (databaseUrl) {
  const parsed = new URL(databaseUrl);
  if (parsed.hostname !== "127.0.0.1" || parsed.pathname !== "/contador_safety_test") {
    throw new Error("ACC_TEST_DATABASE_URL must target the disposable loopback contador_safety_test database");
  }
}

describe.skipIf(!databaseUrl)("posting revision reads on disposable PostgreSQL", () => {
  const client = new PrismaClient({ datasourceUrl: databaseUrl });
  const prefix = `revision-read-${randomUUID()}`;
  const orgIds = [`${prefix}-own`, `${prefix}-other`];
  const userId = `${prefix}-user`;
  const typeId = `${prefix}-type`;
  const documentIds = orgIds.map(orgId => `${orgId}-document`);
  const revisionIds: string[] = [];
  const listRequest = (documentId = documentIds[0], cursor?: string) => list(new NextRequest(`http://localhost/api/posting/revisions?${new URLSearchParams({ documentId, ...(cursor ? { cursor } : {}) })}`));
  const exportRequest = (revisionId = revisionIds[0]) => download(new NextRequest("http://localhost/api/posting/revisions/revision/export"), { params: Promise.resolve({ revisionId }) });
  const append = async (documentId: string, count = 1) => client.$transaction(async transaction => {
    const document = await transaction.document.findUniqueOrThrow({ where: { id: documentId }, include: { type: true } });
    for (let index = 0; index < count; index += 1) {
      await appendPostingRevision(transaction, document, "POST", userId, { engineVersion: "test" });
    }
  });

  beforeAll(async () => {
    fixture.client = client;
    await client.user.create({ data: { id: userId, email: `${prefix}@example.invalid`, passwordHash: "synthetic-not-a-password" } });
    await client.documentType.create({ data: { id: typeId, code: typeId, name: "Synthetic archive read", postingTemplate: {} } });
    for (const [index, orgId] of orgIds.entries()) {
      await client.organization.create({ data: { id: orgId, name: "Synthetic archive read", members: { create: { userId, role: "ACCOUNTANT" } } } });
      const period = await client.period.create({ data: { orgId, year: 2026, month: 9 } });
      await client.document.create({ data: {
        id: documentIds[index], orgId, periodId: period.id, typeId, date: new Date("2026-09-11T00:00:00Z"),
        payload: { amount: "9007199254740993.27" },
      } });
      await append(documentIds[index], index === 0 ? 22 : 1);
      revisionIds.push((await client.postingRevision.findFirstOrThrow({ where: { documentId: documentIds[index] }, orderBy: { revision: "asc" } })).id);
    }
  });

  beforeEach(() => { fixture.session = { userId, activeOrgId: orgIds[0] }; });

  afterAll(async () => {
    try {
      await client.organization.deleteMany({ where: { id: { in: orgIds } } });
      await client.documentType.deleteMany({ where: { id: typeId } });
      await client.user.deleteMany({ where: { id: userId } });
    } finally { await client.$disconnect(); }
  });

  it.each(["OWNER", "ADMIN", "ACCOUNTANT"] as const)("allows %s to read exact snapshots without mutating history", async role => {
    await client.orgMember.update({ where: { userId_orgId: { userId, orgId: orgIds[0] } }, data: { role } });
    const before = await client.postingRevision.findUniqueOrThrow({ where: { id: revisionIds[0] } });
    const response = await exportRequest();
    expect(response.status).toBe(200);
    const output = await response.json();
    expect(output).toMatchObject({ exportVersion: "posting-revision-v1", revision: { orgId: orgIds[0], documentId: documentIds[0] } });
    expect(createHash("sha256").update(output.revision.snapshotCanonical, "utf8").digest("hex")).toBe(before.snapshotHash);
    expect(JSON.parse(output.revision.snapshotCanonical)).toMatchObject({ document: { payload: { amount: "9007199254740993.27" } } });
    expect(await client.postingRevision.findUniqueOrThrow({ where: { id: revisionIds[0] } })).toEqual(before);
    expect((await listRequest()).status).toBe(200);
  });

  it("paginates by revision despite identical timestamps and a subsequent append", async () => {
    const rows = await client.postingRevision.findMany({ where: { documentId: documentIds[0] } });
    expect(new Set(rows.map(row => row.createdAt.toISOString())).size).toBe(1);
    const first = await (await listRequest()).json();
    expect(first.revisions).toHaveLength(20);
    expect(first.revisions.map((row: { revision: number }) => row.revision)).toEqual(Array.from({ length: 20 }, (_, index) => 22 - index));
    expect(first.revisions.every((row: Record<string, unknown>) => !Object.hasOwn(row, "snapshot"))).toBe(true);
    await append(documentIds[0]);
    const second = await (await listRequest(documentIds[0], first.nextCursor)).json();
    expect(second.revisions.map((row: { revision: number }) => row.revision)).toEqual([2, 1]);
    expect(second.nextCursor).toBeNull();
    expect((await (await listRequest()).json()).revisions[0].revision).toBe(23);
  });

  it("isolates lists, cursors and exports in both organizations", async () => {
    for (const [index, orgId] of orgIds.entries()) {
      fixture.session = { userId, activeOrgId: orgId };
      const foreignIndex = 1 - index;
      const response = await listRequest(documentIds[foreignIndex]);
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ revisions: [], nextCursor: null });
      expect((await listRequest(documentIds[index], revisionIds[foreignIndex])).status).toBe(404);
      expect((await exportRequest(revisionIds[foreignIndex])).status).toBe(404);
      expect((await exportRequest(revisionIds[index])).status).toBe(200);
    }
  });

  it("refuses a same-tenant cursor belonging to another document", async () => {
    const source = await client.document.findUniqueOrThrow({ where: { id: documentIds[0] } });
    const another = await client.document.create({ data: {
      orgId: source.orgId, periodId: source.periodId, typeId, date: source.date, payload: {},
    } });
    await append(another.id);
    const revision = await client.postingRevision.findFirstOrThrow({ where: { documentId: another.id } });
    expect((await listRequest(documentIds[0], revision.id)).status).toBe(404);
    await client.document.delete({ where: { id: another.id } });
    const archived = await (await listRequest(another.id)).json();
    expect(archived.revisions).toHaveLength(1);
    expect((await exportRequest(revision.id)).status).toBe(200);
  });

  it("immediately revokes both reads with the unchanged cookie", async () => {
    await client.orgMember.delete({ where: { userId_orgId: { userId, orgId: orgIds[0] } } });
    try {
      expect((await listRequest()).status).toBe(403);
      expect((await exportRequest()).status).toBe(403);
    } finally {
      await client.orgMember.create({ data: { userId, orgId: orgIds[0], role: "ACCOUNTANT" } });
    }
  });

  it("refuses unauthenticated and fabricated organization sessions", async () => {
    fixture.session = null;
    expect((await listRequest()).status).toBe(401);
    expect((await exportRequest()).status).toBe(401);
    fixture.session = { userId, activeOrgId: "not-a-member" };
    expect((await listRequest()).status).toBe(403);
    expect((await exportRequest()).status).toBe(403);
  });

  it("does not expose retained snapshots after the organization is deleted", async () => {
    fixture.session = { userId, activeOrgId: orgIds[1] };
    await client.organization.delete({ where: { id: orgIds[1] } });
    expect(await client.postingRevision.findUnique({ where: { id: revisionIds[1] } })).not.toBeNull();
    expect((await listRequest(documentIds[1])).status).toBe(403);
    expect((await exportRequest(revisionIds[1])).status).toBe(403);
  });
});
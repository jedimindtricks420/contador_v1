import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST as createDocument } from "@/app/api/documents/route";
import { POST as postDocument } from "@/app/api/posting/post/route";
import { POST as voidDocument } from "@/app/api/posting/void/route";
import { POST as repostDocument } from "@/app/api/posting/repost/route";

const { membership, database, post, voidPost, repost } = vi.hoisted(() => ({
  membership: vi.fn(), post: vi.fn(), voidPost: vi.fn(), repost: vi.fn(),
  database: {
    period: { findFirst: vi.fn() }, documentType: { findUnique: vi.fn() },
    document: { findFirst: vi.fn(), create: vi.fn() }, $transaction: vi.fn()
  }
}));
vi.mock("@/lib/context", () => ({
  getActiveMembership: membership,
  badRequest: (error: string) => Response.json({ error }, { status: 400 })
}));
vi.mock("@/lib/prisma", () => ({ default: database }));
vi.mock("@/lib/posting/postingEngine", () => ({ postDocument: post, voidDocument: voidPost, repostDocument: repost }));

const body = { typeId: "type-1", periodId: "period-1", date: "2026-09-10", payload: { amount: "100" }, documentId: "doc-1", newDocumentTypeId: "type-2" };
const request = (data: unknown = body) => new NextRequest("http://localhost/api/documents", { method: "POST", body: JSON.stringify(data) });

describe("document API safety", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    membership.mockResolvedValue({ orgId: "org-1", userId: "user-1", role: "ACCOUNTANT" });
    database.period.findFirst.mockResolvedValue({ id: "period-1", status: "OPEN" });
    database.documentType.findUnique.mockResolvedValue({ id: "type-1", code: "SERVICES_RENDERED" });
    database.document.findFirst.mockResolvedValue({ id: "doc-1", type: { code: "SERVICES_RENDERED" } });
    database.document.create.mockResolvedValue({ id: "doc-1", status: "POSTED" });
    database.$transaction.mockImplementation(async (operation) => operation(database));
    post.mockResolvedValue({ journalEntries: [] });
    repost.mockResolvedValue({ journalEntries: [] });
  });

  it.each([createDocument, postDocument, voidDocument, repostDocument])("rejects unknown/read-only roles before writes", async (handler) => {
    membership.mockResolvedValue({ orgId: "org-1", userId: "user-1", role: "VIEWER" });
    expect((await handler(request())).status).toBe(403);
    expect(database.$transaction).not.toHaveBeenCalled();
  });

  it.each(["PERIOD_CLOSING", "YEAR_END_CLOSE", "SOLIQ_IMPORT", "OPENING_CAPITAL_DECLARATION"])("rejects direct creation of %s", async (code) => {
    database.documentType.findUnique.mockResolvedValue({ id: "type-1", code });
    expect((await createDocument(request())).status).toBe(400);
    expect(database.$transaction).not.toHaveBeenCalled();
  });

  it.each([postDocument, voidDocument, repostDocument].flatMap((handler) =>
    ["PERIOD_CLOSING", "YEAR_END_CLOSE"].map((code) => ({ handler, code }))
  ))("rejects generic operations on $code", async ({ handler, code }) => {
    database.document.findFirst.mockResolvedValue({ id: "doc-1", type: { code } });
    expect((await handler(request())).status).toBe(400);
    expect(database.$transaction).not.toHaveBeenCalled();
  });

  it.each(["SOLIQ_IMPORT", "YEAR_END_CLOSE"])("rejects converting an ordinary document to %s", async (code) => {
    database.documentType.findUnique.mockResolvedValue({ id: "type-2", code });
    expect((await repostDocument(request())).status).toBe(400);
    expect(database.$transaction).not.toHaveBeenCalled();
  });

  it.each([
    { ...body, date: "2026-02-30" }, { ...body, date: "not-a-date" },
    { ...body, payload: [] }, { ...body, payload: null }, { ...body, typeId: {} }
  ])("rejects invalid request shape before database reads", async (data) => {
    expect((await createDocument(request(data))).status).toBe(400);
    expect(database.period.findFirst).not.toHaveBeenCalled();
    expect(database.$transaction).not.toHaveBeenCalled();
  });

  it("creates an ordinary document with an authorized role", async () => {
    expect((await createDocument(request())).status).toBe(201);
    expect(database.period.findFirst).toHaveBeenCalledWith({ where: { id: "period-1", orgId: "org-1" } });
    expect(post).toHaveBeenCalledWith("doc-1", database, "user-1");
  });

  it.each([postDocument, voidDocument, repostDocument])("rejects a document outside the active organization", async (handler) => {
    database.document.findFirst.mockResolvedValue(null);
    expect((await handler(request())).status).toBe(400);
    expect(database.document.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "doc-1", orgId: "org-1" } }));
    expect(database.$transaction).not.toHaveBeenCalled();
  });
});
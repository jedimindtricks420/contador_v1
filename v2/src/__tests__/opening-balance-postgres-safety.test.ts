import { randomUUID } from "node:crypto";
import { Prisma, PrismaClient } from "@prisma/client";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "@/app/api/settings/opening-balance/route";

const fixture = vi.hoisted(() => ({ client: null as PrismaClient | null, orgId: "", failAudit: false }));
vi.mock("@/lib/context", () => ({ getActiveMembership: async () => ({ orgId: fixture.orgId, userId: "synthetic-user", role: "OWNER" }) }));
vi.mock("@/lib/prisma", () => ({ default: {
  get document() { return fixture.client!.document; },
  $transaction: (callback: (database: Prisma.TransactionClient) => Promise<unknown>, options: { maxWait: number; timeout: number }) => fixture.client!.$transaction(async database => callback(new Proxy(database, {
    get(target, key) {
      if (key === "auditLog" && fixture.failAudit) return { create: () => { throw new Error("injected opening audit failure"); } };
      return Reflect.get(target, key);
    },
  })), options),
} }));

const databaseUrl = process.env.ACC_TEST_DATABASE_URL;
if (databaseUrl) {
  const parsed = new URL(databaseUrl);
  if (parsed.hostname !== "127.0.0.1" || parsed.pathname !== "/contador_safety_test") {
    throw new Error("ACC_TEST_DATABASE_URL must target the disposable loopback contador_safety_test database");
  }
}

describe.skipIf(!databaseUrl)("opening balances on disposable PostgreSQL", () => {
  const client = new PrismaClient({ datasourceUrl: databaseUrl });
  const orgIds: string[] = [];
  const createdAccountIds: string[] = [];
  let existingType = false;
  let periodId = "";
  const submit = (amount = "9007199254740993.27", date = "2026-09-01") => POST(new NextRequest("http://localhost/api/settings/opening-balance", {
    method: "POST", body: JSON.stringify({ date, lines: [
      { accountCode: "5110", debit: amount, credit: "0" },
      { accountCode: "8330", debit: "0", credit: amount },
    ] }),
  }));
  beforeAll(async () => {
    fixture.client = client;
    existingType = Boolean(await client.documentType.findUnique({ where: { code: "OPENING_BALANCE" } }));
    for (const code of ["5110", "8330"]) {
      if (!await client.account.findUnique({ where: { code } })) {
        const account = await client.account.create({ data: { code, name: "Synthetic opening", type: code === "5110" ? "ASSET" : "LIABILITY" } });
        createdAccountIds.push(account.id);
      }
    }
  });
  beforeEach(async () => {
    fixture.orgId = `opening-${randomUUID()}`;
    fixture.failAudit = false;
    orgIds.push(fixture.orgId);
    await client.organization.create({ data: { id: fixture.orgId, name: "Synthetic opening balance" } });
    const period = await client.period.create({ data: { orgId: fixture.orgId, year: 2026, month: 9 } });
    periodId = period.id;
  });
  afterAll(async () => {
    try {
      await client.organization.deleteMany({ where: { id: { in: orgIds } } });
      await client.account.deleteMany({ where: { id: { in: createdAccountIds } } });
      if (!existingType) await client.documentType.deleteMany({ where: { code: "OPENING_BALANCE" } });
    } finally { await client.$disconnect(); }
  });

  it("persists exact ledger, source and audit and returns the Tashkent date", async () => {
    const response = await submit();
    expect(response.status).toBe(201);
    const { id } = await response.json();
    const stored = await client.document.findUniqueOrThrow({ where: { id }, include: { journalEntries: true } });
    expect(stored.periodId).toBe(periodId);
    expect(stored.date.toISOString()).toBe("2026-08-31T19:00:00.000Z");
    expect(stored.journalEntries.map(entry => entry.debit.plus(entry.credit).toFixed(2))).toEqual(["9007199254740993.27", "9007199254740993.27"]);
    expect(stored.payload).toMatchObject({ totals: { debit: "9007199254740993.27", credit: "9007199254740993.27" } });
    expect(await client.auditLog.count({ where: { entityId: id } })).toBe(1);
    expect(await (await GET()).json()).toMatchObject({ documentId: id, date: "2026-09-01" });
  });

  it("serializes two concurrent initializations without duplicates", async () => {
    const results = await Promise.all([submit(), submit()]);
    expect(results.map(response => response.status).sort()).toEqual([201, 409]);
    expect(await client.document.count({ where: { orgId: fixture.orgId } })).toBe(1);
    expect(await client.journalEntry.count({ where: { document: { orgId: fixture.orgId } } })).toBe(2);
    expect(await client.auditLog.count({ where: { orgId: fixture.orgId } })).toBe(1);
  });

  it("rolls back ledger and document on audit failure", async () => {
    fixture.failAudit = true;
    expect((await submit()).status).toBe(500);
    expect(await client.document.count({ where: { orgId: fixture.orgId } })).toBe(0);
    expect(await client.journalEntry.count({ where: { document: { orgId: fixture.orgId } } })).toBe(0);
    expect(await client.auditLog.count({ where: { orgId: fixture.orgId } })).toBe(0);
  });

  it("does not select another open month or create a missing period", async () => {
    expect((await submit("100", "2026-10-01")).status).toBe(400);
    expect(await client.period.count({ where: { orgId: fixture.orgId } })).toBe(1);
    expect(await client.document.count({ where: { orgId: fixture.orgId } })).toBe(0);
  });

  it.each(["CLOSED", "lock", "closingData"])("refuses period state %s", async mode => {
    await client.period.update({ where: { id: periodId }, data: mode === "CLOSED" ? { status: "CLOSED" } : mode === "lock" ? { lockDate: new Date() } : { closingData: {} } });
    expect((await submit()).status).toBe(409);
    expect(await client.document.count({ where: { orgId: fixture.orgId } })).toBe(0);
  });

  it("preserves every movement on attempted replacement", async () => {
    expect((await submit()).status).toBe(201);
    const before = await client.journalEntry.findMany({ where: { document: { orgId: fixture.orgId } }, orderBy: { id: "asc" } });
    expect((await submit("200")).status).toBe(409);
    expect(await client.journalEntry.findMany({ where: { document: { orgId: fixture.orgId } }, orderBy: { id: "asc" } })).toEqual(before);
    expect(await client.auditLog.count({ where: { orgId: fixture.orgId } })).toBe(1);
  });
});
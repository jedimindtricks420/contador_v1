import { createHash, randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { NextRequest } from "next/server";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE } from "@/app/api/periods/[id]/route";

const state = vi.hoisted(() => ({ client: null as PrismaClient | null, orgId: "", failAudit: false,
  afterLock: null as null | (() => Promise<void>),
}));
vi.mock("@/lib/context", () => ({ getActiveMembership: async () => ({ orgId: state.orgId, userId: "synthetic-actor", role: "OWNER" }) }));
vi.mock("@/lib/prisma", () => ({ default: {
  $transaction: (callback: (tx: any) => Promise<unknown>, options: any) =>
    state.client!.$transaction(tx => callback(new Proxy(tx, {
      get(target, key) {
        if (key === "auditLog" && state.failAudit) return { create: async () => { throw new Error("injected audit failure"); } };
        if (key === "$queryRaw") return async (...args: any[]) => {
          const result = await (target.$queryRaw as any)(...args);
          await state.afterLock?.();
          return result;
        };
        const value = Reflect.get(target, key);
        return typeof value === "function" ? value.bind(target) : value;
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

describe.skipIf(!databaseUrl)("period deletion on disposable PostgreSQL", () => {
  const client = new PrismaClient({ datasourceUrl: databaseUrl });
  const fixtureDate = new Date("2026-09-10T00:00:00Z");
  let periodId: string;
  let typeId: string;
  let accountId: string;

  beforeAll(async () => {
    state.client = client;
    typeId = (await client.documentType.create({ data: {
      code: `DELETE_TEST_${randomUUID()}`, name: "Synthetic deletion source", postingTemplate: {},
    } })).id;
    accountId = (await client.account.create({ data: {
      code: `DELETE_${randomUUID()}`, name: "Synthetic deletion account", type: "ASSET",
    } })).id;
  });

  beforeEach(async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    state.failAudit = false;
    state.afterLock = null;
    state.orgId = `period-delete-${randomUUID()}`;
    await client.organization.create({ data: { id: state.orgId, name: "Synthetic period deletion" } });
    periodId = (await client.period.create({ data: { orgId: state.orgId, year: 2026, month: 9 } })).id;
  });

  afterEach(async () => {
    state.afterLock = null;
    state.failAudit = false;
    try {
      await client.stagedTransaction.deleteMany({ where: { orgId: state.orgId } });
      await client.openItem.deleteMany({ where: { orgId: state.orgId } });
      await client.organization.deleteMany({ where: { id: state.orgId } });
    } finally {
      vi.restoreAllMocks();
    }
  });

  afterAll(async () => {
    try {
      await client.documentType.delete({ where: { id: typeId } });
      await client.account.delete({ where: { id: accountId } });
    } finally {
      await client.$disconnect();
    }
  });

  const request = () => DELETE(new NextRequest(`http://localhost/api/periods/${periodId}`, { method: "DELETE" }), {
    params: Promise.resolve({ id: periodId }),
  });
  const documentData = () => ({ orgId: state.orgId, periodId, typeId, date: fixtureDate, payload: {} });
  const noDeleteAudit = async () => expect(await client.auditLog.count({ where: { orgId: state.orgId, action: "DELETE_PERIOD" } })).toBe(0);

  it("deletes an empty period and records the current actor atomically", async () => {
    expect((await request()).status).toBe(200);
    expect(await client.period.findUnique({ where: { id: periodId } })).toBeNull();
    const audit = await client.auditLog.findFirstOrThrow({ where: { orgId: state.orgId, action: "DELETE_PERIOD" } });
    expect(audit.userId).toBe("synthetic-actor");
    expect(audit.entityId).toBe(periodId);
    expect(audit.oldValue).toEqual({ year: 2026, month: 9, mode: "ACTIVE", status: "OPEN" });
  });

  it("restores the period when audit insertion fails, then permits retry", async () => {
    state.failAudit = true;
    expect((await request()).status).toBe(500);
    expect(await client.period.findUnique({ where: { id: periodId } })).not.toBeNull();
    await noDeleteAudit();
    state.failAudit = false;
    expect((await request()).status).toBe(200);
    expect(await client.auditLog.count({ where: { orgId: state.orgId, action: "DELETE_PERIOD" } })).toBe(1);
  });

  it("serializes two deletion requests without duplicate audit", async () => {
    const responses = await Promise.all([request(), request()]);
    expect(responses.map(response => response.status).sort()).toEqual([200, 404]);
    expect(await client.auditLog.count({ where: { orgId: state.orgId, action: "DELETE_PERIOD" } })).toBe(1);
  });

  it("blocks a concurrent child insertion at the foreign key while deletion holds its lock", async () => {
    state.afterLock = async () => {
      await expect(client.$transaction(async tx => {
        await tx.$executeRawUnsafe("SET LOCAL lock_timeout = '500ms'");
        await tx.document.create({ data: documentData() });
      }, { maxWait: 1000, timeout: 3000 })).rejects.toThrow(/lock timeout/);
    };
    expect((await request()).status).toBe(200);
    expect(await client.document.count({ where: { orgId: state.orgId } })).toBe(0);
    expect(await client.period.findUnique({ where: { id: periodId } })).toBeNull();
  });

  it("preserves posted entries and a debt opened in a previous period", async () => {
    const previous = await client.period.create({ data: { orgId: state.orgId, year: 2026, month: 8 } });
    const source = await client.document.create({ data: { ...documentData(), periodId: previous.id, date: new Date("2026-08-10T00:00:00Z") } });
    const payment = await client.document.create({ data: { ...documentData(), journalEntries: { create: [
      { accountId, date: fixtureDate, debit: "100", credit: "0" },
      { accountId, date: fixtureDate, debit: "0", credit: "100" },
    ] } } });
    const debt = await client.openItem.create({ data: {
      orgId: state.orgId, accountId, openingDocumentId: source.id, closingDocumentId: payment.id,
      status: "CLOSED", amount: "100", dateOpened: source.date, dateClosed: fixtureDate,
    } });
    const entries = await client.journalEntry.findMany({ where: { documentId: payment.id }, orderBy: { id: "asc" } });
    expect((await request()).status).toBe(409);
    expect(await client.openItem.findUnique({ where: { id: debt.id } })).toEqual(debt);
    expect(await client.journalEntry.findMany({ where: { documentId: payment.id }, orderBy: { id: "asc" } })).toEqual(entries);
    expect(await client.document.count({ where: { orgId: state.orgId } })).toBe(2);
    await noDeleteAudit();
  });

  it("does not delete VOIDED source documents", async () => {
    const document = await client.document.create({ data: { ...documentData(), status: "VOIDED" } });
    expect((await request()).status).toBe(409);
    expect(await client.document.findUnique({ where: { id: document.id } })).toEqual(document);
    await noDeleteAudit();
  });

  it.each(["correction", "debt"])("preserves a soft reference from an external %s", async kind => {
    const otherPeriod = await client.period.create({ data: { orgId: state.orgId, year: 2026, month: 10 } });
    const document = await client.document.create({ data: {
      ...documentData(), periodId: otherPeriod.id, date: new Date("2026-10-10T00:00:00Z"),
      ...(kind === "correction" ? { correctionForPeriodId: periodId } : {}),
    } });
    const debt = kind === "debt" ? await client.openItem.create({ data: {
      orgId: state.orgId, accountId, openingDocumentId: document.id,
      amount: "10", dateOpened: document.date, affectedPeriodId: periodId,
    } }) : null;
    expect((await request()).status).toBe(409);
    expect(await client.period.findUnique({ where: { id: periodId } })).not.toBeNull();
    expect(await client.document.findUnique({ where: { id: document.id } })).toEqual(document);
    if (debt) expect(await client.openItem.findUnique({ where: { id: debt.id } })).toEqual(debt);
    await noDeleteAudit();
  });

  it.each(["bank", "tax", "job"])("preserves a period with %s data but no documents", async kind => {
    if (kind === "bank") {
      const bank = await client.bankAccount.create({ data: { orgId: state.orgId, name: "Synthetic bank" } });
      await client.stagedTransaction.create({ data: {
        orgId: state.orgId, periodId, bankAccountId: bank.id, date: fixtureDate,
        amount: "10", direction: "CREDIT", description: "Synthetic import", hash: randomUUID(),
      } });
    } else if (kind === "tax") {
      await client.taxCalendarEvent.create({ data: { orgId: state.orgId, periodId, type: "VAT", dueDate: fixtureDate, estimatedAmount: "10" } });
    } else {
      await client.closingJob.create({ data: { orgId: state.orgId, periodId, step: 1, data: {} } });
    }
    expect((await request()).status).toBe(409);
    const period = await client.period.findUniqueOrThrow({ where: { id: periodId }, include: {
      _count: { select: { stagedTransactions: true, taxEvents: true, closingJobs: true } },
    } });
    expect(Object.values(period._count).reduce((total, count) => total + count, 0)).toBe(1);
    await noDeleteAudit();
  });

  it.each(["READY", "POSTED", "CANCELLED"])("preserves %s Soliq source and protocol against period cascade", async status => {
    const sourceData = Buffer.from("synthetic source");
    const batch = await client.soliqImportBatch.create({ data: {
      orgId: state.orgId, periodId, sourceName: "fixture.csv", sourceData,
      sourceHash: createHash("sha256").update(sourceData).digest("hex"), parserVersion: "test",
      rows: [], totals: {}, createdBy: "synthetic-actor", status,
      ...(status === "POSTED" ? { postedBy: "synthetic-actor", postedAt: fixtureDate, result: { markerId: "synthetic" } }
        : status === "CANCELLED" ? { result: { reason: "fixture", userId: "synthetic-actor", cancelledAt: fixtureDate.toISOString() } } : {}),
    } });
    expect((await request()).status).toBe(409);
    expect(await client.soliqImportBatch.findUnique({ where: { id: batch.id } })).toEqual(batch);
    expect(await client.period.findUnique({ where: { id: periodId } })).not.toBeNull();
    await noDeleteAudit();
  });
});
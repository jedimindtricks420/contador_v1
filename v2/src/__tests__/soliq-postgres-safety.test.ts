import { createHash, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";
import { NextRequest } from "next/server";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/closing/[periodId]/step/[stepNumber]/complete/route";
import { buildSoliqRows, soliqControlTotals } from "@/lib/soliqBatch";
import { POST as discardBatch } from "@/app/api/import/soliq/[batchId]/discard/route";
import { finalizePeriod } from "@/lib/closing";
import { GET as getBatch } from "@/app/api/import/soliq/route";
import { GET as exportBatch } from "@/app/api/import/soliq/[batchId]/export/route";

const state = vi.hoisted(() => ({ client: null as PrismaClient | null, orgId: "", role: "ACCOUNTANT", failState: false, failBatch: false }));
vi.mock("@/lib/context", () => ({ getActiveMembership: async () => ({
  orgId: state.orgId, userId: "synthetic-soliq-user", role: state.role,
}) }));
vi.mock("@/lib/closing", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/closing")>(),
  upsertTaxCalendarEventsForPeriod: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/prisma", () => ({ default: new Proxy({}, {
  get(_target, key) {
    if (key === "$transaction") return (callback: (tx: any) => Promise<unknown>, options: any) =>
      state.client!.$transaction(async (tx) => callback(new Proxy(tx, {
        get(target, property) {
          if (property === "soliqImportBatch" && state.failBatch) return new Proxy(target.soliqImportBatch, {
            get(model, method) {
              if (method === "updateMany") return () => { throw new Error("injected Soliq protocol failure"); };
              return Reflect.get(model, method);
            },
          });
          if (property === "closingJob" && state.failState) return new Proxy(target.closingJob, {
            get(model, method) {
              if (method === "upsert") return () => { throw new Error("injected Soliq state failure"); };
              return Reflect.get(model, method);
            },
          });
          return Reflect.get(target, property);
        },
      })), options);
    return Reflect.get(state.client!, key);
  },
}) }));

const databaseUrl = process.env.ACC_TEST_DATABASE_URL;
if (databaseUrl) {
  const parsed = new URL(databaseUrl);
  if (parsed.hostname !== "127.0.0.1" || parsed.pathname !== "/contador_safety_test") {
    throw new Error("ACC_TEST_DATABASE_URL must target the disposable loopback contador_safety_test database");
  }
}

describe.skipIf(!databaseUrl)("Soliq completion on disposable PostgreSQL", () => {
  const client = new PrismaClient({ datasourceUrl: databaseUrl });
  const createdAccounts: string[] = [];
  const createdTypes: string[] = [];
  const accountIds: Record<string, string> = {};
  let sourceTypeId: string;
  let periodId: string;
  let counterpartyId: string;
  const batches = new Map<string, Promise<string>>();

  beforeAll(async () => {
    state.client = client;
    for (const code of ["5110", "6310", "4310", "9030", "9420", "4410", "6410"]) {
      let account = await client.account.findUnique({ where: { code } });
      if (!account) {
        account = await client.account.create({ data: { code, name: "Synthetic Soliq account", type: "ACTIVE_PASSIVE" } });
        createdAccounts.push(account.id);
      }
      accountIds[code] = account.id;
    }
    sourceTypeId = (await client.documentType.create({ data: {
      code: `SOLIQ_TEST_${randomUUID()}`, name: "Synthetic source", mode: "MANUAL_ONLY", postingTemplate: {},
    } })).id;
    createdTypes.push(sourceTypeId);
    for (const fixture of [
      { code: "INVOICE_CONFIRMED_PREPAID", debit: "6310", credit: "9030", closes: undefined },
      { code: "SERVICE_RECEIVED_PREPAID", debit: "9420", credit: "4310", closes: "4310" },
    ]) {
      const existing = await client.documentType.findUnique({ where: { code: fixture.code } });
      if (existing) throw new Error(`Disposable fixture collision: ${fixture.code}`);
      const type = await client.documentType.create({ data: {
        code: fixture.code, name: "Synthetic invoice", mode: "MANUAL_ONLY", postingTemplate: {
          lines: [
            { accountCode: fixture.debit, side: "debit", expression: fixture.closes ? "amount - vatAmount" : "amount" },
            { accountCode: fixture.credit, side: "credit", expression: fixture.closes ? "amount" : "amount - vatAmount" },
            { accountCode: fixture.closes ? "4410" : "6410", side: fixture.closes ? "debit" : "credit", expression: "vatAmount", condition: "vatAmount > 0" },
          ], requiresCounterparty: true,
          ...(fixture.closes ? { closesOpenItemByAccount: fixture.closes } : {}),
        },
      } });
      createdTypes.push(type.id);
    }
    const existingImport = await client.documentType.findUnique({ where: { code: "SOLIQ_IMPORT" } });
    if (!existingImport) createdTypes.push((await client.documentType.create({ data: {
      code: "SOLIQ_IMPORT", name: "Synthetic import", mode: "MANUAL_ONLY", postingTemplate: {},
    } })).id);
  });

  beforeEach(async () => {
    state.failState = false;
    state.failBatch = false;
    state.role = "ACCOUNTANT";
    batches.clear();
    state.orgId = `soliq-${randomUUID()}`;
    await client.organization.create({ data: { id: state.orgId, name: "Synthetic Soliq organization" } });
    periodId = (await client.period.create({ data: { orgId: state.orgId, year: 2026, month: 9 } })).id;
    counterpartyId = (await client.counterparty.create({ data: {
      orgId: state.orgId, name: "Synthetic counterparty", inn: "111111111",
    } })).id;
  });

  afterEach(async () => {
    state.failState = false;
    state.failBatch = false;
    await client.auditLog.deleteMany({ where: { orgId: state.orgId } });
    await client.organization.deleteMany({ where: { id: state.orgId } });
  });

  afterAll(async () => {
    try {
      await client.documentType.deleteMany({ where: { id: { in: createdTypes } } });
      await client.account.deleteMany({ where: { id: { in: createdAccounts } } });
    } finally {
      await client.$disconnect();
    }
  });

  async function openAdvance(direction = "REVENUE", amount = "100") {
    const accountCode = direction === "REVENUE" ? "6310" : "4310";
    const date = new Date("2026-09-01T00:00:00Z");
    const source = await client.document.create({ data: {
      orgId: state.orgId, periodId, typeId: sourceTypeId, date, status: "POSTED", payload: { amount },
      journalEntries: { create: [
        { accountId: accountIds[accountCode], date, debit: direction === "EXPENSE" ? amount : "0", credit: direction === "REVENUE" ? amount : "0" },
        { accountId: accountIds["5110"], date, debit: direction === "REVENUE" ? amount : "0", credit: direction === "EXPENSE" ? amount : "0" },
      ] },
    } });
    return client.openItem.create({ data: {
      orgId: state.orgId, counterpartyId, accountId: accountIds[accountCode], openingDocumentId: source.id,
      amount, dateOpened: date, status: "OPEN",
    } });
  }

  function prepareBatch(itemId: string, direction = "REVENUE", targetPeriod = periodId, date = "2026-09-10T00:00:00Z", money = { amount: 100, vatAmount: 0 }) {
    const key = JSON.stringify({ itemId, direction, targetPeriod, date, money });
    if (!batches.has(key)) batches.set(key, (async () => {
      const period = await client.period.findUniqueOrThrow({ where: { id: targetPeriod } });
      const rows = buildSoliqRows([{
        date: new Date(date), ...money, inn: "111111111",
        counterpartyName: "Synthetic counterparty", direction: direction as "REVENUE" | "EXPENSE",
      }], period);
      const sourceData = Buffer.from(key);
      return (await client.soliqImportBatch.create({ data: {
        orgId: state.orgId, periodId: targetPeriod, sourceName: "synthetic.xlsx", sourceData,
        sourceHash: createHash("sha256").update(sourceData).digest("hex"), parserVersion: "soliq-v1",
        rows, totals: soliqControlTotals(rows), createdBy: "synthetic-soliq-user",
      } })).id;
    })());
    return batches.get(key)!;
  }

  function complete(batchId: string, itemId: string, targetPeriod = periodId) {
    return POST(new NextRequest("http://localhost/api/closing/period/step/6/complete", {
      method: "POST", body: JSON.stringify({ batchId, decisions: [{ rowId: "1", openItemId: itemId, receiptKind: "services" }] }),
    }), { params: Promise.resolve({ periodId: targetPeriod, stepNumber: "6" }) });
  }

  async function submit(itemId: string, direction = "REVENUE", targetPeriod = periodId, date = "2026-09-10T00:00:00Z") {
    return complete(await prepareBatch(itemId, direction, targetPeriod, date), itemId, targetPeriod);
  }

  function discard(batchId: string, reason = "Incorrect source selected") {
    return discardBatch(new NextRequest("http://localhost/api/import/soliq/batch/discard", {
      method: "POST", body: JSON.stringify({ reason }),
    }), { params: Promise.resolve({ batchId }) });
  }

  it.each(["REVENUE", "EXPENSE"])("settles only the selected %s advance with nonzero ledger and atomic progress", async (direction) => {
    const older = await openAdvance(direction);
    const selected = await openAdvance(direction);
    const response = await submit(selected.id, direction);
    expect(response.status).toBe(200);
    expect((await client.openItem.findUniqueOrThrow({ where: { id: older.id } })).status).toBe("OPEN");
    const closed = await client.openItem.findUniqueOrThrow({ where: { id: selected.id } });
    expect(closed.status).toBe("CLOSED");
    expect(await client.journalEntry.count({ where: { documentId: closed.closingDocumentId! } })).toBe(2);
    const job = await client.closingJob.findUniqueOrThrow({ where: { periodId_orgId: { periodId, orgId: state.orgId } } });
    expect(job.step).toBe(7);
    expect(job.data).toMatchObject({ soliqMatched: { matched: 1, unmatched: 0 } });
    expect(await client.auditLog.count({ where: { entityId: closed.closingDocumentId!, userId: "synthetic-soliq-user" } })).toBe(1);
    const batch = await client.soliqImportBatch.findFirstOrThrow({ where: { orgId: state.orgId } });
    expect(batch).toMatchObject({ status: "POSTED", postedBy: "synthetic-soliq-user" });
    expect(batch.result).toMatchObject({ rows: [{ rowId: "1", documentId: closed.closingDocumentId }], totals: { rowCount: 1, gross: "100.00" } });
    expect((await submit(selected.id, direction)).status).toBe(400);
    const restored = await getBatch(new NextRequest(`http://localhost/api/import/soliq?periodId=${periodId}`));
    expect(await restored.json()).toEqual({ batches: [], imported: true,
      archives: [{ id: batch.id, sourceName: batch.sourceName, status: "POSTED" }] });
    await expect(client.soliqImportBatch.update({ where: { id: batch.id }, data: { result: {} } })).rejects.toThrow(/immutable/);
  });

  it.each(["failState", "failBatch"] as const)("rolls back ledger, import marker, settlement and progress on %s", async (failure) => {
    const item = await openAdvance();
    state[failure] = true;
    expect((await submit(item.id)).status).toBe(500);
    expect(await client.document.count({ where: { orgId: state.orgId } })).toBe(1);
    expect(await client.journalEntry.count({ where: { document: { orgId: state.orgId } } })).toBe(2);
    expect(await client.openItem.findUniqueOrThrow({ where: { id: item.id } })).toEqual(item);
    expect(await client.closingJob.count({ where: { orgId: state.orgId } })).toBe(0);
    expect(await client.auditLog.count({ where: { orgId: state.orgId } })).toBe(0);
    expect(await client.soliqImportBatch.findFirstOrThrow({ where: { orgId: state.orgId } })).toMatchObject({ status: "READY", result: null, postedAt: null });
    state[failure] = false;
    expect((await submit(item.id)).status).toBe(200);
  });

  it.each(["REVENUE", "EXPENSE"])("reconciles actual %s VAT, net and gross to the saved protocol", async (direction) => {
    await client.organization.update({ where: { id: state.orgId }, data: { isVatPayer: true } });
    const item = await openAdvance(direction, "112.11");
    const batchId = await prepareBatch(item.id, direction, periodId, "2026-09-10T00:00:00Z", { amount: 100.10, vatAmount: 12.01 });
    expect((await complete(batchId, item.id)).status).toBe(200);
    const closed = await client.openItem.findUniqueOrThrow({ where: { id: item.id } });
    const entries = await client.journalEntry.findMany({ where: { documentId: closed.closingDocumentId! }, include: { account: true } });
    const actual = entries.map(entry => ({ code: entry.account.code, debit: entry.debit.toFixed(2), credit: entry.credit.toFixed(2) }));
    expect(actual).toHaveLength(3);
    expect(actual).toEqual(expect.arrayContaining(direction === "REVENUE" ? [
      { code: "6310", debit: "112.11", credit: "0.00" },
      { code: "9030", debit: "0.00", credit: "100.10" },
      { code: "6410", debit: "0.00", credit: "12.01" },
    ] : [
      { code: "4310", debit: "0.00", credit: "112.11" },
      { code: "9420", debit: "100.10", credit: "0.00" },
      { code: "4410", debit: "12.01", credit: "0.00" },
    ]));
    const batch = await client.soliqImportBatch.findUniqueOrThrow({ where: { id: batchId } });
    expect(batch.result).toMatchObject({ ledgerControl: {
      version: "soliq-v1", documentCount: 1, totals: { rowCount: 1, net: "100.10", gross: "112.11", vat: direction === "REVENUE" ? "12.01" : "-12.01" },
    } });
  });

  it("preserves the batch and advance when a non-payer attempts input VAT", async () => {
    const item = await openAdvance("EXPENSE", "112.11");
    const batchId = await prepareBatch(item.id, "EXPENSE", periodId, "2026-09-10T00:00:00Z", { amount: 100.10, vatAmount: 12.01 });
    const originalBatch = await client.soliqImportBatch.findUniqueOrThrow({ where: { id: batchId } });
    const originalEntries = await client.journalEntry.findMany({ where: { document: { orgId: state.orgId } }, orderBy: { id: "asc" } });
    const response = await complete(batchId, item.id);
    expect(response.status).toBe(400);
    expect((await response.json()).error).toMatch(/4410.*статуса плательщика НДС/);
    expect(await client.soliqImportBatch.findUniqueOrThrow({ where: { id: batchId } })).toEqual(originalBatch);
    expect(await client.openItem.findUniqueOrThrow({ where: { id: item.id } })).toEqual(item);
    expect(await client.journalEntry.findMany({ where: { document: { orgId: state.orgId } }, orderBy: { id: "asc" } })).toEqual(originalEntries);
    expect(await client.document.count({ where: { orgId: state.orgId } })).toBe(1);
    expect(await client.closingJob.count({ where: { orgId: state.orgId } })).toBe(0);
    expect(await client.auditLog.count({ where: { orgId: state.orgId } })).toBe(0);
  });

  it("rolls back a balanced but incorrect VAT template instead of completing the batch", async () => {
    const item = await openAdvance("REVENUE", "112.11");
    const batchId = await prepareBatch(item.id, "REVENUE", periodId, "2026-09-10T00:00:00Z", { amount: 100.10, vatAmount: 12.01 });
    const type = await client.documentType.findUniqueOrThrow({ where: { code: "INVOICE_CONFIRMED_PREPAID" } });
    try {
      await client.documentType.update({ where: { id: type.id }, data: { postingTemplate: {
        lines: [
          { accountCode: "6310", side: "debit", expression: "amount" },
          { accountCode: "9030", side: "credit", expression: "amount" },
        ], requiresCounterparty: true,
      } } });
      const response = await complete(batchId, item.id);
      expect(response.status).toBe(400);
      expect((await response.json()).error).toMatch(/Проводки строки Soliq/);
      expect(await client.document.count({ where: { orgId: state.orgId } })).toBe(1);
      expect(await client.journalEntry.count({ where: { document: { orgId: state.orgId } } })).toBe(2);
      expect(await client.openItem.findUniqueOrThrow({ where: { id: item.id } })).toEqual(item);
      expect(await client.closingJob.count({ where: { orgId: state.orgId } })).toBe(0);
      expect(await client.auditLog.count({ where: { orgId: state.orgId } })).toBe(0);
      expect(await client.soliqImportBatch.findUniqueOrThrow({ where: { id: batchId } })).toMatchObject({ status: "READY", result: null });
    } finally {
      await client.documentType.update({ where: { id: type.id }, data: { postingTemplate: type.postingTemplate! } });
    }
    expect((await complete(batchId, item.id)).status).toBe(200);
  });

  it("posts a genuinely empty registry without inventing journal entries", async () => {
    const sourceData = Buffer.from("empty synthetic registry");
    const batch = await client.soliqImportBatch.create({ data: {
      orgId: state.orgId, periodId, sourceName: "empty.xlsx", sourceData,
      sourceHash: createHash("sha256").update(sourceData).digest("hex"), parserVersion: "soliq-v1",
      rows: [], totals: soliqControlTotals([]), createdBy: "synthetic-soliq-user",
    } });
    const response = await POST(new NextRequest("http://localhost/api/closing/period/step/6/complete", {
      method: "POST", body: JSON.stringify({ batchId: batch.id, decisions: [] }),
    }), { params: Promise.resolve({ periodId, stepNumber: "6" }) });
    expect(response.status).toBe(200);
    expect(await client.document.count({ where: { orgId: state.orgId } })).toBe(1);
    expect(await client.journalEntry.count({ where: { document: { orgId: state.orgId } } })).toBe(0);
    expect(await client.soliqImportBatch.findUniqueOrThrow({ where: { id: batch.id } })).toMatchObject({
      status: "POSTED", result: { rows: [], ledgerControl: { documentCount: 0, totals: { gross: "0.00" } } },
    });
  });

  it("does not duplicate a concurrent import of the same period", async () => {
    const item = await openAdvance();
    const responses = await Promise.all([submit(item.id), submit(item.id)]);
    expect(responses.map(response => response.status).sort()).toEqual([200, 400]);
    expect(await client.document.count({ where: { orgId: state.orgId } })).toBe(3);
  });

  it("does not consume one advance in two different periods", async () => {
    const item = await openAdvance();
    const later = await client.period.create({ data: { orgId: state.orgId, year: 2026, month: 10 } });
    const responses = await Promise.all([
      submit(item.id), submit(item.id, "REVENUE", later.id, "2026-10-10T00:00:00Z"),
    ]);
    expect(responses.map(response => response.status).sort()).toEqual([200, 400]);
    expect(await client.document.count({ where: { orgId: state.orgId } })).toBe(3);
    expect(await client.closingJob.count({ where: { orgId: state.orgId } })).toBe(1);
  });

  it("rejects source changes, duplicate file identity and an incomplete posted protocol in SQL", async () => {
    const item = await openAdvance();
    const batchId = await prepareBatch(item.id);
    const batch = await client.soliqImportBatch.findUniqueOrThrow({ where: { id: batchId } });
    for (const data of [{ rows: [] }, { sourceData: Buffer.from("changed") }, { sourceHash: "changed" }, { totals: {} }]) {
      await expect(client.soliqImportBatch.update({ where: { id: batchId }, data })).rejects.toThrow(/immutable/);
    }
    await expect(client.soliqImportBatch.create({ data: {
      orgId: state.orgId, periodId, sourceName: batch.sourceName, sourceHash: batch.sourceHash,
      sourceData: batch.sourceData, parserVersion: batch.parserVersion, rows: [], totals: {}, createdBy: "test",
    } })).rejects.toMatchObject({ code: "P2002" });
    await expect(client.soliqImportBatch.update({ where: { id: batchId }, data: { status: "POSTED" } })).rejects.toThrow(/SoliqImportBatch_posted_check/);
    expect((await submit(item.id)).status).toBe(200);
  });

  it.each([
    { label: "source hash", patch: { sourceHash: "invalid" } },
    { label: "parser version", patch: { parserVersion: "unsupported" } },
    { label: "stored totals", patch: { totals: { rowCount: 99 } } },
  ])("refuses corrupt $label before creating any document", async ({ label, patch }) => {
    const sourceData = Buffer.from(label);
    const rows = buildSoliqRows([{
      date: new Date("2026-09-10T00:00:00Z"), amount: 100, vatAmount: 0, inn: "111111111",
      counterpartyName: "Synthetic", direction: "REVENUE",
    }], { year: 2026, month: 9 });
    const batch = await client.soliqImportBatch.create({ data: {
      orgId: state.orgId, periodId, sourceName: "corrupt.xlsx", sourceData,
      sourceHash: createHash("sha256").update(sourceData).digest("hex"), parserVersion: "soliq-v1",
      rows, totals: soliqControlTotals(rows), createdBy: "test", ...patch,
    } });
    expect((await complete(batch.id, "unused-advance")).status).toBe(400);
    expect(await client.document.count({ where: { orgId: state.orgId } })).toBe(0);
    expect(await client.closingJob.count({ where: { orgId: state.orgId } })).toBe(0);
    expect(await client.soliqImportBatch.findUniqueOrThrow({ where: { id: batch.id } })).toMatchObject({ status: "READY", result: null });
  });

  it.each([
    { result: {} },
    { result: { reason: "test", userId: "test" } },
    { result: { reason: " ", userId: "test", cancelledAt: "2026-09-10T00:00:00Z" } },
    { result: { reason: null, userId: "test", cancelledAt: "2026-09-10T00:00:00Z" } },
    { result: { reason: "test", userId: " ", cancelledAt: "2026-09-10T00:00:00Z" } },
  ])("rejects incomplete cancellation metadata in SQL: %j", async ({ result }) => {
    const batchId = await prepareBatch("unused-advance");
    await expect(client.soliqImportBatch.update({ where: { id: batchId }, data: {
      status: "CANCELLED", result,
    } })).rejects.toThrow(/SoliqImportBatch_posted_check/);
    expect(await client.soliqImportBatch.findUniqueOrThrow({ where: { id: batchId } })).toMatchObject({ status: "READY", result: null });
  });

  it("blocks closing with a READY batch and retains an immutable cancellation protocol", async () => {
    const item = await openAdvance();
    const batchId = await prepareBatch(item.id);
    await expect(finalizePeriod(periodId, state.orgId, "test")).rejects.toThrow(/пакетов Soliq не проведены/);
    expect(await client.closingJob.count({ where: { orgId: state.orgId } })).toBe(0);
    expect((await discard(batchId, " ")).status).toBe(400);
    state.role = "VIEWER";
    expect((await discard(batchId)).status).toBe(403);
    state.role = "ACCOUNTANT";
    expect((await discard(batchId)).status).toBe(200);
    const batch = await client.soliqImportBatch.findUniqueOrThrow({ where: { id: batchId } });
    expect(batch).toMatchObject({ status: "CANCELLED", postedAt: null, result: { reason: "Incorrect source selected", userId: "synthetic-soliq-user" } });
    expect((await submit(item.id)).status).toBe(400);
    expect((await discard(batchId)).status).toBe(400);
    await expect(client.soliqImportBatch.update({ where: { id: batchId }, data: { status: "READY" } })).rejects.toThrow(/immutable/);
    expect(await client.document.count({ where: { orgId: state.orgId } })).toBe(1);
  });

  it("serializes cancellation against posting without a partial ledger", async () => {
    const item = await openAdvance();
    const batchId = await prepareBatch(item.id);
    const responses = await Promise.all([complete(batchId, item.id), discard(batchId)]);
    expect(responses.map(response => response.status).sort()).toEqual([200, 400]);
    const batch = await client.soliqImportBatch.findUniqueOrThrow({ where: { id: batchId } });
    const posted = batch.status === "POSTED";
    expect(await client.document.count({ where: { orgId: state.orgId } })).toBe(posted ? 3 : 1);
    expect((await client.openItem.findUniqueOrThrow({ where: { id: item.id } })).status).toBe(posted ? "CLOSED" : "OPEN");
  });

  it("restores a saved preview without trusting client rows and scopes it to period and tenant", async () => {
    const item = await openAdvance();
    const batchId = await prepareBatch(item.id);
    const list = await getBatch(new NextRequest(`http://localhost/api/import/soliq?periodId=${periodId}`));
    expect(await list.json()).toMatchObject({ batches: [{ id: batchId, sourceName: "synthetic.xlsx" }] });
    const response = await getBatch(new NextRequest(`http://localhost/api/import/soliq?periodId=${periodId}&batchId=${batchId}`));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ batchId, matched: 1, totals: { gross: "100.00", rowCount: 1 } });
    const later = await client.period.create({ data: { orgId: state.orgId, year: 2026, month: 10 } });
    expect((await getBatch(new NextRequest(`http://localhost/api/import/soliq?periodId=${later.id}&batchId=${batchId}`))).status).toBe(404);
    const ownOrg = state.orgId;
    state.orgId = "foreign";
    try {
      expect((await getBatch(new NextRequest(`http://localhost/api/import/soliq?periodId=${periodId}&batchId=${batchId}`))).status).toBe(404);
    } finally {
      state.orgId = ownOrg;
    }
  });

  it.each(["POSTED", "CANCELLED"])("exports the unchanged %s archive from a locked period and isolates tenants", async status => {
    const item = await openAdvance();
    const batchId = await prepareBatch(item.id);
    expect((await (status === "POSTED" ? complete(batchId, item.id) : discard(batchId))).status).toBe(200);
    const before = await client.soliqImportBatch.findUniqueOrThrow({ where: { id: batchId } });
    await client.period.update({ where: { id: periodId }, data: { status: "CLOSED", lockDate: new Date() } });
    state.role = "VIEWER";
    const params = { params: Promise.resolve({ batchId }) };
    const source = await exportBatch(new NextRequest("http://localhost/api/import/soliq/batch/export?format=source"), params);
    expect(source.status).toBe(200);
    expect(Buffer.from(await source.arrayBuffer())).toEqual(Buffer.from(before.sourceData));
    const protocol = await exportBatch(new NextRequest("http://localhost/api/import/soliq/batch/export"), params);
    expect(protocol.status).toBe(200);
    expect((await protocol.json()).batch).toMatchObject({ status, sourceHash: before.sourceHash, result: before.result });
    const list = await getBatch(new NextRequest(`http://localhost/api/import/soliq?periodId=${periodId}`));
    expect(await list.json()).toMatchObject({ archives: [{ id: batchId, sourceName: "synthetic.xlsx", status }] });
    expect(await client.soliqImportBatch.findUniqueOrThrow({ where: { id: batchId } })).toEqual(before);
    const ownOrg = state.orgId;
    state.orgId = "foreign";
    try {
      expect((await exportBatch(new NextRequest("http://localhost/api/import/soliq/batch/export"), params)).status).toBe(404);
    } finally {
      state.orgId = ownOrg;
    }
  });

  it("reapplies the raw migration without changing READY, POSTED or CANCELLED records", async () => {
    const item = await openAdvance();
    const postedId = await prepareBatch(item.id);
    const cancelledId = await prepareBatch("cancelled-source");
    await prepareBatch("unfinished-source");
    expect((await complete(postedId, item.id)).status).toBe(200);
    expect((await discard(cancelledId)).status).toBe(200);
    const before = await client.soliqImportBatch.findMany({ where: { orgId: state.orgId }, orderBy: { id: "asc" } });
    expect(before.map(batch => batch.status).sort()).toEqual(["CANCELLED", "POSTED", "READY"]);
    for (const attempt of [1, 2]) {
      execFileSync(process.execPath, [resolve("node_modules/prisma/build/index.js"), "db", "execute",
        "--url", databaseUrl!, "--file", resolve("prisma/migrations/20260910_soliq_import_batch.sql")],
      { timeout: 20000, env: { ...process.env, DATABASE_URL: databaseUrl!, NODE_OPTIONS: "--max-old-space-size=256" } });
      expect(await client.soliqImportBatch.findMany({ where: { orgId: state.orgId }, orderBy: { id: "asc" } }),
        `migration attempt ${attempt}`).toEqual(before);
    }
    await expect(client.soliqImportBatch.update({ where: { id: postedId }, data: { result: {} } })).rejects.toThrow(/immutable/);
    await expect(client.soliqImportBatch.update({ where: { id: cancelledId }, data: { result: {} } })).rejects.toThrow(/immutable/);
  }, 45000);

  it("refuses cancellation after period locking", async () => {
    const item = await openAdvance();
    const batchId = await prepareBatch(item.id);
    await client.period.update({ where: { id: periodId }, data: { lockDate: new Date() } });
    expect((await discard(batchId)).status).toBe(400);
    expect((await client.soliqImportBatch.findUniqueOrThrow({ where: { id: batchId } })).status).toBe("READY");
  });

  it("refuses a batch from another period and a cross-organization period FK", async () => {
    const item = await openAdvance();
    const batchId = await prepareBatch(item.id);
    const later = await client.period.create({ data: { orgId: state.orgId, year: 2026, month: 10 } });
    expect((await complete(batchId, item.id, later.id)).status).toBe(400);
    const foreign = await client.organization.create({ data: { name: "Foreign synthetic tenant" } });
    try {
      await expect(client.soliqImportBatch.create({ data: {
        orgId: foreign.id, periodId, sourceName: "test", sourceHash: "test", sourceData: Buffer.from("test"),
        parserVersion: "soliq-v1", rows: [], totals: {}, createdBy: "test",
      } })).rejects.toMatchObject({ code: "P2003" });
      state.orgId = foreign.id;
      expect((await complete(batchId, item.id)).status).toBe(404);
      expect((await discard(batchId)).status).toBe(404);
    } finally {
      state.orgId = item.orgId;
      await client.organization.delete({ where: { id: foreign.id } });
    }
    expect(await client.document.count({ where: { orgId: state.orgId } })).toBe(1);
  });
});
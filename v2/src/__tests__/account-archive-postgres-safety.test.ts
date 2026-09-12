import { createHash, randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as accounts } from "@/app/api/accounts/route";
import { GET as list } from "@/app/api/import/bank/batches/route";
import { GET as download } from "@/app/api/import/bank/batches/[batchId]/export/route";

const fixture = vi.hoisted(() => ({ client: null as PrismaClient | null, orgId: "" }));
vi.mock("@/lib/context", () => ({
  getActiveOrgId: async () => fixture.orgId,
  getActiveMembership: async () => ({ orgId: fixture.orgId, role: "VIEWER" }),
}));
vi.mock("@/lib/prisma", () => ({
  prismaWithOrg: () => fixture.client!,
  default: {
    get account() { return fixture.client!.account; },
    get bankAccount() { return fixture.client!.bankAccount; },
    get bankImportBatch() { return fixture.client!.bankImportBatch; },
  },
}));

const databaseUrl = process.env.ACC_TEST_DATABASE_URL;
if (databaseUrl) {
  const parsed = new URL(databaseUrl);
  if (parsed.hostname !== "127.0.0.1" || parsed.pathname !== "/contador_safety_test") {
    throw new Error("ACC_TEST_DATABASE_URL must target the disposable loopback contador_safety_test database");
  }
}

describe.skipIf(!databaseUrl)("tenant account and archive reads on disposable PostgreSQL", () => {
  const client = new PrismaClient({ datasourceUrl: databaseUrl });
  const prefix = `archive-read-${randomUUID()}`;
  const orgIds = [`${prefix}-own`, `${prefix}-other`];
  const accountId = `${prefix}-account`;
  const typeId = `${prefix}-type`;
  const bankIds = orgIds.map(orgId => `${orgId}-bank`);
  const sourceData = Buffer.from([49, 67, 192, 224, 13, 10]);
  const sourceHash = createHash("sha256").update(sourceData).digest("hex");
  const listRequest = (bankId = bankIds[0], cursor?: string) => list(new NextRequest(`http://localhost/api/import/bank/batches?${new URLSearchParams({ bankAccountId: bankId, ...(cursor ? { cursor } : {}) })}`));
  const exportRequest = (batchId: string, format: string) => download(new NextRequest(`http://localhost/api/import/bank/batches/${batchId}/export?format=${format}`), { params: Promise.resolve({ batchId }) });

  beforeAll(async () => {
    fixture.client = client;
    await client.account.create({ data: { id: accountId, code: prefix, name: "Synthetic shared account", type: "ASSET" } });
    await client.documentType.create({ data: { id: typeId, code: typeId, name: "Synthetic archive read", postingTemplate: {} } });
    for (const [index, orgId] of orgIds.entries()) {
      await client.organization.create({ data: { id: orgId, name: "Synthetic archive read" } });
      const period = await client.period.create({ data: { orgId, year: 2026, month: 9 } });
      const document = await client.document.create({ data: { orgId, periodId: period.id, typeId, date: new Date("2026-09-01T00:00:00Z"), payload: {} } });
      await client.journalEntry.create({ data: { documentId: document.id, accountId, date: document.date, debit: "100.00", credit: "0.00" } });
      await client.openItem.create({ data: { orgId, accountId, openingDocumentId: document.id, dateOpened: document.date, amount: "100.00" } });
      const accountNumber = "20208000000000000001";
      await client.bankAccount.create({ data: { id: bankIds[index], orgId, name: "Synthetic bank", currency: "UZS", accountNumber } });
      await client.bankImportBatch.createMany({ data: Array.from({ length: index === 0 ? 21 : 1 }, (_, row) => ({
        id: `${orgId}-batch-${String(row).padStart(2, "0")}`, orgId, bankAccountId: bankIds[index], bankCurrency: "UZS",
        sourceName: "original.txt", sourceData, sourceHash, parserVersion: "1c-bank-v1", createdBy: "synthetic-actor",
        createdAt: new Date("2026-09-11T00:00:00Z"), rows: [{ amount: "9007199254740993.27" }],
        statement: { accountNumber, periodStart: "2026-09-01", periodEnd: "2026-09-30", openingBalance: "0.00", closingBalance: "9007199254740993.27", credits: "9007199254740993.27", debits: "0.00", rowCount: 1 },
        result: { oldValue: {}, newValue: {} },
      })) });
    }
  });
  beforeEach(() => { fixture.orgId = orgIds[0]; });
  afterAll(async () => {
    try {
      await client.bankImportBatch.deleteMany({ where: { orgId: { in: orgIds } } });
      await client.organization.deleteMany({ where: { id: { in: orgIds } } });
      await client.documentType.deleteMany({ where: { id: typeId } });
      await client.account.deleteMany({ where: { id: accountId } });
    } finally { await client.$disconnect(); }
  });

  it("counts only own ledger and debts on a shared account", async () => {
    for (const orgId of orgIds) {
      fixture.orgId = orgId;
      const response = await accounts(new NextRequest(`http://localhost/api/accounts?search=${encodeURIComponent(prefix)}`));
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual([expect.objectContaining({ id: accountId, usageCount: 2, _count: { journalEntries: 1, openItems: 1 } })]);
    }
  });
  it("paginates equal timestamps without duplicates or foreign rows", async () => {
    const first = await (await listRequest()).json();
    const second = await (await listRequest(bankIds[0], first.nextCursor)).json();
    expect(first.batches).toHaveLength(20);
    expect(second.batches).toHaveLength(1);
    expect(second.nextCursor).toBeNull();
    const combined = [...first.batches, ...second.batches];
    expect(new Set(combined.map(batch => batch.id)).size).toBe(21);
    expect(combined.every(batch => batch.bankAccountId === bankIds[0] && !batch.sourceData && !batch.rows)).toBe(true);
  });
  it("rejects foreign bank, cursor and direct exports", async () => {
    const foreignId = `${orgIds[1]}-batch-00`;
    expect((await listRequest(bankIds[1])).status).toBe(404);
    expect((await listRequest(bankIds[0], foreignId)).status).toBe(404);
    expect((await exportRequest(foreignId, "source")).status).toBe(404);
    expect((await exportRequest(foreignId, "protocol")).status).toBe(404);
  });
  it("returns exact persisted bytes and decimal protocol after rollback", async () => {
    const batchId = `${orgIds[0]}-batch-00`;
    await client.bankImportBatch.update({ where: { id: batchId }, data: {
      status: "ROLLED_BACK", rolledBackAt: new Date("2026-09-11T01:00:00Z"), rolledBackBy: "synthetic-admin", rollbackAuditId: "synthetic-audit",
    } });
    const before = await client.bankImportBatch.findUniqueOrThrow({ where: { id: batchId } });
    const original = await exportRequest(batchId, "source");
    expect(original.status).toBe(200);
    expect(Buffer.from(await original.arrayBuffer())).toEqual(sourceData);
    const protocol = await exportRequest(batchId, "protocol");
    expect(protocol.status).toBe(200);
    expect(await protocol.json()).toMatchObject({ exportVersion: "bank-audit-v1", batch: {
      sourceHash, status: "ROLLED_BACK", rows: [{ amount: "9007199254740993.27" }], rollbackAuditId: "synthetic-audit",
    } });
    expect(await client.bankImportBatch.findUniqueOrThrow({ where: { id: batchId } })).toEqual(before);
  });
});
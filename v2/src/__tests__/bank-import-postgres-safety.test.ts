import { createHash, randomUUID } from "node:crypto";
import { PrismaClient, type Prisma } from "@prisma/client";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as importBank } from "@/app/api/import/bank/route";
import { DELETE as rollbackBank } from "@/app/api/import/bank/rollback/route";
import { finalizePeriod } from "@/lib/closing";
import type { ParsedTransaction } from "@/lib/parsers/types";
import Decimal from "decimal.js";

const { fixture } = vi.hoisted(() => ({ fixture: {
  client: null as PrismaClient | null, orgId: "", failBalance: false, failRollbackAudit: false, role: "OWNER",
  failArchive: false, parsedOpening: "0.00", parsedClosing: "0.00",
  periodStart: "2026-08-31T19:00:00Z", periodEnd: "2026-09-30T18:59:59Z",
  afterRollbackRowsLock: null as null | (() => Promise<void>),
  statementAccountNumber: "00000000000000000001" as string | undefined,
  beforeImportTransaction: null as null | (() => Promise<void>),
  useRealParser: false,
  statementText: "1CClientBankExchange",
  rows: [] as ParsedTransaction[], openingBalance: undefined as number | undefined,
} }));
vi.mock("@/lib/context", () => ({ getActiveMembership: async () => ({
  orgId: fixture.orgId, userId: "synthetic-user", role: fixture.role,
}) }));
vi.mock("@/lib/parsers/parser1c", async importOriginal => {
  const original = await importOriginal<typeof import("@/lib/parsers/parser1c")>();
  return { ...original, parse1CExchange: (buffer: Buffer) => fixture.useRealParser ? original.parse1CExchange(buffer) : ({
    transactions: fixture.rows, openingBalance: fixture.parsedOpening, closingBalance: fixture.parsedClosing,
    periodStart: new Date(fixture.periodStart), periodEnd: new Date(fixture.periodEnd),
    accountNumber: fixture.statementAccountNumber,
  }) };
});
vi.mock("@/lib/parsers/parserBankExcel", () => ({ parseBankExcel: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ default: {
  bankAccount: { findFirst: (args: any) => fixture.client!.bankAccount.findFirst(args) },
  $transaction: async (callback: (transaction: any) => Promise<any>, options: any) => {
    await fixture.beforeImportTransaction?.();
    return fixture.client!.$transaction(async (transaction) => callback(new Proxy(transaction, {
      get(target, key) {
        if (key === "bankImportBatch" && fixture.failArchive) {
          return new Proxy(target.bankImportBatch, { get(model, method) {
            if (method === "create" || method === "update") return () => { throw new Error("injected archive failure"); };
            return Reflect.get(model, method);
          } });
        }
        if (key === "$queryRaw") return async (...args: any[]) => {
          const result = await (target.$queryRaw as any)(...args);
          if (String(args[0][0]).startsWith('SELECT "id" FROM "StagedTransaction"')) await fixture.afterRollbackRowsLock?.();
          return result;
        };
        if (key === "auditLog" && fixture.failRollbackAudit) {
          return new Proxy(target.auditLog, { get(model, method) {
            if (method === "create") return () => { throw new Error("injected rollback audit failure"); };
            return Reflect.get(model, method);
          } });
        }
        if (key === "bankAccount" && fixture.failBalance) {
          return new Proxy(target.bankAccount, { get(model, method) {
            if (method === "update") return () => { throw new Error("injected balance failure"); };
            return Reflect.get(model, method);
          } });
        }
        return Reflect.get(target, key);
      },
    })), options);
  },
} }));

const databaseUrl = process.env.ACC_TEST_DATABASE_URL;
if (databaseUrl) {
  const parsed = new URL(databaseUrl);
  if (parsed.hostname !== "127.0.0.1" || parsed.pathname !== "/contador_safety_test") {
    throw new Error("ACC_TEST_DATABASE_URL must target the disposable loopback contador_safety_test database");
  }
}

describe.skipIf(!databaseUrl)("bank import on disposable PostgreSQL", () => {
  const client = new PrismaClient({ datasourceUrl: databaseUrl });
  const orgIds: string[] = [];
  const createdTypeIds: string[] = [];
  let bankAccountId: string;
  let resultAccountId: string | undefined;
  const row = (amount: number, description: string): ParsedTransaction => ({
    date: new Date("2026-08-31T19:00:00Z"), amount, direction: "CREDIT", description,
  });
  const upload = async (preview = false) => {
    if (!fixture.useRealParser) {
      const bank = await bankState();
      fixture.parsedOpening = new Decimal(fixture.openingBalance ?? bank.lastBalance.toString()).toFixed(2);
      const delta = fixture.rows.reduce((total, transaction) => {
        const cents = BigInt(new Decimal(transaction.amount).toFixed(2).replace(".", ""));
        return total + (transaction.direction === "CREDIT" ? cents : -cents);
      }, BigInt(0));
      fixture.parsedClosing = new Decimal((BigInt(fixture.parsedOpening.replace(".", "")) + delta).toString()).div(100).toFixed(2);
    }
    const data = new FormData();
    data.set("bankAccountId", bankAccountId);
    data.set("confirmedCurrency", "UZS");
    data.set("parserType", "1C");
    data.set("file", new File([fixture.statementText], "synthetic.txt"));
    return importBank(new NextRequest(`http://localhost/api/import/bank${preview ? "?preview=true" : ""}`, { method: "POST", body: data }));
  };
  const rollback = (batchId: string) => rollbackBank(new NextRequest("http://localhost/api/import/bank/rollback", {
    method: "DELETE", body: JSON.stringify({ batchId }),
  }));
  const bankState = () => client.bankAccount.findUniqueOrThrow({ where: { id: bankAccountId } });
  const nextMockPeriod = () => {
    fixture.periodStart = "2026-09-30T19:00:00Z";
    fixture.periodEnd = "2026-10-31T18:59:59Z";
    fixture.rows = fixture.rows.map(transaction => ({ ...transaction, date: new Date(fixture.periodStart) }));
  };

  beforeAll(async () => {
    fixture.client = client;
    if (!await client.account.findUnique({ where: { code: "9910" } })) {
      resultAccountId = (await client.account.create({ data: {
        code: "9910", name: "Synthetic final result", type: "ACTIVE_PASSIVE",
      } })).id;
    }
  });

  beforeEach(async () => {
    fixture.orgId = `bank-import-${randomUUID()}`;
    orgIds.push(fixture.orgId);
    fixture.failBalance = false;
    fixture.failRollbackAudit = false;
    fixture.failArchive = false;
    fixture.periodStart = "2026-08-31T19:00:00Z";
    fixture.periodEnd = "2026-09-30T18:59:59Z";
    fixture.role = "OWNER";
    fixture.afterRollbackRowsLock = null;
    fixture.beforeImportTransaction = null;
    fixture.useRealParser = false;
    fixture.statementText = "1CClientBankExchange";
    fixture.statementAccountNumber = "00000000000000000001";
    fixture.rows = [row(0.1, "first"), row(0.2, "second")];
    fixture.openingBalance = undefined;
    await client.organization.create({ data: { id: fixture.orgId, name: "Synthetic bank import" } });
    bankAccountId = (await client.bankAccount.create({ data: {
      orgId: fixture.orgId, name: "Synthetic bank", accountNumber: fixture.statementAccountNumber,
    } })).id;
  });

  afterAll(async () => {
    try {
      await client.stagedTransaction.deleteMany({ where: { orgId: { in: orgIds } } });
      await client.bankImportBatch.deleteMany({ where: { orgId: { in: orgIds } } });
      await client.organization.deleteMany({ where: { id: { in: orgIds } } });
      await client.documentType.deleteMany({ where: { id: { in: createdTypeIds } } });
      if (resultAccountId) await client.account.delete({ where: { id: resultAccountId } });
    } finally {
      await client.$disconnect();
    }
  });

  it("stores a complete batch and exact balance in the Tashkent period", async () => {
    fixture.openingBalance = 10.1;
    const response = await upload();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.imported).toBe(2);
    const rows = await client.stagedTransaction.findMany({ where: { orgId: fixture.orgId }, include: { period: true } });
    expect(rows).toHaveLength(2);
    expect(rows.every((item) => item.importBatchId === body.importBatchId && item.period.month === 9)).toBe(true);
    expect((await client.bankAccount.findUniqueOrThrow({ where: { id: bankAccountId } })).lastBalance.toString()).toBe("10.4");
    expect(await client.auditLog.count({ where: { orgId: fixture.orgId, action: "IMPORT_BANK" } })).toBe(1);
  });

  it("handles duplicates without aborting the transaction or changing the balance", async () => {
    await upload();
    const response = await upload();
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ imported: 0, duplicates: 2 });
    expect(await client.stagedTransaction.count({ where: { orgId: fixture.orgId } })).toBe(2);
    expect((await client.bankAccount.findUniqueOrThrow({ where: { id: bankAccountId } })).lastBalance.toString()).toBe("0.3");
  });

  it.each([false, true])("refuses a different statement account before any writes (preview=%s)", async preview => {
    fixture.statementAccountNumber = "00000000000000000002";
    const before = await bankState();
    const response = await upload(preview);
    expect(response.status).toBe(422);
    expect((await response.json()).code).toBe("BANK_STATEMENT_INVALID");
    expect(await bankState()).toEqual(before);
    expect(await client.period.count({ where: { orgId: fixture.orgId } })).toBe(0);
    expect(await client.stagedTransaction.count({ where: { orgId: fixture.orgId } })).toBe(0);
    expect(await client.auditLog.count({ where: { orgId: fixture.orgId } })).toBe(0);
  });

  it.each(["statement", "bank"])("refuses a missing %s account number", async target => {
    if (target === "statement") fixture.statementAccountNumber = undefined;
    else await client.bankAccount.update({ where: { id: bankAccountId }, data: { accountNumber: null } });
    expect((await upload()).status).toBe(422);
    expect(await client.stagedTransaction.count({ where: { orgId: fixture.orgId } })).toBe(0);
  });

  it("rechecks the account number under the bank lock", async () => {
    fixture.beforeImportTransaction = async () => {
      await client.bankAccount.update({ where: { id: bankAccountId }, data: { accountNumber: "00000000000000000002" } });
    };
    expect((await upload()).status).toBe(422);
    expect(await client.stagedTransaction.count({ where: { orgId: fixture.orgId } })).toBe(0);
    expect(await client.period.count({ where: { orgId: fixture.orgId } })).toBe(0);
    expect((await bankState()).lastBalance.toString()).toBe("0");
  });

  it("rejects a currency change between the initial read and account lock", async () => {
    fixture.beforeImportTransaction = async () => {
      await client.bankAccount.update({ where: { id: bankAccountId }, data: { currency: "USD" } });
    };
    expect((await upload()).status).toBe(422);
    expect(await client.stagedTransaction.count({ where: { orgId: fixture.orgId } })).toBe(0);
    expect(await client.period.count({ where: { orgId: fixture.orgId } })).toBe(0);
    expect(await client.bankImportBatch.count({ where: { orgId: fixture.orgId } })).toBe(0);
  });

  it("compares formatted account numbers without losing leading zeroes", async () => {
    fixture.statementAccountNumber = "00000 00000 00000 00001";
    expect((await upload()).status).toBe(200);
  });

  const useStatement = (amount = "0.10", opening = "100.00", closing = "100.10") => {
    fixture.useRealParser = true;
    fixture.statementText = [
      "1CClientBankExchange", "РасчСчет=00000000000000000001", "СекцияРасчСчет",
      "РасчСчет=00000000000000000001", "ДатаНачала=01.09.2026", "ДатаКонца=30.09.2026",
      `НачальныйОстаток=${opening}`, `КонечныйОстаток=${closing}`, "КонецРасчСчет",
      "СекцияДокумент=Платежное поручение", "Дата=10.09.2026", `Сумма=${amount}`,
      "ПлательщикРасчСчет=00000000000000000002", "ПолучательРасчСчет=00000000000000000001",
      "НазначениеПлатежа=Synthetic real parser", "КонецДокумента", "КонецФайла",
    ].join("\n");
  };

  const addDocumentNumber = (number = "0001") => {
    fixture.statementText = fixture.statementText.replace("Дата=10.09.2026", `Номер=${number}\nДата=10.09.2026`);
  };

  const nextRealStatement = () => {
    useStatement("0.10", "100.10", "100.20");
    fixture.statementText = fixture.statementText.replace("01.09.2026", "01.10.2026")
      .replace("30.09.2026", "31.10.2026").replace("10.09.2026", "10.10.2026");
  };

  const quietRealStatement = () => {
    nextRealStatement();
    fixture.statementText = fixture.statementText.split("СекцияДокумент=")[0].replace("КонечныйОстаток=100.20", "КонечныйОстаток=100.10") + "КонецФайла";
  };

  it("archives, deduplicates and rolls back a quiet period without synthetic operations", async () => {
    useStatement();
    expect((await upload()).status).toBe(200);
    const before = await bankState();
    quietRealStatement();
    const response = await upload();
    expect(response.status).toBe(200);
    const quiet = await response.json();
    expect(quiet).toMatchObject({ imported: 0, total: 0, emptyStatement: true });
    expect(quiet.importBatchId).toBeTruthy();
    expect(await client.stagedTransaction.count({ where: { orgId: fixture.orgId } })).toBe(1);
    const after = await bankState();
    expect(await (await upload()).json()).toMatchObject({ alreadyImported: true, importBatchId: null });
    expect(await bankState()).toEqual(after);
    expect(await (await rollback(quiet.importBatchId)).json()).toEqual({ deleted: 0 });
    expect(await bankState()).toEqual(before);
    expect((await client.bankImportBatch.findUniqueOrThrow({ where: { id: quiet.importBatchId } })).status).toBe("ROLLED_BACK");
    expect((await upload()).status).toBe(200);
    nextRealStatement();
    fixture.statementText = fixture.statementText.replaceAll("10.2026", "11.2026").replace("31.11.2026", "30.11.2026");
    expect((await upload()).status).toBe(200);
  });

  it("refuses quiet-period imports and rollbacks after the period is locked", async () => {
    useStatement();
    expect((await upload()).status).toBe(200);
    quietRealStatement();
    const period = await client.period.create({ data: { orgId: fixture.orgId, year: 2026, month: 10, status: "CLOSED" } });
    expect((await upload()).status).toBe(422);
    await client.period.update({ where: { id: period.id }, data: { status: "OPEN" } });
    const quiet = await (await upload()).json();
    await client.period.update({ where: { id: period.id }, data: { lockDate: new Date() } });
    const before = await bankState();
    expect((await rollback(quiet.importBatchId)).status).toBe(409);
    expect(await bankState()).toEqual(before);
  });

  it.each(["overlap", "gap", "missing-history", "opening"])("rejects %s before committing another source or balance", async broken => {
    useStatement();
    const { importBatchId } = await (await upload()).json();
    nextRealStatement();
    if (broken === "overlap") fixture.statementText = fixture.statementText.replace("01.10.2026", "30.09.2026");
    if (broken === "gap") fixture.statementText = fixture.statementText.replace("01.10.2026", "02.10.2026");
    if (broken === "opening") fixture.statementText = fixture.statementText.replace("Остаток=100.10", "Остаток=100.11").replace("Остаток=100.20", "Остаток=100.21");
    if (broken === "missing-history") await client.bankImportBatch.delete({ where: { id: importBatchId } });
    const before = await bankState();
    const response = await upload();
    expect(response.status).toBe(422);
    expect(await bankState()).toEqual(before);
    expect(await client.stagedTransaction.count({ where: { orgId: fixture.orgId } })).toBe(1);
    expect(await client.period.count({ where: { orgId: fixture.orgId } })).toBe(1);
    expect(await client.auditLog.count({ where: { orgId: fixture.orgId } })).toBe(1);
  });

  it("records the predecessor and restores it after rolling back the next real statement", async () => {
    useStatement();
    const first = await (await upload()).json();
    const before = await bankState();
    nextRealStatement();
    const response = await upload();
    expect(response.status).toBe(200);
    const next = await response.json();
    const archive = await client.bankImportBatch.findUniqueOrThrow({ where: { id: next.importBatchId } });
    expect(archive.result).toMatchObject({ newValue: { sequenceVersion: 1, previousBatchId: first.importBatchId } });
    expect((await rollback(next.importBatchId)).status).toBe(200);
    expect(await bankState()).toEqual(before);
    expect((await upload()).status).toBe(200);
  });

  it("serializes competing statements for the same next period", async () => {
    useStatement();
    expect((await upload()).status).toBe(200);
    nextRealStatement();
    const first = upload();
    fixture.statementText = fixture.statementText.replace("Synthetic real parser", "Different payment");
    const responses = await Promise.all([first, upload()]);
    expect(responses.map(response => response.status).sort()).toEqual([200, 422]);
    expect(await client.bankImportBatch.count({ where: { orgId: fixture.orgId } })).toBe(2);
    expect(await client.stagedTransaction.count({ where: { orgId: fixture.orgId } })).toBe(2);
    expect((await bankState()).lastBalance.toFixed(2)).toBe("100.20");
  });

  it.each(["number", "payer"])("keeps similar payments distinct by %s and deduplicates exact repeats", async field => {
    useStatement("0.10", "0.00", "0.10");
    addDocumentNumber();
    const start = fixture.statementText.indexOf("СекцияДокумент=");
    const document = fixture.statementText.slice(start, fixture.statementText.indexOf("КонецФайла"));
    const second = field === "number" ? document.replace("Номер=0001", "Номер=0002")
      : document.replace("ПлательщикРасчСчет=00000000000000000002", "ПлательщикРасчСчет=00000000000000000003");
    fixture.statementText = fixture.statementText.replace("КонецФайла", second + "КонецФайла").replace("КонечныйОстаток=0.10", "КонечныйОстаток=0.20");
    expect(await (await upload()).json()).toMatchObject({ imported: 2, duplicates: 0 });
    expect(await (await upload()).json()).toMatchObject({ imported: 0, duplicates: 2 });
    expect(await client.stagedTransaction.count({ where: { orgId: fixture.orgId } })).toBe(2);
    expect((await bankState()).lastBalance.toFixed(2)).toBe("0.20");
  });

  it.each(["amount", "description", "counterparty"])("rejects a changed %s for the same document reference", async field => {
    useStatement();
    addDocumentNumber();
    expect((await upload()).status).toBe(200);
    const before = await bankState();
    if (field === "amount") fixture.statementText = fixture.statementText.replace("Сумма=0.10", "Сумма=0.20").replace("КонечныйОстаток=100.10", "КонечныйОстаток=100.20");
    if (field === "description") fixture.statementText = fixture.statementText.replace("Synthetic real parser", "Changed purpose");
    if (field === "counterparty") fixture.statementText = fixture.statementText.replace("КонецДокумента", "ПлательщикИНН=123456789\nКонецДокумента");
    expect((await upload()).status).toBe(422);
    expect(await bankState()).toEqual(before);
    expect(await client.stagedTransaction.count({ where: { orgId: fixture.orgId } })).toBe(1);
    expect(await client.bankImportBatch.count({ where: { orgId: fixture.orgId } })).toBe(1);
  });

  it("refuses repeated document identity inside one file without partial writes", async () => {
    useStatement();
    addDocumentNumber();
    const document = fixture.statementText.slice(fixture.statementText.indexOf("СекцияДокумент="), fixture.statementText.indexOf("КонецФайла"));
    fixture.statementText = fixture.statementText.replace("КонецФайла", document + "КонецФайла").replace("КонечныйОстаток=100.10", "КонечныйОстаток=100.20");
    expect((await upload()).status).toBe(422);
    expect(await client.period.count({ where: { orgId: fixture.orgId } })).toBe(0);
    expect(await client.stagedTransaction.count({ where: { orgId: fixture.orgId } })).toBe(0);
  });

  it("does not silently upgrade an old operation to a numbered document", async () => {
    useStatement();
    expect((await upload()).status).toBe(200);
    addDocumentNumber();
    expect((await upload()).status).toBe(422);
    expect(await client.stagedTransaction.count({ where: { orgId: fixture.orgId } })).toBe(1);
  });

  it("requires the original archive when deduplicating a referenced document", async () => {
    useStatement();
    addDocumentNumber();
    const { importBatchId } = await (await upload()).json();
    await client.bankImportBatch.delete({ where: { id: importBatchId } });
    expect((await upload()).status).toBe(422);
    expect(await client.stagedTransaction.count({ where: { orgId: fixture.orgId } })).toBe(1);
  });

  it("imports and rolls back exact raw 1C bytes through the real parser", async () => {
    useStatement("9007199254740993.27", "0.00", "9007199254740993.27");
    const response = await upload();
    expect(response.status).toBe(200);
    const { importBatchId } = await response.json();
    const source = await client.stagedTransaction.findFirstOrThrow({ where: { orgId: fixture.orgId } });
    expect(source.amount.toFixed(2)).toBe("9007199254740993.27");
    expect((await bankState()).lastBalance.toFixed(2)).toBe("9007199254740993.27");
    const archive = await client.bankImportBatch.findUniqueOrThrow({ where: { id: importBatchId } });
    expect(Buffer.from(archive.sourceData)).toEqual(Buffer.from(fixture.statementText));
    expect(archive.rows).toEqual([expect.objectContaining({ amount: "9007199254740993.27" })]);
    expect((await rollback(importBatchId)).status).toBe(200);
    expect((await bankState()).lastBalance.toFixed(2)).toBe("0.00");
    const after = await client.bankImportBatch.findUniqueOrThrow({ where: { id: importBatchId } });
    expect(after).toMatchObject({ ...archive, status: "ROLLED_BACK", rolledBackBy: "synthetic-user", rolledBackAt: expect.any(Date), rollbackAuditId: expect.any(String) });
  });

  it.each(["import", "rollback"])("rolls back all SQL writes when the %s archive write fails", async operation => {
    useStatement();
    const batchId = operation === "rollback" ? (await (await upload()).json()).importBatchId : null;
    const before = await bankState();
    const rows = await client.stagedTransaction.findMany({ where: { orgId: fixture.orgId } });
    const archives = await client.bankImportBatch.findMany({ where: { orgId: fixture.orgId } });
    const audits = await client.auditLog.findMany({ where: { orgId: fixture.orgId } });
    fixture.failArchive = true;
    expect((await (batchId ? rollback(batchId) : upload())).status).toBe(500);
    expect(await bankState()).toEqual(before);
    expect(await client.stagedTransaction.findMany({ where: { orgId: fixture.orgId } })).toEqual(rows);
    expect(await client.bankImportBatch.findMany({ where: { orgId: fixture.orgId } })).toEqual(archives);
    expect(await client.auditLog.findMany({ where: { orgId: fixture.orgId } })).toEqual(audits);
  });

  it.each([false, true])("requires an archive for marked batches while preserving legacy v2: %s", async legacy => {
    const { importBatchId } = await (await upload()).json();
    await client.bankImportBatch.delete({ where: { id: importBatchId } });
    if (legacy) {
      const audit = await client.auditLog.findFirstOrThrow({ where: { orgId: fixture.orgId, action: "IMPORT_BANK" } });
      const { bankBatchVersion, ...newValue } = audit.newValue as Record<string, any>;
      expect(bankBatchVersion).toBe(1);
      await client.auditLog.update({ where: { id: audit.id }, data: { newValue } });
    }
    expect((await rollback(importBatchId)).status).toBe(legacy ? 200 : 409);
    expect(await client.stagedTransaction.count({ where: { orgId: fixture.orgId } })).toBe(legacy ? 0 : 2);
  });

  it("rejects source rewriting and invalid hashes in SQL", async () => {
    const { importBatchId } = await (await upload()).json();
    const archive = await client.bankImportBatch.findUniqueOrThrow({ where: { id: importBatchId } });
    await expect(client.bankImportBatch.update({ where: { id: importBatchId }, data: { sourceName: "changed" } })).rejects.toThrow(/cannot be rewritten/);
    await expect(client.bankImportBatch.create({ data: {
      ...archive, id: randomUUID(), sourceHash: "invalid",
      rows: archive.rows as Prisma.InputJsonValue,
      statement: archive.statement as Prisma.InputJsonValue,
      result: archive.result as Prisma.InputJsonValue,
    } })).rejects.toThrow(/source_check/);
    expect(await client.bankImportBatch.findUniqueOrThrow({ where: { id: importBatchId } })).toEqual(archive);
  });

  it("returns exact string amounts in preview without creating a period", async () => {
    useStatement("9007199254740993.27", "0.00", "9007199254740993.27");
    const response = await upload(true);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ transactions: [{ amount: "9007199254740993.27" }], closingBalance: "9007199254740993.27" });
    expect(await client.period.count({ where: { orgId: fixture.orgId } })).toBe(0);
  });

  it.each(["wrong-account", "invalid-date", "invalid-amount", "control-balance", "truncated"])("rejects invalid raw 1C %s without partial writes", async invalid => {
    useStatement();
    const replacements: Record<string, [string, string]> = {
      "wrong-account": ["00000000000000000001", "00000000000000000003"],
      "invalid-date": ["Дата=10.09.2026", "Дата=31.09.2026"],
      "invalid-amount": ["Сумма=0.10", "Сумма=0.10invalid"],
      "control-balance": ["КонечныйОстаток=100.10", "КонечныйОстаток=100.11"],
      truncated: ["КонецДокумента", ""],
    };
    fixture.statementText = fixture.statementText.replaceAll(...replacements[invalid]);
    const before = await bankState();
    const response = await upload();
    expect(response.status).toBe(422);
    expect((await response.json()).code).toBe("BANK_STATEMENT_INVALID");
    expect(await bankState()).toEqual(before);
    expect(await client.stagedTransaction.count({ where: { orgId: fixture.orgId } })).toBe(0);
    expect(await client.period.count({ where: { orgId: fixture.orgId } })).toBe(0);
    expect(await client.auditLog.count({ where: { orgId: fixture.orgId } })).toBe(0);
  });

  it("rolls back all writes when a valid statement does not reconcile to an already-synced bank", async () => {
    useStatement();
    await client.bankAccount.update({ where: { id: bankAccountId }, data: { lastBalance: "99.99", lastSyncedAt: new Date("2026-08-31T18:00:00Z") } });
    const before = await bankState();
    expect((await upload()).status).toBe(422);
    expect(await bankState()).toEqual(before);
    expect(await client.stagedTransaction.count({ where: { orgId: fixture.orgId } })).toBe(0);
    expect(await client.period.count({ where: { orgId: fixture.orgId } })).toBe(0);
    expect(await client.auditLog.count({ where: { orgId: fixture.orgId } })).toBe(0);
  });

  it.each(["file-text", "bank-file", "duplicate-file", "empty-file", "oversize-file", "unknown-parser", "excel"])("rejects invalid or unsupported upload %s", async input => {
    const data = new FormData();
    data.set("bankAccountId", bankAccountId);
    data.set("file", new File(["1CClientBankExchange"], "synthetic.txt"));
    if (input === "file-text") data.set("file", "not a file");
    if (input === "bank-file") data.set("bankAccountId", new File(["bank"], "bank.txt"));
    if (input === "duplicate-file") data.append("file", new File(["extra"], "extra.txt"));
    if (input === "empty-file") data.set("file", new File([], "empty.txt"));
    if (input === "oversize-file") data.set("file", new File([new Uint8Array(5 * 1024 * 1024 + 1)], "large.txt"));
    if (input === "unknown-parser") data.set("parserType", "unknown");
    if (input === "excel") data.set("parserType", "Asaka");
    const response = await importBank(new NextRequest("http://localhost/api/import/bank", { method: "POST", body: data }));
    expect(response.status).toBe(input === "oversize-file" ? 413 : input === "excel" ? 422 : 400);
    expect(await client.stagedTransaction.count({ where: { orgId: fixture.orgId } })).toBe(0);
    expect(await client.period.count({ where: { orgId: fixture.orgId } })).toBe(0);
  });

  it("records a versioned rollback snapshot including the pre-seed balance and sync time", async () => {
    fixture.openingBalance = 10.1;
    const response = await upload();
    expect(response.status).toBe(200);
    const body = await response.json();
    const audit = await client.auditLog.findFirstOrThrow({ where: { orgId: fixture.orgId, action: "IMPORT_BANK" } });
    const bank = await client.bankAccount.findUniqueOrThrow({ where: { id: bankAccountId } });
    expect(audit.oldValue).toEqual({ lastBalance: "0.00", lastSyncedAt: null, currency: "UZS", accountNumber: "00000000000000000001" });
    expect(audit.newValue).toMatchObject({
      lastBalance: "10.40", lastSyncedAt: bank.lastSyncedAt!.toISOString(), currency: "UZS", accountNumber: "00000000000000000001",
      imported: 2, importBatchId: body.importBatchId, rollbackVersion: 2, sourceHash: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
  });

  it("rolls back the complete first-import state and retains deleted rows in one audit", async () => {
    fixture.openingBalance = 10.1;
    const before = await bankState();
    const { importBatchId } = await (await upload()).json();
    expect((await bankState()).lastBalance.toString()).toBe("10.4");
    expect(await (await rollback(importBatchId)).json()).toEqual({ deleted: 2 });
    const after = await bankState();
    expect(after.lastBalance).toEqual(before.lastBalance);
    expect(after.lastSyncedAt).toBeNull();
    expect(await client.stagedTransaction.count({ where: { orgId: fixture.orgId } })).toBe(0);
    const audit = await client.auditLog.findFirstOrThrow({ where: { orgId: fixture.orgId, action: "ROLLBACK_IMPORT_BANK" } });
    expect(audit.userId).toBe("synthetic-user");
    expect(audit.oldValue).toMatchObject({ transactions: expect.arrayContaining([
      expect.objectContaining({ amount: "0.10", description: "first" }),
      expect.objectContaining({ amount: "0.20", description: "second" }),
    ]) });
    expect(audit.newValue).toMatchObject({ lastBalance: "0.00", lastSyncedAt: null, accountNumber: "00000000000000000001", importBatchId, deleted: 2 });
    expect((await rollback(importBatchId)).status).toBe(404);
    expect(await client.auditLog.count({ where: { orgId: fixture.orgId, action: "ROLLBACK_IMPORT_BANK" } })).toBe(1);
  });

  it("restores balances beyond Number precision and the previous sync timestamp", async () => {
    fixture.rows = [{ ...row(1, "initial"), amount: "9007199254740993.27" }];
    expect((await upload()).status).toBe(200);
    const { lastSyncedAt } = await bankState();
    fixture.rows = [row(0.1, "first"), row(0.2, "second")];
    nextMockPeriod();
    const { importBatchId } = await (await upload()).json();
    expect((await bankState()).lastBalance.toFixed(2)).toBe("9007199254740993.57");
    expect((await rollback(importBatchId)).status).toBe(200);
    expect((await bankState()).lastBalance.toFixed(2)).toBe("9007199254740993.27");
    expect((await bankState()).lastSyncedAt).toEqual(lastSyncedAt);
  });

  it.each(["balance", "audit"])("rolls back all deletion writes if %s update fails", async failure => {
    const { importBatchId } = await (await upload()).json();
    const before = await bankState();
    fixture.failBalance = failure === "balance";
    fixture.failRollbackAudit = failure === "audit";
    expect((await rollback(importBatchId)).status).toBe(500);
    expect(await bankState()).toEqual(before);
    expect(await client.stagedTransaction.count({ where: { orgId: fixture.orgId } })).toBe(2);
    expect(await client.auditLog.count({ where: { orgId: fixture.orgId, action: "ROLLBACK_IMPORT_BANK" } })).toBe(0);
    fixture.failBalance = false;
    fixture.failRollbackAudit = false;
    expect((await rollback(importBatchId)).status).toBe(200);
  });

  it("serializes concurrent rollbacks and restores the balance once", async () => {
    const { importBatchId } = await (await upload()).json();
    const responses = await Promise.all([rollback(importBatchId), rollback(importBatchId)]);
    expect(responses.map(response => response.status).sort()).toEqual([200, 404]);
    expect((await bankState()).lastBalance.toFixed(2)).toBe("0.00");
    expect(await client.auditLog.count({ where: { orgId: fixture.orgId, action: "ROLLBACK_IMPORT_BANK" } })).toBe(1);
  });

  it("refuses legacy imports without a complete snapshot", async () => {
    const { importBatchId } = await (await upload()).json();
    const audit = await client.auditLog.findFirstOrThrow({ where: { orgId: fixture.orgId, action: "IMPORT_BANK" } });
    await client.auditLog.update({ where: { id: audit.id }, data: { newValue: { importBatchId, lastBalance: "0.30", imported: 2 } } });
    const before = await bankState();
    const response = await rollback(importBatchId);
    expect(response.status).toBe(409);
    expect((await response.json()).code).toBe("BATCH_REQUIRES_REVIEW");
    expect(await bankState()).toEqual(before);
    expect(await client.stagedTransaction.count({ where: { orgId: fixture.orgId } })).toBe(2);
  });

  it.each(["amount", "direction", "description"])("refuses a changed source %s despite IMPORTED status", async field => {
    const { importBatchId } = await (await upload()).json();
    const source = await client.stagedTransaction.findFirstOrThrow({ where: { orgId: fixture.orgId } });
    await client.stagedTransaction.update({ where: { id: source.id }, data:
      field === "amount" ? { amount: "0.11" } : field === "direction" ? { direction: "DEBIT" } : { description: "changed" },
    });
    const before = await bankState();
    expect((await rollback(importBatchId)).status).toBe(409);
    expect(await bankState()).toEqual(before);
    expect(await client.stagedTransaction.count({ where: { orgId: fixture.orgId } })).toBe(2);
  });

  it.each(["balance", "currency", "sync"])("refuses changed bank %s", async field => {
    const { importBatchId } = await (await upload()).json();
    await client.bankAccount.update({ where: { id: bankAccountId }, data:
      field === "balance" ? { lastBalance: "500" } : field === "currency" ? { currency: "USD" } : { lastSyncedAt: new Date("2026-01-01T00:00:00Z") },
    });
    const before = await bankState();
    expect((await rollback(importBatchId)).status).toBe(409);
    expect(await bankState()).toEqual(before);
    expect(await client.stagedTransaction.count({ where: { orgId: fixture.orgId } })).toBe(2);
  });

  it("refuses rollback of an earlier import after a subsequent import", async () => {
    const first = await (await upload()).json();
    fixture.rows = [row(1, "later")];
    nextMockPeriod();
    expect((await upload()).status).toBe(200);
    const before = await bankState();
    expect((await rollback(first.importBatchId)).status).toBe(409);
    expect(await bankState()).toEqual(before);
    expect(await client.stagedTransaction.count({ where: { orgId: fixture.orgId } })).toBe(3);
  });

  it.each(["00000000000000000002", null, ""])("refuses rollback when bank number changed to %s", async accountNumber => {
    const { importBatchId } = await (await upload()).json();
    await client.bankAccount.update({ where: { id: bankAccountId }, data: { accountNumber } });
    const before = await bankState();
    const response = await rollback(importBatchId);
    expect(response.status).toBe(409);
    expect((await response.json()).code).toBe("BATCH_REQUIRES_REVIEW");
    expect(await bankState()).toEqual(before);
    expect(await client.stagedTransaction.count({ where: { orgId: fixture.orgId } })).toBe(2);
    expect(await client.auditLog.count({ where: { orgId: fixture.orgId, action: "ROLLBACK_IMPORT_BANK" } })).toBe(0);
  });

  it.each(["oldValue", "newValue"] as const)("requires a matching account number in %s", async field => {
    const { importBatchId } = await (await upload()).json();
    const audit = await client.auditLog.findFirstOrThrow({ where: { orgId: fixture.orgId, action: "IMPORT_BANK" } });
    await client.auditLog.update({ where: { id: audit.id }, data: {
      [field]: { ...audit[field] as Record<string, any>, accountNumber: "00000000000000000002" },
    } });
    const before = await bankState();
    expect((await rollback(importBatchId)).status).toBe(409);
    expect(await bankState()).toEqual(before);
    expect(await client.stagedTransaction.count({ where: { orgId: fixture.orgId } })).toBe(2);
  });

  it.each([1, 3])("refuses unconfirmed snapshot version %s without upgrading history", async rollbackVersion => {
    const { importBatchId } = await (await upload()).json();
    const audit = await client.auditLog.findFirstOrThrow({ where: { orgId: fixture.orgId, action: "IMPORT_BANK" } });
    const { accountNumber: omittedNumber, ...oldSnapshot } = audit.oldValue as Record<string, any>;
    const { accountNumber: omittedNewNumber, ...newSnapshot } = audit.newValue as Record<string, any>;
    expect(omittedNumber).toBe(omittedNewNumber);
    await client.auditLog.update({ where: { id: audit.id }, data: {
      oldValue: rollbackVersion === 1 ? oldSnapshot : { ...oldSnapshot, accountNumber: omittedNumber },
      newValue: { ...newSnapshot, ...(rollbackVersion === 1 ? {} : { accountNumber: omittedNewNumber }), rollbackVersion },
    } });
    const before = await bankState();
    const auditsBefore = await client.auditLog.findMany({ where: { orgId: fixture.orgId } });
    expect((await rollback(importBatchId)).status).toBe(409);
    expect(await bankState()).toEqual(before);
    expect(await client.auditLog.findMany({ where: { orgId: fixture.orgId } })).toEqual(auditsBefore);
    expect(await client.stagedTransaction.count({ where: { orgId: fixture.orgId } })).toBe(2);
  });

  it("normalizes account spacing without replacing its identity on rollback", async () => {
    await client.bankAccount.update({ where: { id: bankAccountId }, data: { accountNumber: "00000 00000 00000 00001" } });
    const before = await bankState();
    const { importBatchId } = await (await upload()).json();
    expect((await rollback(importBatchId)).status).toBe(200);
    expect(await bankState()).toEqual(before);
  });

  it.each(["oldValue", "newValue"] as const)("refuses version 2 without account identity in %s", async field => {
    const { importBatchId } = await (await upload()).json();
    const audit = await client.auditLog.findFirstOrThrow({ where: { orgId: fixture.orgId, action: "IMPORT_BANK" } });
    const { accountNumber, ...withoutIdentity } = audit[field] as Record<string, any>;
    expect(accountNumber).toBe("00000000000000000001");
    await client.auditLog.update({ where: { id: audit.id }, data: { [field]: withoutIdentity } });
    const before = await bankState();
    expect((await rollback(importBatchId)).status).toBe(409);
    expect(await bankState()).toEqual(before);
    expect(await client.stagedTransaction.count({ where: { orgId: fixture.orgId } })).toBe(2);
    expect(await client.auditLog.count({ where: { orgId: fixture.orgId, action: "ROLLBACK_IMPORT_BANK" } })).toBe(0);
  });

  it("detects a dependent zero-delta import even with reversed audit timestamps and an equal sync timestamp", async () => {
    const first = await (await upload()).json();
    const before = await bankState();
    const firstAudit = await client.auditLog.findFirstOrThrow({ where: { orgId: fixture.orgId, action: "IMPORT_BANK" } });
    fixture.rows = [row(1, "later-credit"), { ...row(1, "later-debit"), direction: "DEBIT" }];
    nextMockPeriod();
    const later = await (await upload()).json();
    const laterAudit = await client.auditLog.findFirstOrThrow({ where: {
      orgId: fixture.orgId, newValue: { path: ["importBatchId"], equals: later.importBatchId },
    } });
    await client.auditLog.update({ where: { id: laterAudit.id }, data: {
      createdAt: new Date(firstAudit.createdAt.getTime() - 1000),
      newValue: { ...laterAudit.newValue as Record<string, any>, lastSyncedAt: before.lastSyncedAt!.toISOString() },
    } });
    await client.bankAccount.update({ where: { id: bankAccountId }, data: { lastSyncedAt: before.lastSyncedAt } });
    expect((await rollback(first.importBatchId)).status).toBe(409);
    expect(await bankState()).toEqual(before);
    expect(await client.stagedTransaction.count({ where: { orgId: fixture.orgId } })).toBe(4);
  });

  it("restores only the latest import, leaving the previous batch and its exact bank state", async () => {
    const first = await (await upload()).json();
    const previous = await bankState();
    await client.auditLog.updateMany({ where: { orgId: fixture.orgId }, data: { createdAt: new Date("2026-01-01T00:00:00Z") } });
    fixture.rows = [row(1, "later")];
    nextMockPeriod();
    const latest = await (await upload()).json();
    expect((await rollback(latest.importBatchId)).status).toBe(200);
    expect(await bankState()).toEqual(previous);
    expect(await client.stagedTransaction.count({ where: { orgId: fixture.orgId, importBatchId: first.importBatchId } })).toBe(2);
    expect((await rollback(first.importBatchId)).status).toBe(409);
  });

  it.each(["classification", "bank"])("blocks concurrent %s mutation during rollback", async target => {
    const { importBatchId } = await (await upload()).json();
    const source = await client.stagedTransaction.findFirstOrThrow({ where: { orgId: fixture.orgId } });
    fixture.afterRollbackRowsLock = async () => {
      await expect(client.$transaction(async transaction => {
        await transaction.$executeRawUnsafe("SET LOCAL lock_timeout = '500ms'");
        if (target === "classification") {
          await transaction.stagedTransaction.update({ where: { id: source.id }, data: { status: "NEEDS_CLARIFICATION" } });
        } else {
          await transaction.bankAccount.update({ where: { id: bankAccountId }, data: { lastBalance: { increment: "100" } } });
        }
      }, { maxWait: 1000, timeout: 3000 })).rejects.toThrow(/lock timeout/);
    };
    expect((await rollback(importBatchId)).status).toBe(200);
    expect((await bankState()).lastBalance.toFixed(2)).toBe("0.00");
    expect(await client.stagedTransaction.count({ where: { orgId: fixture.orgId } })).toBe(0);
  });

  it.each(["source", "documentId"])("preserves a document linked through %s even when the transaction is IMPORTED", async link => {
    const { importBatchId } = await (await upload()).json();
    const source = await client.stagedTransaction.findFirstOrThrow({ where: { orgId: fixture.orgId } });
    const type = await client.documentType.create({ data: {
      code: `ROLLBACK_GUARD_${randomUUID()}`, name: "Synthetic rollback guard", postingTemplate: {},
    } });
    createdTypeIds.push(type.id);
    const document = await client.document.create({ data: {
      orgId: fixture.orgId, periodId: source.periodId, typeId: type.id, date: source.date, payload: {},
      ...(link === "source" ? { sourceTransactionId: source.id } : {}),
    } });
    if (link === "documentId") await client.stagedTransaction.update({ where: { id: source.id }, data: { documentId: document.id } });
    const before = await bankState();
    expect((await rollback(importBatchId)).status).toBe(409);
    expect(await bankState()).toEqual(before);
    expect(await client.document.findUnique({ where: { id: document.id } })).toEqual(document);
    expect(await client.stagedTransaction.count({ where: { orgId: fixture.orgId } })).toBe(2);
  });

  it("refuses a partially deleted batch without restoring its full original balance", async () => {
    const { importBatchId } = await (await upload()).json();
    const source = await client.stagedTransaction.findFirstOrThrow({ where: { orgId: fixture.orgId } });
    await client.stagedTransaction.delete({ where: { id: source.id } });
    const before = await bankState();
    expect((await rollback(importBatchId)).status).toBe(409);
    expect(await bankState()).toEqual(before);
    expect(await client.stagedTransaction.count({ where: { orgId: fixture.orgId } })).toBe(1);
  });

  it("refuses a batch spanning bank accounts without changing either balance", async () => {
    const { importBatchId } = await (await upload()).json();
    const other = await client.bankAccount.create({ data: { orgId: fixture.orgId, name: "Synthetic other bank", lastBalance: "50" } });
    const source = await client.stagedTransaction.findFirstOrThrow({ where: { orgId: fixture.orgId } });
    await client.stagedTransaction.update({ where: { id: source.id }, data: { bankAccountId: other.id } });
    const before = await bankState();
    expect((await rollback(importBatchId)).status).toBe(409);
    expect(await bankState()).toEqual(before);
    expect(await client.bankAccount.findUnique({ where: { id: other.id } })).toEqual(other);
    expect(await client.stagedTransaction.count({ where: { orgId: fixture.orgId } })).toBe(2);
  });

  it("hides an unknown batch", async () => {
    expect((await rollback(randomUUID())).status).toBe(404);
  });

  it("hides a foreign batch without modifying its transactions or balance", async () => {
    const { importBatchId } = await (await upload()).json();
    const originalOrgId = fixture.orgId;
    const before = await bankState();
    fixture.orgId = `foreign-rollback-${randomUUID()}`;
    orgIds.push(fixture.orgId);
    await client.organization.create({ data: { id: fixture.orgId, name: "Synthetic foreign org" } });
    expect((await rollback(importBatchId)).status).toBe(404);
    expect(await bankState()).toEqual(before);
    expect(await client.stagedTransaction.count({ where: { orgId: originalOrgId } })).toBe(2);
  });

  it.each(["closed", "locked"])("refuses the entire batch when its period is %s", async mode => {
    const { importBatchId } = await (await upload()).json();
    await client.period.updateMany({ where: { orgId: fixture.orgId }, data:
      mode === "closed" ? { status: "CLOSED" } : { lockDate: new Date() },
    });
    const before = await bankState();
    const response = await rollback(importBatchId);
    expect(response.status).toBe(409);
    expect((await response.json()).code).toBe("PERIOD_LOCKED");
    expect(await bankState()).toEqual(before);
    expect(await client.stagedTransaction.count({ where: { orgId: fixture.orgId } })).toBe(2);
  });

  it("refuses processed transactions without changing the bank", async () => {
    const { importBatchId } = await (await upload()).json();
    await client.stagedTransaction.updateMany({ where: { orgId: fixture.orgId }, data: { status: "NEEDS_CLARIFICATION" } });
    const before = await bankState();
    const response = await rollback(importBatchId);
    expect(response.status).toBe(409);
    expect((await response.json()).code).toBe("BATCH_PROCESSED");
    expect(await bankState()).toEqual(before);
    expect(await client.stagedTransaction.count({ where: { orgId: fixture.orgId } })).toBe(2);
  });

  it.each(["ACCOUNTANT", "VIEWER"])("denies rollback to %s", async role => {
    const { importBatchId } = await (await upload()).json();
    fixture.role = role;
    expect((await rollback(importBatchId)).status).toBe(403);
    expect(await client.stagedTransaction.count({ where: { orgId: fixture.orgId } })).toBe(2);
  });

  it("allows an administrator to roll back an unchanged import", async () => {
    const { importBatchId } = await (await upload()).json();
    fixture.role = "ADMIN";
    expect((await rollback(importBatchId)).status).toBe(200);
  });

  it.each(["broken-json", JSON.stringify({ batchId: 42 }), JSON.stringify({ batchId: randomUUID(), force: true })])
    ("rejects malformed rollback input", async body => {
      expect((await rollbackBank(new NextRequest("http://localhost/api/import/bank/rollback", { method: "DELETE", body }))).status).toBe(400);
    });

  it("imports opposite directions separately and deduplicates each on retry", async () => {
    fixture.rows = [row(100, "same description"), { ...row(100, "same description"), direction: "DEBIT" }];
    expect(await (await upload()).json()).toMatchObject({ imported: 2, duplicates: 0 });
    expect(await (await upload()).json()).toMatchObject({ imported: 0, duplicates: 2 });
    expect(await client.stagedTransaction.count({ where: { orgId: fixture.orgId } })).toBe(2);
    expect((await client.bankAccount.findUniqueOrThrow({ where: { id: bankAccountId } })).lastBalance.toString()).toBe("0");
  });

  it("refuses a mixed legacy and new import without changing either direction", async () => {
    const credit = row(100, "legacy operation");
    const period = await client.period.create({ data: { orgId: fixture.orgId, year: 2026, month: 9 } });
    const legacyHash = createHash("sha256")
      .update(`${fixture.orgId}:${bankAccountId}:${credit.date.toISOString()}:${credit.amount}:${credit.description}`)
      .digest("hex");
    await client.stagedTransaction.create({ data: {
      ...credit, orgId: fixture.orgId, bankAccountId, periodId: period.id, hash: legacyHash,
    } });
    await client.bankAccount.update({ where: { id: bankAccountId }, data: { lastBalance: "100", lastSyncedAt: new Date() } });
    fixture.rows = [credit, { ...credit, direction: "DEBIT" }];
    fixture.openingBalance = 0;
    expect((await upload()).status).toBe(422);
    expect(await client.stagedTransaction.count({ where: { orgId: fixture.orgId } })).toBe(1);
    expect(await client.stagedTransaction.findUnique({ where: { orgId_hash: { orgId: fixture.orgId, hash: legacyHash } } })).not.toBeNull();
    expect((await client.bankAccount.findUniqueOrThrow({ where: { id: bankAccountId } })).lastBalance.toString()).toBe("100");
  });

  it("recognizes a legacy numeric hash when the real parser returns fixed decimal strings", async () => {
    useStatement();
    const date = new Date("2026-09-10T00:00:00Z");
    const description = "Synthetic real parser";
    const period = await client.period.create({ data: { orgId: fixture.orgId, year: 2026, month: 9 } });
    const hash = createHash("sha256").update(`${fixture.orgId}:${bankAccountId}:${date.toISOString()}:0.1:${description}`).digest("hex");
    await client.stagedTransaction.create({ data: {
      orgId: fixture.orgId, bankAccountId, periodId: period.id, date, description,
      amount: "0.10", direction: "CREDIT", hash,
    } });
    await client.bankAccount.update({ where: { id: bankAccountId }, data: { lastBalance: "100.10", lastSyncedAt: new Date() } });
    const before = await bankState();
    const response = await upload();
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ imported: 0, duplicates: 1, importBatchId: null });
    expect(await bankState()).toEqual(before);
    expect(await client.stagedTransaction.count({ where: { orgId: fixture.orgId } })).toBe(1);
    expect(await client.auditLog.count({ where: { orgId: fixture.orgId } })).toBe(0);
  });

  it("preserves one cent after large offsetting turnovers", async () => {
    fixture.rows = [
      row(999999999999999900, "large credit 1"), row(999999999999999900, "large credit 2"),
      row(0.01, "one cent"),
      { ...row(999999999999999900, "large debit 1"), direction: "DEBIT" },
      { ...row(999999999999999900, "large debit 2"), direction: "DEBIT" },
    ];
    expect((await upload()).status).toBe(200);
    expect((await client.bankAccount.findUniqueOrThrow({ where: { id: bankAccountId } })).lastBalance.toString()).toBe("0.01");
  });

  it("rolls back rows, period and audit if writing the bank balance fails", async () => {
    fixture.failBalance = true;
    expect((await upload()).status).toBe(500);
    expect(await client.stagedTransaction.count({ where: { orgId: fixture.orgId } })).toBe(0);
    expect(await client.period.count({ where: { orgId: fixture.orgId } })).toBe(0);
    expect(await client.auditLog.count({ where: { orgId: fixture.orgId } })).toBe(0);
    expect((await client.bankAccount.findUniqueOrThrow({ where: { id: bankAccountId } })).lastBalance.toString()).toBe("0");
  });

  it("rolls back earlier rows when a later amount is invalid", async () => {
    fixture.rows.push(row(0.005, "invalid"));
    expect((await upload()).status).toBe(422);
    expect(await client.stagedTransaction.count({ where: { orgId: fixture.orgId } })).toBe(0);
  });

  it("does not add rows or update balances in a closed period", async () => {
    await client.period.create({ data: { orgId: fixture.orgId, year: 2026, month: 9, status: "CLOSED" } });
    expect(await (await upload()).json()).toMatchObject({ imported: 0, locked: 2 });
    expect(await client.stagedTransaction.count({ where: { orgId: fixture.orgId } })).toBe(0);
    expect((await client.bankAccount.findUniqueOrThrow({ where: { id: bankAccountId } })).lastBalance.toString()).toBe("0");
  });

  it("serializes bank import against period closure", async () => {
    const period = await client.period.create({ data: { orgId: fixture.orgId, year: 2026, month: 9 } });
    const [response] = await Promise.all([
      upload(), finalizePeriod(period.id, fixture.orgId, "synthetic-user").catch((error: Error) => error),
    ]);
    expect(response.status).toBe(200);
    const body = await response.json();
    const current = await client.period.findUniqueOrThrow({ where: { id: period.id } });
    if (current.status === "CLOSED") {
      expect(body).toMatchObject({ imported: 0, locked: 2 });
      expect(await client.stagedTransaction.count({ where: { periodId: period.id } })).toBe(0);
    } else {
      expect(body.imported).toBe(2);
      await expect(finalizePeriod(period.id, fixture.orgId, "synthetic-user")).rejects.toThrow(/операций не обработаны/);
    }
  });
});
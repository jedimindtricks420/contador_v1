import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { postDocument, repostDocument, voidDocument } from "@/lib/posting/postingEngine";
import { auditAccounting } from "@/lib/posting/accountingAudit";

const { syncCalendar } = vi.hoisted(() => ({ syncCalendar: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ default: {} }));
vi.mock("@/lib/closing", () => ({ upsertTaxCalendarEventsForPeriod: syncCalendar }));

const databaseUrl = process.env.ACC_TEST_DATABASE_URL;
if (databaseUrl) {
  const parsed = new URL(databaseUrl);
  if (parsed.hostname !== "127.0.0.1" || parsed.pathname !== "/contador_safety_test") {
    throw new Error("ACC_TEST_DATABASE_URL must target the disposable loopback contador_safety_test database");
  }
}

describe.skipIf(!databaseUrl)("posting safety on disposable PostgreSQL", () => {
  const client = new PrismaClient({ datasourceUrl: databaseUrl });
  const fixtureId = randomUUID();
  const orgId = `safety-org-${fixtureId}`;
  const periodId = `safety-period-${fixtureId}`;
  const typeId = `safety-type-${fixtureId}`;
  const debitCode = `safety-debit-${fixtureId}`;
  const creditCode = `safety-credit-${fixtureId}`;
  const documentData = () => ({
    orgId, periodId, typeId, date: new Date("2026-09-10T00:00:00Z"), payload: { amount: "100" }
  });

  beforeAll(async () => {
    await client.organization.create({ data: { id: orgId, name: "Synthetic posting test" } });
    await client.period.create({ data: { id: periodId, orgId, year: 2026, month: 9 } });
    await client.account.createMany({ data: [
      { code: debitCode, name: "Test debit", type: "ASSET" },
      { code: creditCode, name: "Test credit", type: "LIABILITY" }
    ] });
    await client.documentType.create({ data: {
      id: typeId, code: typeId, name: "Synthetic posting test", postingTemplate: { lines: [
        { accountCode: debitCode, side: "debit", expression: "amount" },
        { accountCode: creditCode, side: "credit", expression: "amount" }
      ] }
    } });
  });

  beforeEach(() => { syncCalendar.mockReset().mockResolvedValue(undefined); });

  afterAll(async () => {
    try {
      await client.organization.deleteMany({ where: { id: orgId } });
      await client.documentType.deleteMany({ where: { id: typeId } });
      await client.account.deleteMany({ where: { code: { in: [debitCode, creditCode] } } });
    } finally {
      await client.$disconnect();
    }
  });

  it("serializes concurrent posting of the same document", async () => {
    const document = await client.document.create({ data: documentData() });
    const results = await Promise.allSettled([
      postDocument(document.id, client), postDocument(document.id, client)
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((result) => result.status === "rejected") as PromiseRejectedResult;
    expect(rejected.reason.message).toMatch(/уже провед/);
    expect(await client.journalEntry.count({ where: { documentId: document.id } })).toBe(2);
    expect(await client.auditLog.count({ where: { entityId: document.id } })).toBe(1);
  });

  it("allows two transactions to create and post different documents in one period", async () => {
    let arrived = 0;
    let release: () => void;
    const barrier = new Promise<void>((resolve) => { release = resolve; });
    const createAndPost = () => client.$transaction(async (transaction) => {
      const document = await transaction.document.create({ data: documentData() });
      arrived += 1;
      if (arrived === 2) release();
      await barrier;
      await postDocument(document.id, transaction);
      return document.id;
    }, { maxWait: 5000, timeout: 10000 });
    const results = await Promise.allSettled([createAndPost(), createAndPost()]);
    expect(results.map((result) => result.status)).toEqual(["fulfilled", "fulfilled"]);
  }, 15000);

  it("rolls back journal and audit writes after a calendar error", async () => {
    const document = await client.document.create({ data: documentData() });
    syncCalendar.mockRejectedValueOnce(new Error("calendar unavailable"));
    await expect(postDocument(document.id, client)).rejects.toThrow("calendar unavailable");
    expect(await client.journalEntry.count({ where: { documentId: document.id } })).toBe(0);
    expect(await client.auditLog.count({ where: { entityId: document.id } })).toBe(0);
    expect((await client.document.findUniqueOrThrow({ where: { id: document.id } })).taxCalendarSyncStatus).toBeNull();
  });

  it("rolls back document creation when the caller owns the transaction", async () => {
    const documentId = randomUUID();
    syncCalendar.mockRejectedValueOnce(new Error("calendar unavailable"));
    await expect(client.$transaction(async (transaction) => {
      await transaction.document.create({ data: { ...documentData(), id: documentId } });
      await postDocument(documentId, transaction);
    })).rejects.toThrow("calendar unavailable");
    expect(await client.document.findUnique({ where: { id: documentId } })).toBeNull();
  });

  it("restores the original ledger and status when void fails", async () => {
    const document = await client.document.create({ data: documentData() });
    await postDocument(document.id, client);
    const original = await client.journalEntry.findMany({ where: { documentId: document.id }, orderBy: { id: "asc" } });
    syncCalendar.mockRejectedValueOnce(new Error("calendar unavailable"));
    await expect(voidDocument(document.id, client)).rejects.toThrow("calendar unavailable");
    expect(await client.journalEntry.findMany({ where: { documentId: document.id }, orderBy: { id: "asc" } })).toEqual(original);
    expect((await client.document.findUniqueOrThrow({ where: { id: document.id } })).status).toBe("POSTED");
  });

  it("restores the original ledger when repost fails after void", async () => {
    const document = await client.document.create({ data: documentData() });
    await postDocument(document.id, client);
    const original = await client.journalEntry.findMany({ where: { documentId: document.id }, orderBy: { id: "asc" } });
    syncCalendar.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("calendar unavailable"));
    await expect(repostDocument(document.id, typeId, client)).rejects.toThrow("calendar unavailable");
    expect(await client.journalEntry.findMany({ where: { documentId: document.id }, orderBy: { id: "asc" } })).toEqual(original);
    expect(await client.auditLog.count({ where: { entityId: document.id } })).toBe(1);
  });

  it.each(["void", "repost"])("preserves a settled debt source during rejected %s", async (operation) => {
    const opening = await client.document.create({ data: documentData() });
    const payment = await client.document.create({ data: documentData() });
    await postDocument(opening.id, client);
    await postDocument(payment.id, client);
    const account = await client.account.findUniqueOrThrow({ where: { code: debitCode } });
    const item = await client.openItem.create({ data: {
      orgId, accountId: account.id, openingDocumentId: opening.id, closingDocumentId: payment.id,
      amount: "100", status: "CLOSED", dateOpened: opening.date, dateClosed: payment.date,
    } });
    const original = await client.journalEntry.findMany({ where: { documentId: opening.id }, orderBy: { id: "asc" } });
    const result = operation === "void"
      ? voidDocument(opening.id, client)
      : repostDocument(opening.id, typeId, client);
    await expect(result).rejects.toThrow(/сначала отмените документ расчёта/);
    expect(await client.journalEntry.findMany({ where: { documentId: opening.id }, orderBy: { id: "asc" } })).toEqual(original);
    expect(await client.openItem.findUniqueOrThrow({ where: { id: item.id } })).toEqual(item);
    expect((await client.document.findUniqueOrThrow({ where: { id: opening.id } })).status).toBe("POSTED");
    expect(await client.auditLog.count({ where: { entityId: opening.id } })).toBe(1);
    await voidDocument(payment.id, client);
    await voidDocument(opening.id, client);
    expect((await client.document.findUniqueOrThrow({ where: { id: opening.id } })).status).toBe("VOIDED");
  });

  it("audits synthetic anomalies without modifying documents or ledger", async () => {
    const document = await client.document.create({ data: {
      ...documentData(), date: new Date("2026-08-31T18:59:00Z"), taxCalendarSyncStatus: "FAILED"
    } });
    await client.document.create({ data: {
      ...documentData(), date: new Date("2026-08-31T19:00:00Z")
    } });
    const beforeDocuments = await client.document.count({ where: { orgId } });
    const beforeEntries = await client.journalEntry.count({ where: { document: { orgId } } });
    const report = await auditAccounting(client, orgId);
    const counts = Object.fromEntries(report.checks.map((row) => [row.check, row.count]));
    expect(report.readOnly).toBe(true);
    expect(report.checks).toHaveLength(17);
    expect(counts.missing_bank_account_number).toBe("0");
    expect(counts.invalid_bank_account_number).toBe("0");
    expect(counts.duplicate_bank_account_number_groups).toBe("0");
    expect(counts.date_period_mismatch).toBe("1");
    expect(counts.tax_calendar_sync_failed).toBe("1");
    expect(Number(counts.posted_without_entries)).toBeGreaterThanOrEqual(2);
    expect(await client.document.count({ where: { orgId } })).toBe(beforeDocuments);
    expect(await client.journalEntry.count({ where: { document: { orgId } } })).toBe(beforeEntries);
    expect((await client.document.findUniqueOrThrow({ where: { id: document.id } })).taxCalendarSyncStatus).toBe("FAILED");
    await expect(auditAccounting(client, "")).rejects.toThrow("explicit organization");
  });

  it("audits legacy bank numbers with API normalization and no cross-tenant disclosure or writes", async () => {
    const foreignOrgId = `bank-preflight-${randomUUID()}`;
    const firstNumber = "00000000000000000001";
    const secondNumber = "00000000000000000002";
    const thirdNumber = "00000000000000000003";
    await client.organization.create({ data: { id: foreignOrgId, name: "Foreign preflight fixture" } });
    try {
      const ownNumbers = [
        null, "", " \t", "\u00a0\ufeff",
        "123", "１".repeat(20), `-${firstNumber}`, "0".repeat(21),
        firstNumber, `00000 00000 00000 00001`,
        secondNumber, `\u00a0${secondNumber}`, `\ufeff${secondNumber}\t`,
        thirdNumber
      ];
      await client.bankAccount.createMany({ data: [
        ...ownNumbers.map(accountNumber => ({ orgId, name: "Legacy preflight fixture", accountNumber })),
        ...[null, "invalid", thirdNumber, thirdNumber].map(accountNumber => ({
          orgId: foreignOrgId, name: "Foreign preflight fixture", accountNumber
        }))
      ] });
      const scope = { orgId: { in: [orgId, foreignOrgId] } };
      const beforeBanks = await client.bankAccount.findMany({ where: scope, orderBy: { id: "asc" } });
      const beforeAudit = await client.auditLog.findMany({ where: scope, orderBy: { id: "asc" } });
      const report = await auditAccounting(client, orgId);
      expect(report.readOnly).toBe(true);
      expect(report.checks.filter(row => row.check.includes("bank_account_number"))).toEqual([
        { check: "duplicate_bank_account_number_groups", count: "2" },
        { check: "invalid_bank_account_number", count: "4" },
        { check: "missing_bank_account_number", count: "4" }
      ]);
      expect(JSON.stringify(report)).not.toContain(firstNumber);
      expect(JSON.stringify(report)).not.toContain(foreignOrgId);
      expect(await client.bankAccount.findMany({ where: scope, orderBy: { id: "asc" } })).toEqual(beforeBanks);
      expect(await client.auditLog.findMany({ where: scope, orderBy: { id: "asc" } })).toEqual(beforeAudit);
    } finally {
      await client.bankAccount.deleteMany({ where: { orgId } });
      await client.organization.delete({ where: { id: foreignOrgId } });
    }
  });

  it.each(["OPEN", "RISK"] as const)("does not leave %s debt active after its source is voided", async (status) => {
    const opening = await client.document.create({ data: documentData() });
    await postDocument(opening.id, client);
    const account = await client.account.findUniqueOrThrow({ where: { code: debitCode } });
    const item = await client.openItem.create({ data: {
      orgId, accountId: account.id, openingDocumentId: opening.id,
      amount: "100", status, dateOpened: opening.date,
    } });
    await voidDocument(opening.id, client);
    expect((await client.openItem.findUniqueOrThrow({ where: { id: item.id } })).status).toBe("CLOSED");
    expect(await client.journalEntry.count({ where: { documentId: opening.id } })).toBe(0);
  });

  it("serializes source cancellation with settlement in another open month", async () => {
    const originalType = await client.documentType.findUniqueOrThrow({ where: { id: typeId } });
    const counterparty = await client.counterparty.create({ data: { orgId, name: "Concurrent settlement" } });
    const nextPeriod = await client.period.create({ data: { orgId, year: 2026, month: 10 } });
    try {
      await client.documentType.update({ where: { id: typeId }, data: { postingTemplate: {
        ...(originalType.postingTemplate as object), opensItem: true, itemAccountCode: debitCode,
      } } });
      const opening = await client.document.create({ data: {
        ...documentData(), payload: { amount: "100", counterpartyId: counterparty.id },
      } });
      const opened = await postDocument(opening.id, client);
      await client.documentType.update({ where: { id: typeId }, data: { postingTemplate: {
        lines: [
          { accountCode: creditCode, side: "debit", expression: "amount" },
          { accountCode: debitCode, side: "credit", expression: "amount" },
        ], closesOpenItemByAccount: debitCode, requireCloseMatch: true, requiresCounterparty: true,
      } } });
      const payment = await client.document.create({ data: {
        ...documentData(), periodId: nextPeriod.id, date: new Date("2026-10-10T00:00:00Z"),
        payload: { amount: "100", counterpartyId: counterparty.id },
      } });
      const results = await Promise.allSettled([voidDocument(opening.id, client), postDocument(payment.id, client)]);
      expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
      const remaining = await client.openItem.findUniqueOrThrow({ where: { id: opened.openItem.id } });
      expect(remaining.status).toBe("CLOSED");
      if (results[0].status === "fulfilled") {
        expect(remaining.closingDocumentId).toBeNull();
        expect(await client.journalEntry.count({ where: { documentId: payment.id } })).toBe(0);
        expect((results[1] as PromiseRejectedResult).reason.message).toMatch(/нет открытого долга/);
      } else {
        expect(results[0].reason.message).toMatch(/сначала отмените документ расчёта/);
        expect(remaining.closingDocumentId).toBe(payment.id);
        expect(await client.journalEntry.count({ where: { documentId: opening.id } })).toBe(2);
      }
    } finally {
      await client.documentType.update({ where: { id: typeId }, data: { postingTemplate: originalType.postingTemplate as object } });
    }
  });

  it("preserves debt 100 and writes no ledger for an unsupported partial payment 40", async () => {
    const opening = await client.document.create({ data: documentData() });
    await postDocument(opening.id, client);
    const counterparty = await client.counterparty.create({ data: { orgId, name: "Synthetic supplier", inn: "TEST-INN" } });
    const account = await client.account.findUniqueOrThrow({ where: { code: debitCode } });
    const item = await client.openItem.create({ data: {
      orgId, accountId: account.id, counterpartyId: counterparty.id,
      openingDocumentId: opening.id, amount: "100", dateOpened: opening.date
    } });
    const originalType = await client.documentType.findUniqueOrThrow({ where: { id: typeId } });
    await client.documentType.update({ where: { id: typeId }, data: { postingTemplate: {
      ...(originalType.postingTemplate as object), requiresCounterparty: true,
      closesOpenItemByAccount: debitCode, requireCloseMatch: true
    } } });
    try {
      const payment = await client.document.create({ data: {
        ...documentData(), payload: { amount: "40", counterpartyInn: "TEST-INN" }
      } });
      await expect(postDocument(payment.id, client)).rejects.toThrow(/регистра распределений/);
      const unchanged = await client.openItem.findUniqueOrThrow({ where: { id: item.id } });
      expect(unchanged.amount.toString()).toBe("100");
      expect(unchanged.status).toBe("OPEN");
      expect(unchanged.closingDocumentId).toBeNull();
      expect(await client.journalEntry.count({ where: { documentId: payment.id } })).toBe(0);
      await client.document.update({ where: { id: payment.id }, data: { payload: { amount: "100", counterpartyInn: "TEST-INN" } } });
      await postDocument(payment.id, client);
      expect((await client.openItem.findUniqueOrThrow({ where: { id: item.id } })).closingDocumentId).toBe(payment.id);
    } finally {
      await client.documentType.update({ where: { id: typeId }, data: { postingTemplate: originalType.postingTemplate as object } });
    }
  });

  it.each(["OPEN", "RISK"] as const)("resolves dynamic debt accounts and settles %s but not future debt", async (status) => {
    const originalType = await client.documentType.findUniqueOrThrow({ where: { id: typeId } });
    const counterpartyInn = `loan-${status}-${fixtureId}`;
    try {
      await client.documentType.update({ where: { id: typeId }, data: { postingTemplate: {
        ...(originalType.postingTemplate as object), opensItem: true,
        itemAccountCode: "$loanAccountCode", requiresCounterparty: true,
      } } });
      const opening = await client.document.create({ data: {
        ...documentData(), date: new Date("2026-09-11T00:00:00Z"),
        payload: { amount: "100", loanAccountCode: creditCode, counterpartyInn },
      } });
      const opened = await postDocument(opening.id, client);
      const account = await client.account.findUniqueOrThrow({ where: { code: creditCode } });
      expect(opened.openItem.accountId).toBe(account.id);
      await client.openItem.update({ where: { id: opened.openItem.id }, data: { status } });

      await client.documentType.update({ where: { id: typeId }, data: { postingTemplate: {
        lines: [
          { accountCode: "$loanAccountCode", side: "debit", expression: "amount" },
          { accountCode: debitCode, side: "credit", expression: "amount" },
        ], closesOpenItemByAccount: "$loanAccountCode", requiresCounterparty: true, requireCloseMatch: true,
      } } });
      const payment = await client.document.create({ data: {
        ...documentData(), payload: { amount: "100", loanAccountCode: creditCode, counterpartyInn },
      } });
      await expect(postDocument(payment.id, client)).rejects.toThrow(/нет открытого долга/);
      expect(await client.journalEntry.count({ where: { documentId: payment.id } })).toBe(0);
      expect((await client.openItem.findUniqueOrThrow({ where: { id: opened.openItem.id } })).status).toBe(status);
      await client.document.update({ where: { id: payment.id }, data: { date: opening.date } });
      await postDocument(payment.id, client);
      const settled = await client.openItem.findUniqueOrThrow({ where: { id: opened.openItem.id } });
      expect(settled.status).toBe("CLOSED");
      expect(settled.closingDocumentId).toBe(payment.id);
    } finally {
      await client.documentType.update({ where: { id: typeId }, data: { postingTemplate: originalType.postingTemplate as object } });
    }
  });

  it.each(["valid", "foreign", "wrong-inn"])("checks selected counterparty against real tenant data: %s", async (scenario) => {
    const foreignOrgId = `foreign-${randomUUID()}`;
    const originalType = await client.documentType.findUniqueOrThrow({ where: { id: typeId } });
    await client.organization.create({ data: { id: foreignOrgId, name: "Synthetic foreign organization" } });
    try {
      const counterparty = await client.counterparty.create({ data: {
        orgId: scenario === "foreign" ? foreignOrgId : orgId, name: "Selected party", inn: `inn-${randomUUID()}`,
      } });
      await client.documentType.update({ where: { id: typeId }, data: { postingTemplate: {
        requiresCounterparty: true, lines: [
          { accountCode: debitCode, side: "debit", expression: "amount", subcontoType: "counterparty" },
          { accountCode: creditCode, side: "credit", expression: "amount" },
        ],
      } } });
      const document = await client.document.create({ data: { ...documentData(), payload: {
        amount: "100", counterpartyId: counterparty.id,
        counterpartyInn: scenario === "wrong-inn" ? "different-inn" : counterparty.inn,
      } } });
      const countBefore = await client.counterparty.count({ where: { orgId } });
      if (scenario === "valid") {
        const result = await postDocument(document.id, client, "synthetic-user");
        expect(result.journalEntries[0].counterpartyId).toBe(counterparty.id);
        expect(await client.journalEntry.count({ where: { documentId: document.id } })).toBe(2);
      } else {
        await expect(postDocument(document.id, client, "synthetic-user")).rejects.toThrow(/Контрагент|ИНН/);
        expect(await client.journalEntry.count({ where: { documentId: document.id } })).toBe(0);
        expect(await client.auditLog.count({ where: { entityId: document.id } })).toBe(0);
      }
      expect(await client.counterparty.count({ where: { orgId } })).toBe(countBefore);
    } finally {
      await client.documentType.update({ where: { id: typeId }, data: { postingTemplate: originalType.postingTemplate as object } });
      await client.organization.delete({ where: { id: foreignOrgId } });
    }
  });
});
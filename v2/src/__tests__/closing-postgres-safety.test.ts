import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { finalizePeriod, saveClosingState } from "@/lib/closing";
import { NextRequest } from "next/server";
import { POST as reopenPeriod } from "@/app/api/periods/[id]/reopen/route";
import { POST as closeYear } from "@/app/api/closing/year-end/route";
import { tashkentDate } from "@/lib/accountingDate";

const { database } = vi.hoisted(() => ({ database: {
  client: null as PrismaClient | null, failBeforeLock: false, failCleanup: false, orgId: "",
} }));
vi.mock("@/lib/context", () => ({ getActiveMembership: async () => ({
  orgId: database.orgId, userId: "synthetic-user", role: "OWNER",
}) }));
vi.mock("@/lib/prisma", () => ({ default: {
  $transaction: (callback: (transaction: any) => Promise<any>, options: any) =>
    database.client!.$transaction(async (transaction) => {
      const wrapped = new Proxy(transaction, {
        get(target, key) {
          if (key === "closingJob" && database.failCleanup) {
            return new Proxy(target.closingJob, {
              get(model, method) {
                if (method === "deleteMany") return () => { throw new Error("injected cleanup failure"); };
                return Reflect.get(model, method);
              },
            });
          }
          if (key === "period" && database.failBeforeLock) {
            return new Proxy(target.period, {
              get(model, method) {
                if (method === "update") return () => { throw new Error("injected lock failure"); };
                return Reflect.get(model, method);
              },
            });
          }
          return Reflect.get(target, key);
        },
      });
      return callback(wrapped);
    }, options),
} }));

const databaseUrl = process.env.ACC_TEST_DATABASE_URL;
if (databaseUrl) {
  const parsed = new URL(databaseUrl);
  if (parsed.hostname !== "127.0.0.1" || parsed.pathname !== "/contador_safety_test") {
    throw new Error("ACC_TEST_DATABASE_URL must target the disposable loopback contador_safety_test database");
  }
}

describe.skipIf(!databaseUrl)("closing safety on disposable PostgreSQL", () => {
  const client = new PrismaClient({ datasourceUrl: databaseUrl });
  const orgId = `closing-${randomUUID()}`;
  let bankAccountId: string;
  let createdAccountId: string | undefined;
  const createdFixtureAccounts: string[] = [];
  const createdFixtureTypes: string[] = [];
  let month = 0;
  let periodId: string;

  beforeAll(async () => {
    database.client = client;
    database.orgId = orgId;
    await client.organization.create({ data: { id: orgId, name: "Synthetic closing test" } });
    const bank = await client.bankAccount.create({ data: { orgId, name: "Synthetic bank" } });
    bankAccountId = bank.id;
    if (!await client.account.findUnique({ where: { code: "9910" } })) {
      createdAccountId = (await client.account.create({ data: {
        code: "9910", name: "Synthetic final result", type: "ACTIVE_PASSIVE",
      } })).id;
    }
  });

  beforeEach(async () => {
    database.failBeforeLock = false;
    database.failCleanup = false;
    month += 1;
    periodId = (await client.period.create({ data: {
      orgId, year: 2026 + Math.floor((month - 1) / 12), month: ((month - 1) % 12) + 1,
    } })).id;
  });

  afterAll(async () => {
    try {
      await client.stagedTransaction.deleteMany({ where: { orgId } });
      await client.organization.deleteMany({ where: { id: orgId } });
      await client.account.deleteMany({ where: { id: { in: createdFixtureAccounts } } });
      await client.documentType.deleteMany({ where: { id: { in: createdFixtureTypes } } });
      if (createdAccountId) await client.account.delete({ where: { id: createdAccountId } });
    } finally {
      await client.$disconnect();
    }
  });

  it.each(["IMPORTED", "NEEDS_CLARIFICATION"] as const)("blocks %s without creating a job or taxes", async (status) => {
    await client.stagedTransaction.create({ data: {
      orgId, bankAccountId, periodId, status, date: new Date(`2026-0${month}-10T00:00:00Z`),
      amount: "100", direction: "CREDIT", description: "Synthetic transaction", hash: randomUUID(),
    } });
    await expect(finalizePeriod(periodId, orgId, "synthetic-user")).rejects.toThrow(/операций не обработаны/);
    expect((await client.period.findUniqueOrThrow({ where: { id: periodId } })).status).toBe("OPEN");
    expect(await client.closingJob.count({ where: { periodId } })).toBe(0);
    expect(await client.taxCalendarEvent.count({ where: { periodId } })).toBe(0);
  });

  it("serializes simultaneous closing requests and repeated completion", async () => {
    const results = await Promise.all([
      finalizePeriod(periodId, orgId, "synthetic-user"),
      finalizePeriod(periodId, orgId, "synthetic-user"),
    ]);
    expect(results.map((result) => result.period.status)).toEqual(["CLOSED", "CLOSED"]);
    expect(await client.closingJob.count({ where: { periodId, status: "COMPLETED" } })).toBe(1);
    const before = await client.taxCalendarEvent.findMany({ where: { periodId } });
    await finalizePeriod(periodId, orgId, "synthetic-user");
    expect(await client.taxCalendarEvent.findMany({ where: { periodId } })).toEqual(before);
    expect(await client.auditLog.count({ where: { entityId: periodId, action: "CLOSE_PERIOD" } })).toBe(1);
  });

  it("rolls back job and tax writes when final locking fails", async () => {
    database.failBeforeLock = true;
    await expect(finalizePeriod(periodId, orgId, "synthetic-user")).rejects.toThrow("injected lock failure");
    expect((await client.period.findUniqueOrThrow({ where: { id: periodId } })).status).toBe("OPEN");
    expect(await client.closingJob.count({ where: { periodId } })).toBe(0);
    expect(await client.taxCalendarEvent.count({ where: { periodId } })).toBe(0);
    database.failBeforeLock = false;
    expect((await finalizePeriod(periodId, orgId, "synthetic-user")).period.status).toBe("CLOSED");
  });

  it("rejects a period from another organization", async () => {
    await expect(finalizePeriod(periodId, "foreign-org", "synthetic-user")).rejects.toThrow(/Период не найден/);
    expect(await client.closingJob.count({ where: { periodId } })).toBe(0);
  });

  const reopen = () => reopenPeriod(new NextRequest(`http://localhost/api/periods/${periodId}/reopen`, { method: "POST" }), {
    params: Promise.resolve({ id: periodId }),
  });

  it("preserves closed periods when a later year is closed", async () => {
    await finalizePeriod(periodId, orgId, "synthetic-user");
    const later = await client.period.create({ data: { orgId, year: 2027, month: 1, status: "CLOSED" } });
    try {
      expect((await reopen()).status).toBe(400);
      expect((await client.period.findUniqueOrThrow({ where: { id: periodId } })).status).toBe("CLOSED");
      expect((await client.period.findUniqueOrThrow({ where: { id: later.id } })).status).toBe("CLOSED");
      expect(await client.closingJob.count({ where: { periodId, status: "COMPLETED" } })).toBe(1);
    } finally {
      await client.period.delete({ where: { id: later.id } });
    }
  });

  it("rolls back reopening when job cleanup fails, then reopens atomically on retry", async () => {
    await finalizePeriod(periodId, orgId, "synthetic-user");
    database.failCleanup = true;
    expect((await reopen()).status).toBe(500);
    expect((await client.period.findUniqueOrThrow({ where: { id: periodId } })).status).toBe("CLOSED");
    expect(await client.closingJob.count({ where: { periodId, status: "COMPLETED" } })).toBe(1);
    expect(await client.auditLog.count({ where: { entityId: periodId, action: "REOPEN_PERIOD" } })).toBe(0);
    database.failCleanup = false;
    expect((await reopen()).status).toBe(200);
    expect((await client.period.findUniqueOrThrow({ where: { id: periodId } })).status).toBe("OPEN");
    expect(await client.closingJob.count({ where: { periodId } })).toBe(0);
    expect(await client.auditLog.count({ where: { entityId: periodId, action: "REOPEN_PERIOD" } })).toBe(1);
  });

  it("rolls back nonzero reformation, then closes and reopens without losing the source entries", async () => {
    const expense = await client.account.create({ data: {
      code: `expense-${randomUUID()}`, name: "Synthetic expense", type: "TRANSIT",
    } });
    const payable = await client.account.create({ data: {
      code: `payable-${randomUUID()}`, name: "Synthetic payable", type: "LIABILITY",
    } });
    createdFixtureAccounts.push(expense.id, payable.id);
    const sourceType = await client.documentType.create({ data: {
      code: `source-${randomUUID()}`, name: "Synthetic source", postingTemplate: { lines: [] },
    } });
    createdFixtureTypes.push(sourceType.id);
    if (!await client.documentType.findUnique({ where: { code: "PERIOD_CLOSING" } })) {
      const closingType = await client.documentType.create({ data: {
        code: "PERIOD_CLOSING", name: "Synthetic reformation", postingTemplate: { lines: [] },
      } });
      createdFixtureTypes.push(closingType.id);
    }
    const date = new Date(Date.UTC(2026, month - 1, 10));
    const source = await client.document.create({ data: {
      orgId, periodId, typeId: sourceType.id, status: "POSTED", date, payload: {},
      journalEntries: { create: [
        { accountId: expense.id, debit: "123.45", credit: "0", date },
        { accountId: payable.id, debit: "0", credit: "123.45", date },
      ] },
    } });
    const original = await client.journalEntry.findMany({ where: { documentId: source.id }, orderBy: { id: "asc" } });
    database.failBeforeLock = true;
    await expect(finalizePeriod(periodId, orgId, "synthetic-user")).rejects.toThrow("injected lock failure");
    expect(await client.document.count({ where: { periodId } })).toBe(1);
    expect(await client.closingJob.count({ where: { periodId } })).toBe(0);
    database.failBeforeLock = false;
    await finalizePeriod(periodId, orgId, "synthetic-user");
    const closing = await client.document.findFirstOrThrow({
      where: { periodId, type: { code: "PERIOD_CLOSING" } }, include: { journalEntries: { include: { account: true } } },
    });
    expect(closing.journalEntries.map((entry) => [entry.account.code, entry.debit.toString(), entry.credit.toString()])).toEqual(
      expect.arrayContaining([["9910", "123.45", "0"], [expense.code, "0", "123.45"]]),
    );
    expect(closing.journalEntries).toHaveLength(2);
    expect(closing.date.toISOString()).toBe("2026-08-31T18:59:59.999Z");
    expect(closing.journalEntries.every((entry) => entry.date.getTime() === closing.date.getTime())).toBe(true);
    expect((await client.period.findUniqueOrThrow({ where: { id: periodId } })).lockDate).toEqual(closing.date);
    expect((await reopen()).status).toBe(200);
    expect(await client.document.count({ where: { periodId } })).toBe(1);
    expect(await client.journalEntry.findMany({ where: { documentId: source.id }, orderBy: { id: "asc" } })).toEqual(original);
  });

  it.each(["SALARY_OFFSET", "RENT_ACCRUAL"])("preserves debt when reopening %s", async (systemCode) => {
    const account = await client.account.create({ data: {
      code: `debt-${randomUUID()}`, name: "Synthetic settlement", type: "ACTIVE_PASSIVE",
    } });
    createdFixtureAccounts.push(account.id);
    const externalType = await client.documentType.create({ data: {
      code: `external-${randomUUID()}`, name: "Synthetic external document", postingTemplate: { lines: [] },
    } });
    createdFixtureTypes.push(externalType.id);
    let systemType = await client.documentType.findUnique({ where: { code: systemCode } });
    if (!systemType) {
      systemType = await client.documentType.create({ data: {
        code: systemCode, name: "Synthetic closing document", postingTemplate: { lines: [] },
      } });
      createdFixtureTypes.push(systemType.id);
    }
    const date = new Date(Date.UTC(2026, month - 1, 10));
    const externalDoc = await client.document.create({ data: {
      orgId, periodId, typeId: externalType.id, date, status: "POSTED", payload: {},
    } });
    const systemDoc = await client.document.create({ data: {
      orgId, periodId, typeId: systemType.id, date, status: "POSTED", payload: {},
    } });
    const externalSettlement = systemCode === "RENT_ACCRUAL";
    const item = await client.openItem.create({ data: {
      orgId, accountId: account.id, amount: "100", status: "CLOSED", dateOpened: date, dateClosed: date,
      openingDocumentId: externalSettlement ? systemDoc.id : externalDoc.id,
      closingDocumentId: externalSettlement ? externalDoc.id : systemDoc.id,
    } });
    await client.period.update({ where: { id: periodId }, data: { status: "CLOSED", lockDate: date } });
    expect((await reopen()).status).toBe(externalSettlement ? 400 : 200);
    if (externalSettlement) {
      expect(await client.openItem.findUniqueOrThrow({ where: { id: item.id } })).toEqual(item);
      expect(await client.document.count({ where: { periodId } })).toBe(2);
      expect((await client.period.findUniqueOrThrow({ where: { id: periodId } })).status).toBe("CLOSED");
    } else {
      expect(await client.openItem.findUniqueOrThrow({ where: { id: item.id } })).toMatchObject({
        status: "OPEN", closingDocumentId: null, dateClosed: null, openingDocumentId: externalDoc.id,
      });
      expect(await client.document.findUnique({ where: { id: systemDoc.id } })).toBeNull();
      expect(await client.document.findUnique({ where: { id: externalDoc.id } })).not.toBeNull();
    }
  });

  async function prepareYearEnd(isProfit: boolean) {
    const year = 2030 + month;
    const date = tashkentDate(year, 11, 20);
    await client.period.update({ where: { id: periodId }, data: { year, month: 12, status: "CLOSED", lockDate: date } });
    if (!await client.account.findUnique({ where: { code: "8710" } })) {
      createdFixtureAccounts.push((await client.account.create({ data: {
        code: "8710", name: "Synthetic retained result", type: "LIABILITY",
      } })).id);
    }
    const resultAccount = await client.account.findUniqueOrThrow({ where: { code: "9910" } });
    const otherAccount = await client.account.create({ data: {
      code: `year-other-${randomUUID()}`, name: "Synthetic contra account", type: "ASSET",
    } });
    createdFixtureAccounts.push(otherAccount.id);
    const sourceType = await client.documentType.create({ data: {
      code: `year-source-${randomUUID()}`, name: "Synthetic year source", postingTemplate: { lines: [] },
    } });
    createdFixtureTypes.push(sourceType.id);
    if (!await client.documentType.findUnique({ where: { code: "YEAR_END_CLOSE" } })) {
      createdFixtureTypes.push((await client.documentType.create({ data: {
        code: "YEAR_END_CLOSE", name: "Synthetic year end", postingTemplate: { lines: [] },
      } })).id);
    }
    await client.document.create({ data: {
      orgId, periodId, typeId: sourceType.id, status: "POSTED", date, payload: {},
      journalEntries: { create: [
        { accountId: resultAccount.id, debit: isProfit ? "0" : "123.45", credit: isProfit ? "123.45" : "0", date },
        { accountId: otherAccount.id, debit: isProfit ? "123.45" : "0", credit: isProfit ? "0" : "123.45", date },
      ] },
    } });
    return year;
  }

  const transferYear = () => closeYear(new NextRequest("http://localhost/api/closing/year-end", {
    method: "POST", body: JSON.stringify({ periodId }),
  }));

  it.each([true, false])("serializes year-end requests for profit=%s", async (isProfit) => {
    const year = await prepareYearEnd(isProfit);
    const responses = await Promise.all([transferYear(), transferYear()]);
    expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
    const docs = await client.document.findMany({
      where: { periodId, type: { code: "YEAR_END_CLOSE" } }, include: { journalEntries: { include: { account: true } } },
    });
    expect(docs).toHaveLength(1);
    expect(docs[0].date).toEqual(new Date(tashkentDate(year + 1, 0, 1).getTime() - 1));
    expect(docs[0].journalEntries.map((entry) => [entry.account.code, entry.debit.toString(), entry.credit.toString()])).toEqual(
      expect.arrayContaining(isProfit
        ? [["9910", "123.45", "0"], ["8710", "0", "123.45"]]
        : [["8710", "123.45", "0"], ["9910", "0", "123.45"]]),
    );
    expect(await client.auditLog.count({ where: { orgId, entityId: docs[0].id, userId: "synthetic-user", action: "YEAR_END_CLOSE" } })).toBe(1);
  });

  it("does not write a year-end transfer into a concurrently reopened period", async () => {
    await prepareYearEnd(true);
    const [transfer, reopening] = await Promise.all([transferYear(), reopen()]);
    const period = await client.period.findUniqueOrThrow({ where: { id: periodId } });
    const transfers = await client.document.count({ where: { periodId, type: { code: "YEAR_END_CLOSE" } } });
    if (period.status === "OPEN") {
      expect(transfer.status).toBe(400);
      expect(reopening.status).toBe(200);
      expect(transfers).toBe(0);
    } else {
      expect(transfer.status).toBe(200);
      expect(reopening.status).toBe(400);
      expect(transfers).toBe(1);
    }
  });

  it.each(["legacy", "job"])("preserves invalid %s accrual state without partial closure", async source => {
    const data = { currentStep: 8, accruals: { salaryAmount: 0, depreciationAmount: "-0.01", rentAmount: 0, expenseAccountCode: "" } };
    if (source === "legacy") {
      await client.period.update({ where: { id: periodId }, data: { closingData: data } });
    } else {
      await client.closingJob.create({ data: { periodId, orgId, status: "DRAFT", step: 8, data } });
    }
    const periodBefore = await client.period.findUniqueOrThrow({ where: { id: periodId } });
    const jobBefore = await client.closingJob.findUnique({ where: { periodId_orgId: { periodId, orgId } } });
    await expect(finalizePeriod(periodId, orgId, "synthetic-user")).rejects.toThrow(/Амортизация/);
    expect(await client.period.findUnique({ where: { id: periodId } })).toEqual(periodBefore);
    expect(await client.closingJob.findUnique({ where: { periodId_orgId: { periodId, orgId } } })).toEqual(jobBefore);
    expect(await client.document.count({ where: { periodId } })).toBe(0);
    expect(await client.taxCalendarEvent.count({ where: { periodId } })).toBe(0);
    expect(await client.auditLog.count({ where: { entityId: periodId, action: "CLOSE_PERIOD" } })).toBe(0);
  });

  it("blocks a stored nonzero FX difference without a rate", async () => {
    await client.period.update({ where: { id: periodId }, data: { closingData: { fxDiff: { exchangeRate: 0, difference: 100 } } } });
    await expect(finalizePeriod(periodId, orgId, "synthetic-user")).rejects.toThrow(/положительный курс/);
    expect((await client.period.findUniqueOrThrow({ where: { id: periodId } })).status).toBe("OPEN");
    expect(await client.closingJob.count({ where: { periodId } })).toBe(0);
    expect(await client.document.count({ where: { periodId } })).toBe(0);
  });

  it.each([
    { source: "legacy", currency: "EUR", difference: 0 },
    { source: "job", currency: "EUR", difference: 0 },
    { source: "job", currency: "RUB", difference: 12.01 },
  ])("preserves $source FX state and all registers when $currency is unsupported", async ({ source, currency, difference }) => {
    const data = { currentStep: 8, fxDiff: { exchangeRate: 12500, difference } };
    if (source === "legacy") {
      await client.period.update({ where: { id: periodId }, data: { closingData: data } });
    } else {
      await client.closingJob.create({ data: { periodId, orgId, status: "DRAFT", step: 8, data } });
    }
    await client.bankAccount.update({ where: { id: bankAccountId }, data: { currency } });
    try {
      const periodBefore = await client.period.findUniqueOrThrow({ where: { id: periodId } });
      const jobBefore = await client.closingJob.findUnique({ where: { periodId_orgId: { periodId, orgId } } });
      await expect(saveClosingState(periodId, { currentStep: 6, fxDiff: { exchangeRate: 0, difference: 0 } }, orgId))
        .rejects.toThrow(/переоценка банковских счетов/);
      await expect(finalizePeriod(periodId, orgId, "synthetic-user")).rejects.toThrow(/переоценка банковских счетов/);
      expect(await client.period.findUnique({ where: { id: periodId } })).toEqual(periodBefore);
      expect(await client.closingJob.findUnique({ where: { periodId_orgId: { periodId, orgId } } })).toEqual(jobBefore);
      expect(await client.document.count({ where: { periodId } })).toBe(0);
      expect(await client.taxCalendarEvent.count({ where: { periodId } })).toBe(0);
      expect(await client.auditLog.count({ where: { entityId: periodId, action: "CLOSE_PERIOD" } })).toBe(0);
    } finally {
      await client.bankAccount.update({ where: { id: bankAccountId }, data: { currency: "UZS" } });
    }
  });

  it("does not block UZS closure because another tenant has EUR accounts", async () => {
    const foreignOrgId = `foreign-fx-${randomUUID()}`;
    await client.organization.create({ data: { id: foreignOrgId, name: "Synthetic foreign FX" } });
    try {
      await client.bankAccount.create({ data: { orgId: foreignOrgId, name: "Synthetic EUR", currency: "EUR" } });
      await saveClosingState(periodId, { currentStep: 6, fxDiff: { exchangeRate: 0, difference: 0 } }, orgId);
      expect((await finalizePeriod(periodId, orgId, "synthetic-user")).period.status).toBe("CLOSED");
    } finally {
      await client.organization.delete({ where: { id: foreignOrgId } });
    }
  });
});
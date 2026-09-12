import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { NextRequest } from "next/server";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/cashflow/route";

const state = vi.hoisted(() => ({ client: null as PrismaClient | null, orgId: "", afterMovements: null as null | (() => Promise<void>) }));
vi.mock("@/lib/prisma", () => ({ default: new Proxy({}, {
  get(_target, property) {
    if (property === "$transaction") return (callback: (tx: any) => Promise<unknown>, options: any) =>
      state.client!.$transaction(tx => callback(new Proxy(tx, {
        get(target, key) {
          if (key === "journalEntry") return new Proxy(target.journalEntry, {
            get(model, method) {
              if (method === "findMany") return async (args: any) => {
                const entries = await model.findMany(args);
                await state.afterMovements?.();
                return entries;
              };
              return Reflect.get(model, method);
            },
          });
          const value = Reflect.get(target, key);
          return typeof value === "function" ? value.bind(target) : value;
        },
      })), options);
    const value = Reflect.get(state.client!, property);
    return typeof value === "function" ? value.bind(state.client) : value;
  },
}) }));
vi.mock("@/lib/context", () => ({ getActiveOrgId: async () => state.orgId }));

const databaseUrl = process.env.ACC_TEST_DATABASE_URL;
if (databaseUrl) {
  const parsed = new URL(databaseUrl);
  if (parsed.hostname !== "127.0.0.1" || parsed.pathname !== "/contador_safety_test") {
    throw new Error("ACC_TEST_DATABASE_URL must target the disposable loopback contador_safety_test database");
  }
}

describe.skipIf(!databaseUrl)("cashflow bank selection on disposable PostgreSQL", () => {
  const client = new PrismaClient({ datasourceUrl: databaseUrl });
  const createdAccounts: string[] = [];
  const accountIds: Record<string, string> = {};
  let typeId: string;
  let foreignOrgId: string;
  let firstBank: string;
  let secondBank: string;
  let foreignBank: string;

  beforeAll(async () => {
    state.client = client;
    for (const code of ["5110", "9030"]) {
      let account = await client.account.findUnique({ where: { code } });
      if (!account) {
        account = await client.account.create({ data: { code, name: "Synthetic cashflow account", type: code === "5110" ? "ASSET" : "TRANSIT" } });
        createdAccounts.push(account.id);
      }
      accountIds[code] = account.id;
    }
    typeId = (await client.documentType.create({ data: {
      code: `CASHFLOW_TEST_${randomUUID()}`, name: "Synthetic cashflow", postingTemplate: {},
    } })).id;
  });

  beforeEach(async () => {
    state.afterMovements = null;
    state.orgId = `cashflow-${randomUUID()}`;
    foreignOrgId = `foreign-${randomUUID()}`;
    await client.organization.createMany({ data: [state.orgId, foreignOrgId].map(id => ({ id, name: "Synthetic cashflow org" })) });
    await client.period.createMany({ data: [state.orgId, foreignOrgId].flatMap(orgId => [8, 9, 10].map(month => ({
      id: `${orgId}-${month}`, orgId, year: 2026, month,
    }))) });
    const bank = async (orgId: string) => (await client.bankAccount.create({ data: { orgId, name: "Synthetic bank", currency: "UZS" } })).id;
    firstBank = await bank(state.orgId);
    secondBank = await bank(state.orgId);
    foreignBank = await bank(foreignOrgId);
  });

  afterEach(async () => {
    await client.stagedTransaction.deleteMany({ where: { orgId: { in: [state.orgId, foreignOrgId] } } });
    await client.organization.deleteMany({ where: { id: { in: [state.orgId, foreignOrgId] } } });
  });

  afterAll(async () => {
    try {
      await client.documentType.delete({ where: { id: typeId } });
      await client.account.deleteMany({ where: { id: { in: createdAccounts } } });
    } finally {
      await client.$disconnect();
    }
  });

  async function link(documentId: string, bankAccountId: string, orgId = state.orgId) {
    return client.stagedTransaction.create({ data: {
      orgId, bankAccountId, periodId: `${orgId}-9`, documentId,
      date: new Date("2026-09-10T00:00:00Z"), amount: "1", direction: "CREDIT",
      description: "Synthetic source", hash: randomUUID(),
    } });
  }

  async function entry(bankId: string | null, amount: string, options: { month?: number; owner?: string; expense?: boolean; date?: string } = {}) {
    const orgId = options.owner ?? state.orgId;
    const month = options.month ?? 9;
    const date = new Date(options.date ?? `2026-${String(month).padStart(2, "0")}-10T00:00:00Z`);
    const document = await client.document.create({ data: {
      orgId, periodId: `${orgId}-${month}`, typeId, date, payload: {}, status: "POSTED",
      journalEntries: { create: [
        { accountId: accountIds["5110"], date, debit: options.expense ? "0" : amount, credit: options.expense ? amount : "0" },
        { accountId: accountIds["9030"], date, debit: options.expense ? amount : "0", credit: options.expense ? "0" : amount },
      ] },
    } });
    if (bankId) await link(document.id, bankId, orgId);
    return document;
  }

  function report(accountId = firstBank) {
    return GET(new NextRequest(`http://localhost/api/cashflow?from=2026-09-01&to=2026-09-30&accountId=${accountId}`));
  }

  it.each(["UZS", "USD", "EUR"])("selects one %s bank by actual links, not currency or ledger-code assumptions", async (currency) => {
    await client.bankAccount.updateMany({ where: { orgId: state.orgId }, data: { currency } });
    await entry(firstBank, "10", { month: 8 });
    await entry(firstBank, "20");
    await entry(firstBank, "5", { expense: true });
    await entry(secondBank, "1000", { month: 8 });
    await entry(secondBank, "2000");
    await entry(secondBank, "50", { expense: true });
    await entry(foreignBank, "50000", { owner: foreignOrgId });
    const response = await report();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({ openingBalance: 10, closingBalance: 25, netFlow: [15], hasMixedCurrencies: false,
      openingBalanceUZS: 10, closingBalanceUZS: 25, openingBalanceUSD: 0, closingBalanceUSD: 0 });
    expect(body.income.find((row: any) => row.categoryCode === "OTHER_INFLOW").total).toBe(20);
    expect(body.expense.find((row: any) => row.categoryCode === "OTHER_OUTFLOW").total).toBe(5);
    expect(await (await report(secondBank)).json()).toMatchObject({ openingBalance: 1000, closingBalance: 2950, netFlow: [1950] });
  });

  it("does not multiply journal amounts when a document has repeated sources from the same bank", async () => {
    const document = await entry(firstBank, "12.01");
    await link(document.id, firstBank);
    expect(await (await report()).json()).toMatchObject({ openingBalance: 0, closingBalance: 12.01, netFlow: [12.01] });
  });

  it.each(["selected", "ALL"])("includes the entire accounting month and reconciles its boundary amounts for %s", async (scope) => {
    await entry(firstBank, "10", { month: 8, date: "2026-08-31T18:59:59.999Z" });
    await entry(firstBank, "20", { date: "2026-08-31T19:00:00.000Z" });
    await entry(firstBank, "5", { expense: true, date: "2026-09-30T18:59:59.999Z" });
    await entry(null, "1000", { month: 10, date: "2026-09-30T19:00:00.000Z" });
    await entry(foreignBank, "50000", { owner: foreignOrgId, date: "2026-09-30T18:59:59.999Z" });
    const voided = await entry(firstBank, "100", { date: "2026-09-30T18:00:00Z" });
    await client.document.update({ where: { id: voided.id }, data: { status: "VOIDED" } });
    const response = await report(scope === "ALL" ? "ALL" : firstBank);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({ months: ["2026-09"], openingBalance: 10, closingBalance: 25,
      openingBalanceUZS: 10, closingBalanceUZS: 25, openingBalanceUSD: 0, closingBalanceUSD: 0, netFlow: [15] });
    expect(body.income.find((row: any) => row.categoryCode === "OTHER_INFLOW").amounts).toEqual([20]);
    expect(body.expense.find((row: any) => row.categoryCode === "OTHER_OUTFLOW").amounts).toEqual([5]);
    expect(body.openingBalance + body.netFlow[0]).toBe(body.closingBalance);
  });

  it("groups adjacent accounting months across the UTC boundary", async () => {
    await entry(firstBank, "10", { month: 8, date: "2026-08-31T18:59:59.999Z" });
    await entry(firstBank, "20", { date: "2026-08-31T19:00:00Z" });
    const response = await GET(new NextRequest(`http://localhost/api/cashflow?from=2026-08-31&to=2026-09-01&accountId=${firstBank}`));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ months: ["2026-08", "2026-09"],
      openingBalance: 0, closingBalance: 30, netFlow: [10, 20] });
  });

  it("reads movements and balances from one snapshot when a source changes banks concurrently", async () => {
    const document = await entry(firstBank, "12.01");
    state.afterMovements = async () => {
      await client.stagedTransaction.updateMany({ where: { documentId: document.id }, data: { bankAccountId: secondBank } });
    };
    const response = await report();
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ openingBalance: 0, closingBalance: 12.01, netFlow: [12.01] });
    state.afterMovements = null;
    expect(await (await report()).json()).toMatchObject({ closingBalance: 0, netFlow: [0] });
  });

  it("refuses unlinked banking entries but preserves the aggregate report", async () => {
    await entry(null, "10");
    expect((await report()).status).toBe(409);
    expect((await report("ALL")).status).toBe(200);
  });

  it("refuses a document linked to two different banks", async () => {
    const document = await entry(firstBank, "10");
    await link(document.id, secondBank);
    expect((await report()).status).toBe(409);
    expect((await report(secondBank)).status).toBe(409);
  });

  it("refuses a foreign source masquerading as an own bank link", async () => {
    const document = await entry(null, "10");
    await link(document.id, firstBank, foreignOrgId);
    expect((await report()).status).toBe(409);
  });

  it("returns 404 for another organization's bank instead of all own movements", async () => {
    await entry(firstBank, "10");
    expect((await report(foreignBank)).status).toBe(404);
  });
});
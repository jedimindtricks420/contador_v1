import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { GET as getPnl } from "@/app/api/pnl/route";
import { GET as getBalance } from "@/app/api/reports/balance/route";

const { database, activeOrg } = vi.hoisted(() => ({
  database: { $queryRaw: vi.fn(), organization: { findUnique: vi.fn() } },
  activeOrg: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ default: database }));
vi.mock("@/lib/context", () => ({ getActiveOrgId: activeOrg }));

const databaseUrl = process.env.ACC_TEST_DATABASE_URL;
if (databaseUrl) {
  const parsed = new URL(databaseUrl);
  if (parsed.hostname !== "127.0.0.1" || parsed.pathname !== "/contador_safety_test") {
    throw new Error("ACC_TEST_DATABASE_URL must target the disposable loopback contador_safety_test database");
  }
}

describe.skipIf(!databaseUrl)("financial reports on disposable PostgreSQL", () => {
  const client = new PrismaClient({ datasourceUrl: databaseUrl });
  const fixtureId = randomUUID();
  const orgId = `report-${fixtureId}`;
  const foreignOrgId = `foreign-report-${fixtureId}`;
  const typeId = `report-type-${fixtureId}`;
  const accountIds = new Map<string, string>();
  const createdAccountIds: string[] = [];
  let closingTypeId: string;
  let createdClosingType = false;

  beforeAll(async () => {
    database.$queryRaw.mockImplementation(client.$queryRaw.bind(client));
    database.organization.findUnique.mockImplementation(client.organization.findUnique.bind(client.organization));
    activeOrg.mockResolvedValue(orgId);
    await client.organization.createMany({ data: [
      { id: orgId, name: "Synthetic report organization" },
      { id: foreignOrgId, name: "Synthetic foreign organization" },
    ] });
    await client.period.createMany({ data: [8, 9, 10].flatMap((month) => [orgId, foreignOrgId].map((owner) => ({
      id: `${owner}-${month}`, orgId: owner, year: 2026, month,
    }))) });
    for (const code of ["5110", "9030", "8710"]) {
      let account = await client.account.findUnique({ where: { code } });
      if (!account) {
        account = await client.account.create({ data: {
          code, name: "Synthetic report account", type: code === "9030" ? "TRANSIT" : code === "8710" ? "LIABILITY" : "ASSET",
        } });
        createdAccountIds.push(account.id);
      }
      accountIds.set(code, account.id);
    }
    await client.documentType.create({ data: { id: typeId, code: typeId, name: "Synthetic report", postingTemplate: {} } });
    let closingType = await client.documentType.findUnique({ where: { code: "PERIOD_CLOSING" } });
    if (!closingType) {
      closingType = await client.documentType.create({ data: {
        code: "PERIOD_CLOSING", name: "Synthetic closing", postingTemplate: {},
      } });
      createdClosingType = true;
    }
    closingTypeId = closingType.id;

    const entry = async (date: string, month: number, amount: number, options: {
      owner?: string; debit?: string; credit?: string; closing?: boolean; voided?: boolean;
    } = {}) => {
      const owner = options.owner ?? orgId;
      const document = await client.document.create({ data: {
        orgId: owner, periodId: `${owner}-${month}`, typeId: options.closing ? closingTypeId : typeId,
        date: new Date(date), payload: {}, status: options.voided ? "VOIDED" : "POSTED",
      } });
      await client.journalEntry.createMany({ data: [
        { documentId: document.id, accountId: accountIds.get(options.debit ?? "5110")!, debit: amount, credit: 0, date: document.date },
        { documentId: document.id, accountId: accountIds.get(options.credit ?? "9030")!, debit: 0, credit: amount, date: document.date },
      ] });
    };
    await entry("2026-08-31T18:59:59.999Z", 8, 1);
    await entry("2026-08-31T19:00:00.000Z", 9, 10);
    await entry("2026-09-30T18:59:59.999Z", 9, 20);
    await entry("2026-09-30T19:00:00.000Z", 10, 1000);
    await entry("2026-09-15T00:00:00.000Z", 9, 500, { voided: true });
    await entry("2026-09-15T00:00:00.000Z", 9, 50000, { owner: foreignOrgId });
    await entry("2026-09-16T00:00:00.000Z", 9, 3, { debit: "9030", credit: "5110" });
    await entry("2026-09-30T18:59:59.999Z", 9, 27, { debit: "9030", credit: "8710", closing: true });
  });

  afterAll(async () => {
    try {
      await client.organization.deleteMany({ where: { id: { in: [orgId, foreignOrgId] } } });
      await client.documentType.deleteMany({ where: { id: typeId } });
      if (createdClosingType) await client.documentType.delete({ where: { id: closingTypeId } });
      await client.account.deleteMany({ where: { id: { in: createdAccountIds } } });
    } finally {
      await client.$disconnect();
    }
  });

  it("includes both September boundaries, nets reversals and excludes closing, voided and foreign entries", async () => {
    const response = await getPnl(new NextRequest("http://localhost/api/pnl?from=2026-09-01&to=2026-09-30"));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      lines: { line010: 27, line270: 27 }, months: ["2026-09"], monthlyRevenue: [27], monthlyNetProfit: [27],
    });
  });

  it("includes opening balances and closing entries, but excludes the next day, voided and foreign entries", async () => {
    const response = await getBalance(new NextRequest("http://localhost/api/reports/balance?to=2026-09-30"));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      line340: 28, line450: 28, line400: 28, line780: 28, balanceCheck: true, difference: 0,
    });
  });
});
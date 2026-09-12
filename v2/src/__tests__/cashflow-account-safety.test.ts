import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/cashflow/route";

const { database } = vi.hoisted(() => ({ database: {
  bankAccount: { findFirst: vi.fn(), findMany: vi.fn() },
  journalEntry: { findFirst: vi.fn(), findMany: vi.fn() },
  $queryRaw: vi.fn(),
  $transaction: vi.fn(),
} }));
vi.mock("@/lib/prisma", () => ({ default: database }));
vi.mock("@/lib/context", () => ({ getActiveOrgId: async () => "own-org" }));

describe("cashflow bank-account scope", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    database.$transaction.mockImplementation(async (callback) => callback(database));
    database.bankAccount.findFirst.mockResolvedValue({ id: "selected-bank", currency: "UZS" });
    database.bankAccount.findMany.mockResolvedValue([{ currency: "UZS" }, { currency: "USD" }]);
    database.journalEntry.findFirst.mockResolvedValue(null);
    database.journalEntry.findMany.mockResolvedValue([]);
    database.$queryRaw.mockResolvedValue([{ total: "0" }]);
  });

  function request(accountId = "selected-bank") {
    return GET(new NextRequest(`http://localhost/api/cashflow?from=2026-09-01&to=2026-09-30&accountId=${accountId}`));
  }

  it("requires the selected own bank source for movements and all six balance queries", async () => {
    const response = await request();
    expect(response.status).toBe(200);
    expect(database.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: "RepeatableRead", maxWait: 5000, timeout: 15000,
    });
    expect(database.bankAccount.findFirst).toHaveBeenCalledWith({ where: { id: "selected-bank", orgId: "own-org" } });
    expect(database.journalEntry.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({
      document: expect.objectContaining({ orgId: "own-org", stagedTransactions: { some: {
        orgId: "own-org", bankAccountId: "selected-bank", bankAccount: { orgId: "own-org" },
      } } }),
    }) }));
    expect(database.$queryRaw).toHaveBeenCalledTimes(6);
    for (const call of database.$queryRaw.mock.calls) {
      const scope = call.at(-1);
      expect(scope.sql).toContain('st."documentId" = d.id');
      expect(scope.values).toEqual(["own-org", "own-org", "selected-bank"]);
    }
    expect(await response.json()).toMatchObject({ hasMixedCurrencies: false });
  });

  it("rejects missing or foreign accounts without falling back to all accounts", async () => {
    database.bankAccount.findFirst.mockResolvedValue(null);
    expect((await request()).status).toBe(404);
    expect(database.journalEntry.findMany).not.toHaveBeenCalled();
    expect(database.$queryRaw).not.toHaveBeenCalled();
  });

  it.each([
    ["2026-02-29", "2026-09-30"], ["2026-09-01", "2026-09-31"],
    ["2026-10-01", "2026-09-30"], ["", "2026-09-30"],
    ["2026-09-01T00:00:00Z", "2026-09-30"],
  ])("rejects invalid range %s to %s before reading the ledger", async (from, to) => {
    const response = await GET(new NextRequest(`http://localhost/api/cashflow?from=${from}&to=${to}`));
    expect(response.status).toBe(400);
    expect(database.$transaction).not.toHaveBeenCalled();
  });

  it("uses Tashkent boundaries in source checks, movements and all balances", async () => {
    expect((await request()).status).toBe(200);
    const startDate = new Date("2026-08-31T19:00:00Z");
    const endExclusive = new Date("2026-09-30T19:00:00Z");
    expect(database.journalEntry.findFirst.mock.calls[0][0].where.document.date).toEqual({ lt: endExclusive });
    expect(database.journalEntry.findMany.mock.calls[0][0].where.document.date).toEqual({ gte: startDate, lt: endExclusive });
    for (const [index, call] of database.$queryRaw.mock.calls.entries()) {
      expect(call[0].join("?")).toContain("d.date < ?");
      expect(call[2]).toEqual(index % 2 === 0 ? startDate : endExclusive);
    }
  });

  it("groups regular and FX entries by the accounting month rather than the host month", async () => {
    database.journalEntry.findMany.mockResolvedValue([
      { debit: "10", credit: "0", document: { date: new Date("2026-08-31T19:00:00Z"), type: { code: "REVENUE_NO_VAT" } } },
      { debit: "0", credit: "2", document: { date: new Date("2026-08-31T20:00:00Z"), type: { code: "FX_DIFFERENCE" } } },
    ]);
    const body = await (await request()).json();
    expect(body.months).toEqual(["2026-09"]);
    expect(body.netFlow).toEqual([8]);
    expect(body.income.find((row: any) => row.categoryCode === "REVENUE").amounts).toEqual([10]);
    expect(body.expense.find((row: any) => row.categoryCode === "FX_LOSS").amounts).toEqual([2]);
  });

  it("refuses ambiguous ledger attribution before reporting balances", async () => {
    database.journalEntry.findFirst.mockResolvedValue({ id: "unallocated" });
    expect((await request()).status).toBe(409);
    expect(database.journalEntry.findMany).not.toHaveBeenCalled();
    expect(database.$queryRaw).not.toHaveBeenCalled();
  });

  it.each(["ALL", ""])("keeps the aggregate report for accountId=%s", async (accountId) => {
    const response = await request(accountId);
    expect(response.status).toBe(200);
    expect(database.bankAccount.findFirst).not.toHaveBeenCalled();
    expect(database.journalEntry.findFirst).not.toHaveBeenCalled();
    expect(await response.json()).toMatchObject({ hasMixedCurrencies: true });
  });
});
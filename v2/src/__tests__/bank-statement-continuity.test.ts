import { describe, expect, it } from "vitest";
import { assertBankStatementContinuity } from "@/lib/bankStatementContinuity";
import { bankSourceHash, buildBankImportSource } from "@/lib/bankImportBatch";

const accountNumber = "00000000000000000001";
const bank = { lastBalance: "10.00", lastSyncedAt: new Date("2026-10-01T01:00:00Z"), currency: "UZS", accountNumber };
const statement = { transactions: [], openingBalance: "10.00", periodStart: new Date("2026-10-01T00:00:00Z") };
const archive = () => ({ id: "previous", bankCurrency: "UZS", sourceData: Buffer.from("source"), sourceHash: bankSourceHash(Buffer.from("source")),
  statement: { accountNumber, periodEnd: "2026-09-30T00:00:00Z", closingBalance: "10.00" },
  result: { newValue: { ...bank, lastSyncedAt: bank.lastSyncedAt.toISOString() } },
});

describe("bank statement continuity", () => {
  it("archives a quiet period only when its exact balances agree", () => {
    const quiet = { ...statement, accountNumber, periodEnd: new Date("2026-10-31T00:00:00Z"), closingBalance: "10.00" };
    expect(buildBankImportSource(Buffer.from("source"), "quiet.txt", quiet)).toMatchObject({
      rows: [], statement: { rowCount: 0, openingBalance: "10.00", closingBalance: "10.00", credits: "0.00", debits: "0.00" },
    });
    expect(() => buildBankImportSource(Buffer.from("source"), "quiet.txt", { ...quiet, closingBalance: "10.01" })).toThrow();
  });
  it("allows one initial baseline and links an exact next period", () => {
    expect(assertBankStatementContinuity(statement, { ...bank, lastSyncedAt: null, lastBalance: "0.00" }, [])).toBeNull();
    expect(assertBankStatementContinuity(statement, bank, [archive()])).toBe("previous");
  });
  it.each(["2026-09-30T00:00:00Z", "2026-10-02T00:00:00Z", "2026-11-01T00:00:00Z"])("refuses overlap or gaps at %s even with identical balances", date => {
    expect(() => assertBankStatementContinuity({ ...statement, periodStart: new Date(date) }, bank, [archive()])).toThrow("пересекаются или имеют пропуск");
  });
  it("uses Tashkent calendar days rather than elapsed hours", () => {
    const previous = archive();
    previous.statement.periodEnd = "2026-09-30T18:59:59Z";
    expect(assertBankStatementContinuity({ ...statement, periodStart: new Date("2026-09-30T19:00:00Z") }, bank, [previous])).toBe("previous");
  });
  it.each(["missing", "duplicate", "hash", "balance", "currency", "account", "sync"])("refuses unconfirmed prior state: %s", broken => {
    const previous = archive();
    if (broken === "hash") previous.sourceHash = "invalid";
    if (broken === "balance") previous.statement.closingBalance = "10.01";
    if (broken === "currency") previous.bankCurrency = "USD";
    if (broken === "account") previous.statement.accountNumber = "00000000000000000002";
    if (broken === "sync") previous.result.newValue.lastSyncedAt = "2026-10-01T00:00:00.000Z";
    expect(() => assertBankStatementContinuity(statement, bank, broken === "missing" ? [] : broken === "duplicate" ? [previous, previous] : [previous])).toThrow();
  });
  it("refuses an opening mismatch and untracked initial history", () => {
    expect(() => assertBankStatementContinuity({ ...statement, openingBalance: "9.99" }, bank, [archive()])).toThrow();
    expect(() => assertBankStatementContinuity(statement, { ...bank, lastSyncedAt: null }, [archive()])).toThrow();
    expect(() => assertBankStatementContinuity(statement, { ...bank, lastSyncedAt: null, lastBalance: "9.99" }, [])).toThrow();
  });
});
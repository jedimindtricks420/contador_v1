import { describe, it, expect } from "vitest";

// Unit test for the mixed-currency detection logic
// (from /api/cashflow/route.ts)

const BANK_UZS_CODES = ["5110", "5111", "5112"] as const;
const BANK_USD_CODES = ["5210", "5211", "5212"] as const;
const BANK_ACCOUNT_CODES = [...BANK_UZS_CODES, ...BANK_USD_CODES] as const;

function detectMixedCurrencies(accountCodes: string[]): boolean {
  return (
    accountCodes.some((c) => BANK_UZS_CODES.includes(c as any)) &&
    accountCodes.some((c) => BANK_USD_CODES.includes(c as any))
  );
}

describe("CashFlow: mixed-currency detection", () => {
  it("returns false when only UZS accounts used", () => {
    expect(detectMixedCurrencies(["5110", "5111"])).toBe(false);
  });

  it("returns false when only USD accounts used", () => {
    expect(detectMixedCurrencies(["5210", "5211"])).toBe(false);
  });

  it("returns true when both UZS and USD accounts present (all accounts)", () => {
    expect(detectMixedCurrencies([...BANK_ACCOUNT_CODES])).toBe(true);
  });

  it("returns true when at least one UZS and one USD account", () => {
    expect(detectMixedCurrencies(["5110", "5210"])).toBe(true);
  });

  it("returns false for empty list", () => {
    expect(detectMixedCurrencies([])).toBe(false);
  });
});

describe("CashFlow: account code constants integrity", () => {
  it("BANK_ACCOUNT_CODES contains all UZS codes", () => {
    for (const code of BANK_UZS_CODES) {
      expect(BANK_ACCOUNT_CODES).toContain(code);
    }
  });

  it("BANK_ACCOUNT_CODES contains all USD codes", () => {
    for (const code of BANK_USD_CODES) {
      expect(BANK_ACCOUNT_CODES).toContain(code);
    }
  });

  it("UZS and USD code sets have no overlap", () => {
    const overlap = BANK_UZS_CODES.filter((c) =>
      BANK_USD_CODES.includes(c as any)
    );
    expect(overlap).toHaveLength(0);
  });
});

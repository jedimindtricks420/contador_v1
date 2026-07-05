/**
 * Protective test (item 4 of the ТЗ): every account in the chart of accounts
 * (seed-coa.ts) with type ASSET or CONTRA_ASSET, excluding the 5xxx cash group
 * (tracked by its own separate lines 320-380 in balance/route.ts), must appear
 * somewhere in BALANCE_NON_CASH_ASSET_CODES — the single array balance/route.ts's
 * asset-side Форма №1 lines are actually built from (line010 through line310).
 *
 * If this fails, someone added a new ASSET/CONTRA_ASSET account to seed-coa.ts
 * without adding it to the corresponding balance-sheet line — it would silently
 * vanish from Форма №1 instead of appearing anywhere.
 *
 * Full переход to Account.group-based filtering (instead of hand-picked code
 * lists) is a separate, later iteration — see ТЗ item 7.
 */
import { describe, it, expect } from "vitest";
import { MASTER_COA } from "@/lib/seed-coa";
import { BALANCE_NON_CASH_ASSET_CODES } from "@/app/api/reports/balance/route";

describe("balance-sheet-completeness — every non-cash ASSET/CONTRA_ASSET account is on a Форма №1 line", () => {
  it("has no uncovered account codes", () => {
    const codeSet = new Set(BALANCE_NON_CASH_ASSET_CODES);

    const uncovered = MASTER_COA.filter(
      (acc) =>
        (acc.type === "ASSET" || acc.type === "CONTRA_ASSET") &&
        !acc.isDeprecated &&
        !acc.code.startsWith("5") &&
        !codeSet.has(acc.code)
    );

    expect(uncovered.map((a) => `${a.code} ${a.name}`)).toEqual([]);
  });

  it("BALANCE_NON_CASH_ASSET_CODES has no duplicate codes (a line double-counting itself)", () => {
    const seen = new Set<string>();
    const duplicates = BALANCE_NON_CASH_ASSET_CODES.filter((code) => {
      if (seen.has(code)) return true;
      seen.add(code);
      return false;
    });
    expect(duplicates).toEqual([]);
  });
});

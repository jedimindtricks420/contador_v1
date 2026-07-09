/**
 * Protective test — mirrors balance-sheet-completeness.test.ts but for the passive
 * side of Форма №1 (собственный капитал + обязательства, строки 410-760).
 *
 * Every account in the chart of accounts (seed-coa.ts) with type LIABILITY,
 * CONTRA_LIABILITY, or ACTIVE_PASSIVE must appear somewhere in
 * BALANCE_PASSIVE_CODES — the single array balance/route.ts's passive-side lines
 * are actually built from — with one documented exception (see
 * ACTIVE_PASSIVE_EXCLUDED below).
 *
 * If this fails, someone added a new LIABILITY/CONTRA_LIABILITY/ACTIVE_PASSIVE
 * account to seed-coa.ts without adding it to the corresponding balance-sheet
 * line — it would silently vanish from Форма №1 instead of appearing anywhere.
 */
import { describe, it, expect } from "vitest";
import { MASTER_COA } from "@/lib/seed-coa";
import { BALANCE_PASSIVE_CODES } from "@/app/api/reports/balance/route";

// 0000 "Вспомогательный (ввод начальных остатков)" — a system/setup helper account,
// not referenced by any document template (ensureBaseData.ts) or report line.
// Excluded consciously, same pattern as PNL_UNUSED_TRANSIT_CODES in pnl/route.ts.
const ACTIVE_PASSIVE_EXCLUDED = new Set(["0000"]);

describe("balance-sheet-liabilities-completeness — every LIABILITY/CONTRA_LIABILITY/ACTIVE_PASSIVE account is on a Форма №1 line", () => {
  it("has no uncovered account codes", () => {
    const codeSet = new Set(BALANCE_PASSIVE_CODES);

    const uncovered = MASTER_COA.filter(
      (acc) =>
        (acc.type === "LIABILITY" || acc.type === "CONTRA_LIABILITY" || acc.type === "ACTIVE_PASSIVE") &&
        !acc.isDeprecated &&
        !codeSet.has(acc.code) &&
        !ACTIVE_PASSIVE_EXCLUDED.has(acc.code)
    );

    expect(uncovered.map((a) => `${a.code} ${a.name}`)).toEqual([]);
  });

  it("BALANCE_PASSIVE_CODES has no duplicate codes (a line double-counting itself)", () => {
    const seen = new Set<string>();
    const duplicates = BALANCE_PASSIVE_CODES.filter((code) => {
      if (seen.has(code)) return true;
      seen.add(code);
      return false;
    });
    expect(duplicates).toEqual([]);
  });
});

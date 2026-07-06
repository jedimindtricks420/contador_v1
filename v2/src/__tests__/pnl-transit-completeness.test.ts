/**
 * Protective test — mirrors balance-sheet-completeness.test.ts but for Форма №2
 * (P&L). Every TRANSIT account in the chart of accounts (seed-coa.ts) must either:
 *   a) appear in PNL_COVERED_TRANSIT_CODES (combined with REVENUE_ACCOUNT_CODES /
 *      COGS_ACCOUNT_CODES / ACCOUNTS.EXPENSE_* — the same single-source-of-truth
 *      arrays pnl/route.ts actually computes its lines from), or
 *   b) be explicitly listed in PNL_INTENTIONALLY_EXCLUDED_TRANSIT_CODES with a
 *      documented reason — either PNL_ZERO_NET_TRANSIT_CODES (used by templates
 *      but always nets to zero, e.g. 9210) or PNL_UNUSED_TRANSIT_CODES (not
 *      posted to by any document type at all, e.g. 9140/9150/9220/9910).
 *
 * This is exactly the gap that let TURNOVER_TAX_ACCRUAL briefly regress from 9810
 * to 9820 without any automated check noticing account-level drift (see
 * docs/errors_forms_audit_2026_07_03_*.md and Contador_CHANGELOG_FULL_v3.md П1.2).
 *
 * The second check below is the important safety net: if a document type in
 * ensureBaseData.ts ever starts posting to one of the "intentionally excluded"
 * codes, this test fails — forcing someone to consciously decide which Форма №2
 * line it belongs on, instead of it silently vanishing from the report.
 */
import { describe, it, expect } from "vitest";
import { MASTER_COA } from "@/lib/seed-coa";
import { baseDocumentTypes } from "@/lib/ensureBaseData";
import {
  PNL_COVERED_TRANSIT_CODES,
  PNL_INTENTIONALLY_EXCLUDED_TRANSIT_CODES,
  PNL_UNUSED_TRANSIT_CODES,
} from "@/app/api/pnl/route";

describe("pnl-transit-completeness — every TRANSIT account is covered or consciously excluded from Форма №2", () => {
  it("has no TRANSIT account outside both PNL_COVERED_TRANSIT_CODES and PNL_INTENTIONALLY_EXCLUDED_TRANSIT_CODES", () => {
    const coveredSet = new Set(PNL_COVERED_TRANSIT_CODES);
    const excludedSet = new Set(PNL_INTENTIONALLY_EXCLUDED_TRANSIT_CODES);

    const uncovered = MASTER_COA.filter(
      (acc) =>
        acc.type === "TRANSIT" &&
        !acc.isDeprecated &&
        !coveredSet.has(acc.code) &&
        !excludedSet.has(acc.code)
    );

    expect(uncovered.map((a) => `${a.code} ${a.name}`)).toEqual([]);
  });

  it("PNL_COVERED_TRANSIT_CODES has no duplicate codes", () => {
    const seen = new Set<string>();
    const duplicates = PNL_COVERED_TRANSIT_CODES.filter((code) => {
      if (seen.has(code)) return true;
      seen.add(code);
      return false;
    });
    expect(duplicates).toEqual([]);
  });

  it("no code appears in both the covered and the excluded list", () => {
    const coveredSet = new Set(PNL_COVERED_TRANSIT_CODES);
    const overlap = PNL_INTENTIONALLY_EXCLUDED_TRANSIT_CODES.filter((c) => coveredSet.has(c));
    expect(overlap).toEqual([]);
  });

  it("no document type template actually posts to an 'unused' account — if one does, it must be moved into a covered P&L line instead of silently excluded", () => {
    // Deliberately scoped to PNL_UNUSED_TRANSIT_CODES, not the full excluded list —
    // PNL_ZERO_NET_TRANSIT_CODES (e.g. 9210) is EXPECTED to appear in templates,
    // it just always nets to zero, so its presence there isn't a regression.
    const excludedSet = new Set(PNL_UNUSED_TRANSIT_CODES);
    const offenders: string[] = [];

    for (const doc of baseDocumentTypes) {
      const template = doc.template as { lines?: { accountCode: string }[] };
      for (const line of template.lines ?? []) {
        if (line.accountCode.startsWith("$")) continue; // dynamic, payload-driven — not a fixed code
        if (excludedSet.has(line.accountCode)) {
          offenders.push(`${doc.code} → ${line.accountCode}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});

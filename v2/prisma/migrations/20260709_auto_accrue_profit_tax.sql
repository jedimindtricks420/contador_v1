-- Migration: per-organization switch for automatic profit tax accrual.
-- closing.ts E2 accrues Дт9810/Кт6410 = netProfit × 15% on every period finalize
-- for VAT-regime orgs. The formula is a monthly approximation (no year-to-date
-- cumulative base, no loss offset, no tax-base adjustments), so orgs that compute
-- profit tax manually need a way to keep the closing wizard without the posting.
--
-- autoAccrueProfitTax = false → finalize still creates the PROFIT_TAX calendar
-- reminder, but skips the PROFIT_TAX_ACCRUAL document/posting.
--
-- Purely additive; default true preserves current behaviour for all existing orgs.

ALTER TABLE "Organization"
  ADD COLUMN "autoAccrueProfitTax" BOOLEAN NOT NULL DEFAULT true;

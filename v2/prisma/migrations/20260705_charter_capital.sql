-- Migration: charter capital tracking on Organization.
-- Adds the fields backing НСБУ-21 §344/§348 compliant charter-capital accounting:
-- CAPITAL_CONTRIBUTION now credits 4610 (founders' debt) instead of crediting
-- 8330 directly — 8330 only increases via the OPENING_CAPITAL_DECLARATION
-- document created by POST /api/settings/charter-capital. See ensureBaseData.ts
-- (CAPITAL_CONTRIBUTION / CAPITAL_INCREASE_PENDING / CAPITAL_INCREASE_REGISTERED /
-- OPENING_CAPITAL_DECLARATION) and postingEngine.ts's CAPITAL_CONTRIBUTION guard.
--
-- Purely additive — nullable columns + a new enum type, no data migration needed.
-- Existing orgs simply have charterCapitalAmount = NULL until declared via Settings.

CREATE TYPE "CharterCapitalFundingType" AS ENUM ('FULLY_PAID_CASH', 'PARTIALLY_PAID', 'PAID_IN_KIND', 'NOT_PAID');

ALTER TABLE "Organization"
  ADD COLUMN "charterCapitalAmount" DECIMAL(18,2),
  ADD COLUMN "charterCapitalDeclaredAt" TIMESTAMP(3),
  ADD COLUMN "charterCapitalFundingType" "CharterCapitalFundingType";

-- Migration: add Document tax calendar sync status columns,
-- Payment.orderCode index, and Rule uniqueness constraint.
-- These fields/constraints existed in schema.prisma but were never
-- migrated to the database, causing postDocument() to throw on every
-- call and allowing duplicate/conflicting classification Rules.

ALTER TABLE "Document" ADD COLUMN     "taxCalendarSyncError" TEXT,
ADD COLUMN     "taxCalendarSyncStatus" TEXT;

CREATE INDEX "Payment_orderCode_idx" ON "Payment"("orderCode");

-- NOTE: requires no duplicate (orgId, matchType, matchValue) rows in Rule.
CREATE UNIQUE INDEX "Rule_orgId_matchType_matchValue_key" ON "Rule"("orgId", "matchType", "matchValue");

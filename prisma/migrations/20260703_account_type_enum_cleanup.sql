-- Migration: sync admin/v1 AccountType enum with schema.prisma.
-- The live enum had a leftover "TRANSIT" value (likely copied from the
-- v2 schema at some point) that was never declared here; no Account or
-- MasterAccount rows used it (verified before applying). Also drops a
-- stale DEFAULT on SystemSettings.opening_balance_date per schema.

BEGIN;
CREATE TYPE "AccountType_new" AS ENUM ('ACTIVE', 'CONTRA_ACTIVE', 'PASSIVE', 'CONTRA_PASSIVE', 'ACTIVE_PASSIVE', 'INCOME', 'CONTRA_INCOME', 'EXPENSE', 'OFF_BALANCE');
ALTER TABLE "Account" ALTER COLUMN "type" TYPE "AccountType_new" USING ("type"::text::"AccountType_new");
ALTER TABLE "MasterAccount" ALTER COLUMN "type" TYPE "AccountType_new" USING ("type"::text::"AccountType_new");
ALTER TYPE "AccountType" RENAME TO "AccountType_old";
ALTER TYPE "AccountType_new" RENAME TO "AccountType";
DROP TYPE "public"."AccountType_old";
COMMIT;

ALTER TABLE "SystemSettings" ALTER COLUMN "opening_balance_date" DROP DEFAULT;

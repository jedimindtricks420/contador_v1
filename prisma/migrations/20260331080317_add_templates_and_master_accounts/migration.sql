-- CreateEnum
CREATE TYPE "OnboardingState" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AccountType" ADD VALUE 'CONTRA_ACTIVE';
ALTER TYPE "AccountType" ADD VALUE 'CONTRA_PASSIVE';
ALTER TYPE "AccountType" ADD VALUE 'TRANSIT';
ALTER TYPE "AccountType" ADD VALUE 'OFF_BALANCE';
ALTER TYPE "AccountType" ADD VALUE 'ACTIVE_PASSIVE';

-- AlterTable
ALTER TABLE "Account" ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "is_custom" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "master_account_id" TEXT;

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "ai_description" TEXT,
ADD COLUMN     "onboarding_state" "OnboardingState" NOT NULL DEFAULT 'COMPLETED',
ADD COLUMN     "onboarding_step" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "template_id" TEXT;

-- AlterTable
ALTER TABLE "SystemSettings" ADD COLUMN     "is_initial_balance_fixed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "opening_balance_date" TIMESTAMP(3) NOT NULL DEFAULT '2025-01-01 00:00:00 +00:00';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "active_org_id" TEXT;

-- CreateTable
CREATE TABLE "MasterAccount" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AccountType" NOT NULL,
    "description" TEXT,
    "section" TEXT,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "MasterAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IndustryTemplate" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "IndustryTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IndustryTemplateItem" (
    "id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "master_account_id" TEXT NOT NULL,
    "is_required" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "IndustryTemplateItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity_type" TEXT,
    "entity_id" TEXT,
    "payload" JSONB,
    "ip_address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "tokens_used" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiUsage" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "feature" TEXT NOT NULL,
    "tokens_input" INTEGER NOT NULL,
    "tokens_output" INTEGER NOT NULL,
    "cost_usd" DECIMAL(10,6) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MasterAccount_code_key" ON "MasterAccount"("code");

-- CreateIndex
CREATE UNIQUE INDEX "IndustryTemplate_key_key" ON "IndustryTemplate"("key");

-- CreateIndex
CREATE UNIQUE INDEX "IndustryTemplateItem_template_id_master_account_id_key" ON "IndustryTemplateItem"("template_id", "master_account_id");

-- CreateIndex
CREATE INDEX "AuditLog_organization_id_idx" ON "AuditLog"("organization_id");

-- CreateIndex
CREATE INDEX "AuditLog_created_at_idx" ON "AuditLog"("created_at");

-- CreateIndex
CREATE INDEX "ChatMessage_organization_id_idx" ON "ChatMessage"("organization_id");

-- CreateIndex
CREATE INDEX "ChatMessage_created_at_idx" ON "ChatMessage"("created_at");

-- CreateIndex
CREATE INDEX "AiUsage_organization_id_created_at_idx" ON "AiUsage"("organization_id", "created_at");

-- AddForeignKey
ALTER TABLE "Organization" ADD CONSTRAINT "Organization_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "IndustryTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_master_account_id_fkey" FOREIGN KEY ("master_account_id") REFERENCES "MasterAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IndustryTemplateItem" ADD CONSTRAINT "IndustryTemplateItem_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "IndustryTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IndustryTemplateItem" ADD CONSTRAINT "IndustryTemplateItem_master_account_id_fkey" FOREIGN KEY ("master_account_id") REFERENCES "MasterAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

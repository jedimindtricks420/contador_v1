/*
  Warnings:

  - You are about to drop the column `created_at` on the `Transaction` table. All the data in the column will be lost.
  - You are about to drop the column `credit_account_code` on the `Transaction` table. All the data in the column will be lost.
  - You are about to drop the column `debit_account_code` on the `Transaction` table. All the data in the column will be lost.
  - You are about to drop the column `document_type` on the `Transaction` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[code,organization_id]` on the table `Account` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[organization_id]` on the table `SystemSettings` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "Transaction" DROP CONSTRAINT "Transaction_credit_account_code_fkey";

-- DropForeignKey
ALTER TABLE "Transaction" DROP CONSTRAINT "Transaction_debit_account_code_fkey";

-- DropIndex
DROP INDEX "Account_code_idx";

-- DropIndex
DROP INDEX "Account_code_key";

-- DropIndex
DROP INDEX "Transaction_credit_account_code_idx";

-- DropIndex
DROP INDEX "Transaction_debit_account_code_idx";

-- AlterTable
ALTER TABLE "Account" ADD COLUMN     "organization_id" TEXT;

-- AlterTable
ALTER TABLE "Counterparty" ADD COLUMN     "organization_id" TEXT;

-- AlterTable
ALTER TABLE "SystemSettings" ADD COLUMN     "organization_id" TEXT;

-- AlterTable
ALTER TABLE "Transaction" DROP COLUMN "created_at",
DROP COLUMN "credit_account_code",
DROP COLUMN "debit_account_code",
DROP COLUMN "document_type",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "credit_id" TEXT,
ADD COLUMN     "debit_id" TEXT,
ADD COLUMN     "organization_id" TEXT,
ALTER COLUMN "amount" SET DATA TYPE DECIMAL(20,2);

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "inn" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Account_code_organization_id_key" ON "Account"("code", "organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "SystemSettings_organization_id_key" ON "SystemSettings"("organization_id");

-- CreateIndex
CREATE INDEX "Transaction_debit_id_idx" ON "Transaction"("debit_id");

-- CreateIndex
CREATE INDEX "Transaction_credit_id_idx" ON "Transaction"("credit_id");

-- CreateIndex
CREATE INDEX "Transaction_organization_id_idx" ON "Transaction"("organization_id");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Counterparty" ADD CONSTRAINT "Counterparty_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_debit_id_fkey" FOREIGN KEY ("debit_id") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_credit_id_fkey" FOREIGN KEY ("credit_id") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SystemSettings" ADD CONSTRAINT "SystemSettings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

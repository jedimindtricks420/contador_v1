/*
  Warnings:

  - The primary key for the `SystemSettings` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - Made the column `organization_id` on table `Account` required. This step will fail if there are existing NULL values in that column.
  - Made the column `organization_id` on table `Counterparty` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `user_id` to the `Organization` table without a default value. This is not possible if the table is not empty.
  - Made the column `organization_id` on table `SystemSettings` required. This step will fail if there are existing NULL values in that column.
  - Made the column `credit_id` on table `Transaction` required. This step will fail if there are existing NULL values in that column.
  - Made the column `debit_id` on table `Transaction` required. This step will fail if there are existing NULL values in that column.
  - Made the column `organization_id` on table `Transaction` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "Account" DROP CONSTRAINT "Account_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "Counterparty" DROP CONSTRAINT "Counterparty_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "SystemSettings" DROP CONSTRAINT "SystemSettings_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "Transaction" DROP CONSTRAINT "Transaction_credit_id_fkey";

-- DropForeignKey
ALTER TABLE "Transaction" DROP CONSTRAINT "Transaction_debit_id_fkey";

-- DropForeignKey
ALTER TABLE "Transaction" DROP CONSTRAINT "Transaction_organization_id_fkey";

-- AlterTable
ALTER TABLE "Account" ALTER COLUMN "organization_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "Counterparty" ALTER COLUMN "organization_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "user_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "SystemSettings" DROP CONSTRAINT "SystemSettings_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "organization_id" SET NOT NULL,
ADD CONSTRAINT "SystemSettings_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "Transaction" ALTER COLUMN "credit_id" SET NOT NULL,
ALTER COLUMN "debit_id" SET NOT NULL,
ALTER COLUMN "organization_id" SET NOT NULL;

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- AddForeignKey
ALTER TABLE "Organization" ADD CONSTRAINT "Organization_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Counterparty" ADD CONSTRAINT "Counterparty_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_debit_id_fkey" FOREIGN KEY ("debit_id") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_credit_id_fkey" FOREIGN KEY ("credit_id") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SystemSettings" ADD CONSTRAINT "SystemSettings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('ACTIVE', 'PASSIVE');

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AccountType" NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Counterparty" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "inn" TEXT,

    CONSTRAINT "Counterparty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "period" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "document_type" TEXT NOT NULL,
    "debit_account_code" TEXT NOT NULL,
    "credit_account_code" TEXT NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "counterparty_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "closed_period_date" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Account_code_key" ON "Account"("code");

-- CreateIndex
CREATE INDEX "Account_code_idx" ON "Account"("code");

-- CreateIndex
CREATE INDEX "Transaction_date_idx" ON "Transaction"("date");

-- CreateIndex
CREATE INDEX "Transaction_period_idx" ON "Transaction"("period");

-- CreateIndex
CREATE INDEX "Transaction_debit_account_code_idx" ON "Transaction"("debit_account_code");

-- CreateIndex
CREATE INDEX "Transaction_credit_account_code_idx" ON "Transaction"("credit_account_code");

-- CreateIndex
CREATE INDEX "Transaction_counterparty_id_idx" ON "Transaction"("counterparty_id");

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_debit_account_code_fkey" FOREIGN KEY ("debit_account_code") REFERENCES "Account"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_credit_account_code_fkey" FOREIGN KEY ("credit_account_code") REFERENCES "Account"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_counterparty_id_fkey" FOREIGN KEY ("counterparty_id") REFERENCES "Counterparty"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Migration: генератор «Расчёта налога на прибыль» + дашборд (ТЗ:
-- docs/TZ_generator_otcheta_i_dashboard.md).
--
-- 1. TaxReportAccountMapping — маппинг «счёт НСБУ (+ опционально тип документа)
--    → строка Приложения №1/№2» (ТЗ 1.1). orgId = NULL — дефолт для всех
--    организаций, сидится из DEFAULT_TAX_REPORT_MAPPING в ensureBaseData.
-- 2. OrgCostingMethodHistory — метод себестоимости по налоговым годам (ТЗ 0.3),
--    фиксируется на год, смена — только после полного закрытия предыдущего года.
-- 3. Organization: taxBenefit / itParkResidentSince / itParkCertificateNumber
--    (эпик IT Park, Фаза 1 — только поля, ТЗ 7.1) + avgHeadcount /
--    avgHeadcountDisabled (поля шапки формы, ТЗ 0.1).
-- 4. Document.taxDeductibleOverride — точечное переопределение вычитаемости
--    расхода (Приложение №2, графа 4) на уровне документа (ТЗ 1.2).
--
-- Purely additive; дефолты сохраняют текущее поведение для всех организаций.

CREATE TYPE "TaxBenefitType" AS ENUM ('NONE', 'IT_PARK_RESIDENT');
CREATE TYPE "CostingMethod" AS ENUM ('PROPORTIONAL', 'DIRECT');
CREATE TYPE "TaxAppendixCode" AS ENUM ('APPENDIX_1', 'APPENDIX_2');
CREATE TYPE "TaxReportColumn" AS ENUM ('TOTAL', 'NON_DEDUCTIBLE');

ALTER TABLE "Organization"
  ADD COLUMN "taxBenefit" "TaxBenefitType" NOT NULL DEFAULT 'NONE',
  ADD COLUMN "itParkResidentSince" TIMESTAMP(3),
  ADD COLUMN "itParkCertificateNumber" TEXT,
  ADD COLUMN "avgHeadcount" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "avgHeadcountDisabled" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Document"
  ADD COLUMN "taxDeductibleOverride" BOOLEAN;

CREATE TABLE "TaxReportAccountMapping" (
  "id" TEXT NOT NULL,
  "orgId" TEXT,
  "accountCode" TEXT NOT NULL,
  "documentTypeCode" TEXT,
  "appendixCode" "TaxAppendixCode" NOT NULL,
  "lineCode" TEXT NOT NULL,
  "column" "TaxReportColumn" NOT NULL DEFAULT 'TOTAL',
  "isDefault" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "TaxReportAccountMapping_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TaxReportAccountMapping_orgId_fkey" FOREIGN KEY ("orgId")
    REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "TaxReportAccountMapping_orgId_idx" ON "TaxReportAccountMapping"("orgId");
CREATE INDEX "TaxReportAccountMapping_accountCode_idx" ON "TaxReportAccountMapping"("accountCode");

CREATE TABLE "OrgCostingMethodHistory" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "fiscalYear" INTEGER NOT NULL,
  "costingMethod" "CostingMethod" NOT NULL,
  "setAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "setById" TEXT,
  CONSTRAINT "OrgCostingMethodHistory_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OrgCostingMethodHistory_orgId_fkey" FOREIGN KEY ("orgId")
    REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "OrgCostingMethodHistory_orgId_fiscalYear_key"
  ON "OrgCostingMethodHistory"("orgId", "fiscalYear");
CREATE INDEX "OrgCostingMethodHistory_orgId_idx" ON "OrgCostingMethodHistory"("orgId");

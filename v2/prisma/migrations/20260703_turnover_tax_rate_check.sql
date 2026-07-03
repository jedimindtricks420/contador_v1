-- Migration: add CHECK constraint for turnoverTaxRate (1%..4%)
ALTER TABLE "Organization" ADD CONSTRAINT "Organization_turnoverTaxRate_check"
  CHECK ("turnoverTaxRate" >= 0.01 AND "turnoverTaxRate" <= 0.04);
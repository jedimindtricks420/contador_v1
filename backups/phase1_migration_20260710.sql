-- Фаза 1: квартальный налог на прибыль — колонка ставки.
\set ON_ERROR_STOP on
BEGIN;

ALTER TABLE "Organization"
  ADD COLUMN IF NOT EXISTS "profitTaxRate" DOUBLE PRECISION NOT NULL DEFAULT 0.15;

DO $$
DECLARE n int;
BEGIN
  -- у всех организаций ставка 0.15 по умолчанию
  SELECT count(*) INTO n FROM "Organization" WHERE "profitTaxRate" IS DISTINCT FROM 0.15;
  IF n <> 0 THEN RAISE EXCEPTION 'profitTaxRate: % организаций с неожиданной ставкой', n; END IF;
  -- флаг GP TECH UNION не задет (остаётся false до решения бухгалтера)
  SELECT count(*) INTO n FROM "Organization"
  WHERE id = '228045b1-34d6-4a27-8034-8a9860ab013e' AND "autoAccrueProfitTax" = false;
  IF n <> 1 THEN RAISE EXCEPTION 'GP TECH UNION: флаг autoAccrueProfitTax изменился'; END IF;
END $$;

COMMIT;
\echo '=== ФАЗА 1 (БД) ПРИМЕНЕНА ==='

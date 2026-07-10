-- Фаза 0: колонка autoAccrueProfitTax + выключение автоначисления
-- налога на прибыль для GP TECH UNION (считают вручную до Фазы 1/2).
\set ON_ERROR_STOP on
BEGIN;

ALTER TABLE "Organization"
  ADD COLUMN IF NOT EXISTS "autoAccrueProfitTax" BOOLEAN NOT NULL DEFAULT true;

UPDATE "Organization"
SET "autoAccrueProfitTax" = false
WHERE id = '228045b1-34d6-4a27-8034-8a9860ab013e';

DO $$
DECLARE n int;
BEGIN
  -- GP TECH UNION: флаг выключен
  SELECT count(*) INTO n FROM "Organization"
  WHERE id = '228045b1-34d6-4a27-8034-8a9860ab013e' AND "autoAccrueProfitTax" = false;
  IF n <> 1 THEN RAISE EXCEPTION 'GP TECH UNION: флаг не выключен (n=%)', n; END IF;

  -- у всех остальных организаций поведение не изменилось (default true)
  SELECT count(*) INTO n FROM "Organization"
  WHERE id <> '228045b1-34d6-4a27-8034-8a9860ab013e' AND "autoAccrueProfitTax" = false;
  IF n <> 0 THEN RAISE EXCEPTION 'Флаг выключен у % посторонних организаций', n; END IF;
END $$;

COMMIT;
\echo '=== ФАЗА 0 (БД) ПРИМЕНЕНА ==='

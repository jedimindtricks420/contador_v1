-- ============================================================================
-- Патч учётных данных GP TECH UNION (org 228045b1-34d6-4a27-8034-8a9860ab013e)
-- Блоки 1-3 + 5 (реформация корректируется удалением строк, перезапуск не нужен)
-- Блок 4 (взнос учредителя) НЕ включён — ждёт подтверждения.
-- Все операции в одной транзакции; любой несовпавший assert -> EXCEPTION -> ROLLBACK.
-- ============================================================================
\set ON_ERROR_STOP on
BEGIN;

-- ── Блок 1: налоговый режим организации ────────────────────────────────────
UPDATE "Organization"
SET "taxRegime" = 'VAT', "isVatPayer" = true, inn = '312915680'
WHERE id = '228045b1-34d6-4a27-8034-8a9860ab013e';

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM "Organization"
  WHERE id = '228045b1-34d6-4a27-8034-8a9860ab013e'
    AND "taxRegime" = 'VAT' AND "isVatPayer" AND inn = '312915680';
  IF n <> 1 THEN RAISE EXCEPTION 'Блок 1: организация не в ожидаемом состоянии (n=%)', n; END IF;
END $$;

-- ── Блок 2a: удалить документы начисления налога с оборота ────────────────
-- (JournalEntry удалятся каскадом по FK ON DELETE CASCADE)
DO $$
DECLARE n int;
BEGIN
  DELETE FROM "Document"
  WHERE "orgId" = '228045b1-34d6-4a27-8034-8a9860ab013e'
    AND id IN ('4ded0de0-e0bb-4ace-8c9d-77a0b3fe8ce2',   -- май, 313 871,43
               '70e3aa5d-b43d-4942-8d52-dc92ef10b872');  -- июнь, 307 857,14
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 2 THEN RAISE EXCEPTION 'Блок 2a: ожидалось 2 документа, удалено %', n; END IF;
END $$;

-- ── Блок 2b: удалить строки реформации 9910/9810 из батчей закрытия ───────
DO $$
DECLARE n int;
BEGIN
  DELETE FROM "JournalEntry" je
  USING "Account" a
  WHERE a.id = je."accountId"
    AND (
      (je."documentId" = 'b2ce2456-49c1-422a-9191-17e76ed3c86d' AND (
        (a.code = '9910' AND je.debit  = 313871.43 AND je.credit = 0) OR
        (a.code = '9810' AND je.credit = 313871.43 AND je.debit  = 0)))
      OR
      (je."documentId" = '15207693-c1bc-412a-a894-117e37e82294' AND (
        (a.code = '9910' AND je.debit  = 307857.14 AND je.credit = 0) OR
        (a.code = '9810' AND je.credit = 307857.14 AND je.debit  = 0)))
    );
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 4 THEN RAISE EXCEPTION 'Блок 2b: ожидалось 4 строки реформации, удалено %', n; END IF;
END $$;

-- ── Блок 2c: убрать события TURNOVER_TAX из налогового календаря ──────────
-- Обязательно: Форма №2 (строка 250) при нулевых проводках 9810 берёт налог
-- из календаря — без этого шага критерий №6 не выполняется.
DO $$
DECLARE n int;
BEGIN
  DELETE FROM "TaxCalendarEvent"
  WHERE "orgId" = '228045b1-34d6-4a27-8034-8a9860ab013e' AND type = 'TURNOVER_TAX';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 4 THEN RAISE EXCEPTION 'Блок 2c: ожидалось 4 события календаря, удалено %', n; END IF;
END $$;

-- ── Блок 3: авансовые оплаты — дебет 6010 -> 4310 ─────────────────────────
DO $$
DECLARE n int; acc4310 text;
BEGIN
  SELECT id INTO acc4310 FROM "Account" WHERE code = '4310';
  IF acc4310 IS NULL THEN RAISE EXCEPTION 'Блок 3: счёт 4310 не найден'; END IF;

  UPDATE "JournalEntry" je
  SET "accountId" = acc4310
  FROM "Account" a
  WHERE a.id = je."accountId" AND a.code = '6010' AND je.debit > 0 AND je.credit = 0
    AND je."documentId" IN (
      'af31e6c4-e24e-4565-baa5-438168e57987',  -- AXOFT    28.04  718 928
      '821ff739-ceb3-468b-a469-3188c9c2adfe',  -- 04.06  273 459 200
      'd3b7b6ff-39ed-4f60-b72a-cb0f5ef56e51'); -- 09.06   11 760 000
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 3 THEN RAISE EXCEPTION 'Блок 3: ожидалось 3 строки, обновлено %', n; END IF;
END $$;

-- ── Финальные инварианты (блок 6, SQL-часть) ──────────────────────────────
DO $$
DECLARE v numeric;
BEGIN
  -- 6.5: 9810 больше не используется у организации
  SELECT count(*) INTO v FROM "JournalEntry" je
    JOIN "Account" a ON a.id = je."accountId"
    JOIN "Document" d ON d.id = je."documentId"
  WHERE d."orgId" = '228045b1-34d6-4a27-8034-8a9860ab013e' AND a.code = '9810';
  IF v <> 0 THEN RAISE EXCEPTION 'Инвариант 6.5: на 9810 осталось % строк', v; END IF;

  -- 6.2: сальдо 4310 = 0 (Дт = Кт = 285 938 128)
  SELECT COALESCE(SUM(je.debit - je.credit), 0) INTO v FROM "JournalEntry" je
    JOIN "Account" a ON a.id = je."accountId"
    JOIN "Document" d ON d.id = je."documentId"
  WHERE d."orgId" = '228045b1-34d6-4a27-8034-8a9860ab013e' AND a.code = '4310';
  IF v <> 0 THEN RAISE EXCEPTION 'Инвариант 6.2: сальдо 4310 = %, ожидался 0', v; END IF;

  -- 6.3: кредитовое сальдо 6010 = 15 374 365
  -- (16 000 000 APN PROMISE минус 625 635 прочих мелких Дт-платежей вне скоупа ТЗ)
  SELECT COALESCE(SUM(je.credit - je.debit), 0) INTO v FROM "JournalEntry" je
    JOIN "Account" a ON a.id = je."accountId"
    JOIN "Document" d ON d.id = je."documentId"
  WHERE d."orgId" = '228045b1-34d6-4a27-8034-8a9860ab013e' AND a.code = '6010';
  IF v <> 15374365.00 THEN RAISE EXCEPTION 'Инвариант 6.3: сальдо 6010 = %, ожидалось 15 374 365', v; END IF;

  -- 6.7: касса 5110 не задета (базлайн: Дт 418 037 800,00 / Кт 407 187 869,04)
  SELECT COALESCE(SUM(je.debit - je.credit), 0) INTO v FROM "JournalEntry" je
    JOIN "Account" a ON a.id = je."accountId"
    JOIN "Document" d ON d.id = je."documentId"
  WHERE d."orgId" = '228045b1-34d6-4a27-8034-8a9860ab013e' AND a.code = '5110';
  IF v <> 10849930.96 THEN RAISE EXCEPTION 'Инвариант 6.7: сальдо 5110 = %, ожидалось 10 849 930,96', v; END IF;

  -- 6410 уменьшился ровно на 621 728,57: было Кт 2 060 197,98 -> стало 1 438 469,41
  SELECT COALESCE(SUM(je.credit - je.debit), 0) INTO v FROM "JournalEntry" je
    JOIN "Account" a ON a.id = je."accountId"
    JOIN "Document" d ON d.id = je."documentId"
  WHERE d."orgId" = '228045b1-34d6-4a27-8034-8a9860ab013e' AND a.code = '6410';
  IF v <> 1438469.41 THEN RAISE EXCEPTION 'Инвариант 6410: сальдо = %, ожидалось 1 438 469,41', v; END IF;

  -- батчи реформации остались сбалансированными
  SELECT COALESCE(SUM(je.debit) - SUM(je.credit), -1) INTO v FROM "JournalEntry" je
  WHERE je."documentId" IN ('b2ce2456-49c1-422a-9191-17e76ed3c86d','15207693-c1bc-412a-a894-117e37e82294');
  IF v <> 0 THEN RAISE EXCEPTION 'Батчи реформации разбалансированы: %', v; END IF;
END $$;

COMMIT;
\echo '=== ПАТЧ ПРИМЕНЁН УСПЕШНО ==='

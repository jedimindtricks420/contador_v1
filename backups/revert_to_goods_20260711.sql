-- ============================================================================
-- GP TECH UNION: возврат закупок «услуги → товары» (решение владельца 11.07.2026:
-- AXOFT/SOFTPROM/APN — закупки под перепродажу, ЭСФ покупателю в июле).
-- Обратный скрипт к reclass_services_20260710.sql:
--   1) 4 документа: SERVICE_RECEIVED(_PREPAID) → GOODS_RECEIVED(_PREPAID)
--   2) проводки Дт 9420 → Дт 2910
--   3) удалить добавленные строки реформации (апрель 641 900, июнь 284 329 760)
--   4) платежи и правила классификатора → «Оплата поставщику за товары»
-- ============================================================================
\set ON_ERROR_STOP on
BEGIN;

-- ── 1. Типы документов поступления ─────────────────────────────────────────
DO $$
DECLARE n int; t_goods_pre text; t_goods text;
BEGIN
  SELECT id INTO t_goods_pre FROM "DocumentType" WHERE code='GOODS_RECEIVED_PREPAID';
  SELECT id INTO t_goods     FROM "DocumentType" WHERE code='GOODS_RECEIVED';

  UPDATE "Document" SET "typeId" = t_goods_pre
  WHERE "orgId"='228045b1-34d6-4a27-8034-8a9860ab013e'
    AND id IN ('2172cdba-7065-4335-9919-5f7bf069c4d9',
               '34dadae4-87ee-4ee0-9e84-dc7b95a1587b',
               '48ed7424-5e3c-4432-88e6-04b225b5598c');
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 3 THEN RAISE EXCEPTION 'Шаг 1a: ожидалось 3, обновлено %', n; END IF;

  UPDATE "Document" SET "typeId" = t_goods
  WHERE "orgId"='228045b1-34d6-4a27-8034-8a9860ab013e'
    AND id = '7b56f596-91c7-4e2c-818d-98435eab1dc0';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'Шаг 1b: ожидался 1, обновлено %', n; END IF;
END $$;

-- ── 2. Проводки Дт 9420 → Дт 2910 ──────────────────────────────────────────
DO $$
DECLARE n int; a2910 text;
BEGIN
  SELECT id INTO a2910 FROM "Account" WHERE code='2910';
  UPDATE "JournalEntry" je SET "accountId" = a2910
  FROM "Account" a
  WHERE a.id = je."accountId" AND a.code='9420' AND je.debit > 0
    AND je."documentId" IN ('2172cdba-7065-4335-9919-5f7bf069c4d9',
                            '34dadae4-87ee-4ee0-9e84-dc7b95a1587b',
                            '48ed7424-5e3c-4432-88e6-04b225b5598c',
                            '7b56f596-91c7-4e2c-818d-98435eab1dc0');
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 4 THEN RAISE EXCEPTION 'Шаг 2: ожидалось 4 строки, обновлено %', n; END IF;
END $$;

-- ── 3. Удалить добавленные строки реформации ───────────────────────────────
DO $$
DECLARE n int;
BEGIN
  DELETE FROM "JournalEntry" je
  USING "Account" a
  WHERE a.id = je."accountId"
    AND (
      (je."documentId" = '9ac4d545-e899-4955-930a-b59b3444a9e4' AND (
        (a.code='9910' AND je.debit  = 641900.00 AND je.credit = 0) OR
        (a.code='9420' AND je.credit = 641900.00 AND je.debit  = 0)))
      OR
      (je."documentId" = '15207693-c1bc-412a-a894-117e37e82294' AND (
        (a.code='9910' AND je.debit  = 284329760.00 AND je.credit = 0) OR
        (a.code='9420' AND je.credit = 284329760.00 AND je.debit  = 0)))
    );
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 4 THEN RAISE EXCEPTION 'Шаг 3: ожидалось 4 строки реформации, удалено %', n; END IF;
END $$;

-- ── 4. Категории платежей и правила классификатора → «за товары» ───────────
DO $$
DECLARE n int; t_pay_goods text;
BEGIN
  SELECT id INTO t_pay_goods FROM "DocumentType" WHERE code='SUPPLIER_PAYMENT_GOODS';

  UPDATE "Document" SET "typeId" = t_pay_goods
  WHERE "orgId"='228045b1-34d6-4a27-8034-8a9860ab013e'
    AND id IN ('af31e6c4-e24e-4565-baa5-438168e57987',  -- AXOFT 28.04, 718 928
               '821ff739-ceb3-468b-a469-3188c9c2adfe',  -- AXOFT 04.06, 273 459 200
               'd3b7b6ff-39ed-4f60-b72a-cb0f5ef56e51',  -- SOFTPROM 09.06, 11 760 000
               'ac054429-ae2a-4031-8118-ff6aee3e0307'); -- APN 11.06, 17 230 131,20
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 4 THEN RAISE EXCEPTION 'Шаг 4a: ожидалось 4 платежа, обновлено %', n; END IF;

  UPDATE "Rule" SET "categoryId" = t_pay_goods
  WHERE "orgId"='228045b1-34d6-4a27-8034-8a9860ab013e'
    AND "matchType"='INN' AND "matchValue" IN ('305774212','311149962','311509237');
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 3 THEN RAISE EXCEPTION 'Шаг 4b: ожидалось 3 правила, обновлено %', n; END IF;
END $$;

-- ── Инварианты: состояние = как до переклассификации ───────────────────────
DO $$
DECLARE v numeric; v2 numeric;
BEGIN
  -- склад 2910 восстановлен: Дт 284 971 660, Кт 0
  SELECT COALESCE(SUM(je.debit),0), COALESCE(SUM(je.credit),0) INTO v, v2 FROM "JournalEntry" je
    JOIN "Account" a ON a.id=je."accountId" JOIN "Document" d ON d.id=je."documentId"
  WHERE d."orgId"='228045b1-34d6-4a27-8034-8a9860ab013e' AND a.code='2910';
  IF v <> 284971660.00 OR v2 <> 0 THEN RAISE EXCEPTION '2910: Дт %, Кт % (ожидалось 284 971 660 / 0)', v, v2; END IF;

  -- 9420 снова закрыт в ноль штатной реформацией
  SELECT COALESCE(SUM(je.debit - je.credit), -1) INTO v FROM "JournalEntry" je
    JOIN "Account" a ON a.id=je."accountId" JOIN "Document" d ON d.id=je."documentId"
  WHERE d."orgId"='228045b1-34d6-4a27-8034-8a9860ab013e' AND a.code='9420' AND d.status='POSTED';
  IF v <> 0 THEN RAISE EXCEPTION '9420: остаток %', v; END IF;

  -- касса и НДС не задеты
  SELECT COALESCE(SUM(je.debit - je.credit), 0) INTO v FROM "JournalEntry" je
    JOIN "Account" a ON a.id=je."accountId" JOIN "Document" d ON d.id=je."documentId"
  WHERE d."orgId"='228045b1-34d6-4a27-8034-8a9860ab013e' AND a.code='5110';
  IF v <> 10849930.96 THEN RAISE EXCEPTION '5110: %', v; END IF;
  SELECT COALESCE(SUM(je.debit - je.credit), 0) INTO v FROM "JournalEntry" je
    JOIN "Account" a ON a.id=je."accountId" JOIN "Document" d ON d.id=je."documentId"
  WHERE d."orgId"='228045b1-34d6-4a27-8034-8a9860ab013e' AND a.code='4410';
  IF v <> 34196599.20 THEN RAISE EXCEPTION '4410: %', v; END IF;

  -- батчи реформации сбалансированы
  SELECT COALESCE(SUM(je.debit) - SUM(je.credit), -1) INTO v FROM "JournalEntry" je
  WHERE je."documentId" IN ('9ac4d545-e899-4955-930a-b59b3444a9e4','15207693-c1bc-412a-a894-117e37e82294');
  IF v <> 0 THEN RAISE EXCEPTION 'Реформация разбалансирована: %', v; END IF;
END $$;

COMMIT;
\echo '=== ВОЗВРАТ НА ТОВАРЫ ПРИМЕНЁН ==='

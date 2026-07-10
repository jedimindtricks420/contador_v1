-- ============================================================================
-- GP TECH UNION: переклассификация закупок «товары → услуги»
-- (организация работает только с услугами — подтверждено владельцем 10.07.2026).
-- 4 документа: тип GOODS_RECEIVED(_PREPAID) → SERVICE_RECEIVED(_PREPAID),
-- проводка Дт 2910 (склад) → Дт 9420 (административные расходы).
-- Плюс дозакрытие 9420 в существующих батчах реформации апреля и июня.
-- ============================================================================
\set ON_ERROR_STOP on
BEGIN;

-- ── 1. Смена типа документов ────────────────────────────────────────────────
DO $$
DECLARE n int; t_srv_pre text; t_srv text;
BEGIN
  SELECT id INTO t_srv_pre FROM "DocumentType" WHERE code='SERVICE_RECEIVED_PREPAID';
  SELECT id INTO t_srv     FROM "DocumentType" WHERE code='SERVICE_RECEIVED';
  IF t_srv_pre IS NULL OR t_srv IS NULL THEN RAISE EXCEPTION 'Типы SERVICE_RECEIVED* не найдены'; END IF;

  UPDATE "Document" SET "typeId" = t_srv_pre
  WHERE "orgId"='228045b1-34d6-4a27-8034-8a9860ab013e'
    AND id IN ('2172cdba-7065-4335-9919-5f7bf069c4d9',  -- AXOFT апрель, 641 900
               '34dadae4-87ee-4ee0-9e84-dc7b95a1587b',  -- AXOFT июнь, 244 160 000
               '48ed7424-5e3c-4432-88e6-04b225b5598c'); -- SOFTPROM июнь, 10 500 000
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 3 THEN RAISE EXCEPTION 'Шаг 1a: ожидалось 3 документа, обновлено %', n; END IF;

  UPDATE "Document" SET "typeId" = t_srv
  WHERE "orgId"='228045b1-34d6-4a27-8034-8a9860ab013e'
    AND id = '7b56f596-91c7-4e2c-818d-98435eab1dc0';   -- APN PROMISE июнь, в долг
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'Шаг 1b: ожидался 1 документ, обновлено %', n; END IF;
END $$;

-- ── 2. Перенос проводок Дт 2910 → Дт 9420 ──────────────────────────────────
DO $$
DECLARE n int; a9420 text;
BEGIN
  SELECT id INTO a9420 FROM "Account" WHERE code='9420';
  UPDATE "JournalEntry" je SET "accountId" = a9420
  FROM "Account" a
  WHERE a.id = je."accountId" AND a.code='2910' AND je.debit > 0
    AND je."documentId" IN ('2172cdba-7065-4335-9919-5f7bf069c4d9',
                            '34dadae4-87ee-4ee0-9e84-dc7b95a1587b',
                            '48ed7424-5e3c-4432-88e6-04b225b5598c',
                            '7b56f596-91c7-4e2c-818d-98435eab1dc0');
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 4 THEN RAISE EXCEPTION 'Шаг 2: ожидалось 4 строки 2910, обновлено %', n; END IF;
END $$;

-- ── 3. Дозакрытие 9420 в реформации закрытых периодов ──────────────────────
-- Апрель: батч 9ac4d545 (+641 900), июнь: батч 15207693 (+284 329 760)
DO $$
DECLARE a9420 text; a9910 text;
BEGIN
  SELECT id INTO a9420 FROM "Account" WHERE code='9420';
  SELECT id INTO a9910 FROM "Account" WHERE code='9910';

  INSERT INTO "JournalEntry" (id, "documentId", "accountId", debit, credit, date) VALUES
    (gen_random_uuid(), '9ac4d545-e899-4955-930a-b59b3444a9e4', a9910, 641900.00, 0, '2026-04-28'),
    (gen_random_uuid(), '9ac4d545-e899-4955-930a-b59b3444a9e4', a9420, 0, 641900.00, '2026-04-28'),
    (gen_random_uuid(), '15207693-c1bc-412a-a894-117e37e82294', a9910, 284329760.00, 0, '2026-06-28'),
    (gen_random_uuid(), '15207693-c1bc-412a-a894-117e37e82294', a9420, 0, 284329760.00, '2026-06-28');
END $$;

-- ── Инварианты ──────────────────────────────────────────────────────────────
DO $$
DECLARE v numeric;
BEGIN
  -- 2910 больше не используется
  SELECT count(*) INTO v FROM "JournalEntry" je
    JOIN "Account" a ON a.id=je."accountId" JOIN "Document" d ON d.id=je."documentId"
  WHERE d."orgId"='228045b1-34d6-4a27-8034-8a9860ab013e' AND a.code='2910';
  IF v <> 0 THEN RAISE EXCEPTION '2910: осталось % строк', v; END IF;

  -- 9420 закрыт реформацией полностью (Дт = Кт)
  SELECT COALESCE(SUM(je.debit - je.credit), -1) INTO v FROM "JournalEntry" je
    JOIN "Account" a ON a.id=je."accountId" JOIN "Document" d ON d.id=je."documentId"
  WHERE d."orgId"='228045b1-34d6-4a27-8034-8a9860ab013e' AND a.code='9420' AND d.status='POSTED';
  IF v <> 0 THEN RAISE EXCEPTION '9420: незакрытый остаток %', v; END IF;

  -- касса не задета
  SELECT COALESCE(SUM(je.debit - je.credit), 0) INTO v FROM "JournalEntry" je
    JOIN "Account" a ON a.id=je."accountId" JOIN "Document" d ON d.id=je."documentId"
  WHERE d."orgId"='228045b1-34d6-4a27-8034-8a9860ab013e' AND a.code='5110';
  IF v <> 10849930.96 THEN RAISE EXCEPTION '5110: сальдо %, ожидалось 10 849 930,96', v; END IF;

  -- батчи реформации сбалансированы
  SELECT COALESCE(SUM(je.debit) - SUM(je.credit), -1) INTO v FROM "JournalEntry" je
  WHERE je."documentId" IN ('9ac4d545-e899-4955-930a-b59b3444a9e4','15207693-c1bc-412a-a894-117e37e82294');
  IF v <> 0 THEN RAISE EXCEPTION 'Реформация разбалансирована: %', v; END IF;

  -- НДС не задет: 4410 как было
  SELECT COALESCE(SUM(je.debit - je.credit), 0) INTO v FROM "JournalEntry" je
    JOIN "Account" a ON a.id=je."accountId" JOIN "Document" d ON d.id=je."documentId"
  WHERE d."orgId"='228045b1-34d6-4a27-8034-8a9860ab013e' AND a.code='4410';
  IF v <> 34196599.20 THEN RAISE EXCEPTION '4410: сальдо %, ожидалось 34 196 599,20', v; END IF;
END $$;

COMMIT;
\echo '=== ПЕРЕКЛАССИФИКАЦИЯ ПРИМЕНЕНА ==='

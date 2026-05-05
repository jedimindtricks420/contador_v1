-- ============================================================
-- Тестовые проводки для "Gorgeous Partners"
-- org_id: be9ad6c2-60c4-4d98-a066-fa1410444c30
-- Период: январь–май 2025 года
-- Реалистичные операции IT-компании (НСБУ, Узбекистан)
-- ============================================================

-- Переменные (ID счетов):
-- 5110: 25e12210-ff96-49eb-ba6a-95fd3da58fad  (Расчётный счёт, ACTIVE)
-- 0000: 1fae8fb1-66e0-46d0-8546-ec6bb42c6fbe  (Ввод остатков, ACTIVE_PASSIVE)
-- 4010: f850348d-9990-409d-8d65-397819721460  (Дебиторка, ACTIVE)
-- 8330: 26ed350d-5313-4ced-8764-ef6e9098d111  (Паи и вклады / Уставный капитал, PASSIVE)
-- 9030: 40127f76-b916-4750-b9d6-b65d372cd834  (Доходы от работ и услуг, ACTIVE)
-- 9130: 7996ee9f-93c5-4633-b030-913cdd896dc2  (Себестоимость услуг, ACTIVE)
-- 9410: f6044adc-f0d8-494f-8a45-58998451debd  (Расходы по реализации, ACTIVE)
-- 9420: ab952a8e-bd88-4325-9e58-249bfaf2bf4c  (Административные расходы, ACTIVE)
-- 6710: f7b15deb-5015-4677-9e8f-252e94caa98e  (Зарплата к выплате, PASSIVE)
-- 6010: 25ad4a7c-4d1c-4d1f-8955-8309a00cbc8e  (Поставщики и подрядчики, PASSIVE)
-- 6410: 8a1d7779-0585-48ca-a946-944e89eef207  (Налоги в бюджет, PASSIVE)
-- 6520: e02a70b6-4ab5-43a6-b336-d2e6531128c8  (Соц. фонд, PASSIVE)
-- 0150: 5a7f2c8b-2045-4cd0-800d-b4f76e701c57  (Компьютерное оборудование, ACTIVE)
-- 6310: 06fa9900-0ac3-4793-924c-3b4ee026d986  (Авансы от покупателей, PASSIVE)
-- 5210: 267c401d-405e-4498-a490-e47b4dbf1993  (Валютный счёт, ACTIVE)

DO $$
DECLARE
  org_id TEXT := 'be9ad6c2-60c4-4d98-a066-fa1410444c30';
  acc_5110 TEXT := '25e12210-ff96-49eb-ba6a-95fd3da58fad';
  acc_0000 TEXT := '1fae8fb1-66e0-46d0-8546-ec6bb42c6fbe';
  acc_4010 TEXT := 'f850348d-9990-409d-8d65-397819721460';
  acc_8330 TEXT := '26ed350d-5313-4ced-8764-ef6e9098d111';
  acc_9030 TEXT := '40127f76-b916-4750-b9d6-b65d372cd834';
  acc_9130 TEXT := '7996ee9f-93c5-4633-b030-913cdd896dc2';
  acc_9410 TEXT := 'f6044adc-f0d8-494f-8a45-58998451debd';
  acc_9420 TEXT := 'ab952a8e-bd88-4325-9e58-249bfaf2bf4c';
  acc_6710 TEXT := 'f7b15deb-5015-4677-9e8f-252e94caa98e';
  acc_6010 TEXT := '25ad4a7c-4d1c-4d1f-8955-8309a00cbc8e';
  acc_6410 TEXT := '8a1d7779-0585-48ca-a946-944e89eef207';
  acc_6520 TEXT := 'e02a70b6-4ab5-43a6-b336-d2e6531128c8';
  acc_0150 TEXT := '5a7f2c8b-2045-4cd0-800d-b4f76e701c57';
  acc_6310 TEXT := '06fa9900-0ac3-4793-924c-3b4ee026d986';
  acc_5210 TEXT := '267c401d-405e-4498-a490-e47b4dbf1993';
BEGIN

  -- ── ЯНВАРЬ 2025 ─────────────────────────────────────────────────────

  -- 1. Ввод начального остатка: расчётный счёт
  INSERT INTO "Transaction" (id, date, period, description, amount, debit_id, credit_id, organization_id, is_deleted, "createdAt")
  VALUES (gen_random_uuid(), '2025-01-01', '01.2025',
    'Ввод начального остатка: расчётный счёт (5110)', 45000000.00,
    acc_5110, acc_0000, org_id, false, now());

  -- 2. Ввод начального остатка: уставный капитал (чтобы баланс сошёлся)
  INSERT INTO "Transaction" (id, date, period, description, amount, debit_id, credit_id, organization_id, is_deleted, "createdAt")
  VALUES (gen_random_uuid(), '2025-01-01', '01.2025',
    'Ввод начального остатка: уставный капитал (8330)', 45000000.00,
    acc_0000, acc_8330, org_id, false, now());

  -- ── ФЕВРАЛЬ 2025 ────────────────────────────────────────────────────

  -- 3. Выставлен счёт клиенту за разработку ПО (отражение выручки)
  INSERT INTO "Transaction" (id, date, period, description, amount, debit_id, credit_id, organization_id, is_deleted, "createdAt")
  VALUES (gen_random_uuid(), '2025-02-10', '02.2025',
    'Выручка: разработка корпоративного портала — Nexus LLC', 28500000.00,
    acc_4010, acc_9030, org_id, false, now());

  -- 4. Поступление оплаты от клиента
  INSERT INTO "Transaction" (id, date, period, description, amount, debit_id, credit_id, organization_id, is_deleted, "createdAt")
  VALUES (gen_random_uuid(), '2025-02-14', '02.2025',
    'Поступление оплаты от Nexus LLC за разработку ПО', 28500000.00,
    acc_5110, acc_4010, org_id, false, now());

  -- 5. Начисление заработной платы (фев.)
  INSERT INTO "Transaction" (id, date, period, description, amount, debit_id, credit_id, organization_id, is_deleted, "createdAt")
  VALUES (gen_random_uuid(), '2025-02-28', '02.2025',
    'Начисление заработной платы за февраль 2025', 18000000.00,
    acc_9420, acc_6710, org_id, false, now());

  -- ── МАРТ 2025 ───────────────────────────────────────────────────────

  -- 6. Выплата зарплаты с расч. счёта
  INSERT INTO "Transaction" (id, date, period, description, amount, debit_id, credit_id, organization_id, is_deleted, "createdAt")
  VALUES (gen_random_uuid(), '2025-03-05', '03.2025',
    'Выплата заработной платы за февраль с расчётного счёта', 18000000.00,
    acc_6710, acc_5110, org_id, false, now());

  -- 7. Получен аванс от клиента (предоплата)
  INSERT INTO "Transaction" (id, date, period, description, amount, debit_id, credit_id, organization_id, is_deleted, "createdAt")
  VALUES (gen_random_uuid(), '2025-03-12', '03.2025',
    'Аванс от Sterling Group за IT-консалтинг (50%)', 12000000.00,
    acc_5110, acc_6310, org_id, false, now());

  -- 8. Закупка компьютерного оборудования
  INSERT INTO "Transaction" (id, date, period, description, amount, debit_id, credit_id, organization_id, is_deleted, "createdAt")
  VALUES (gen_random_uuid(), '2025-03-18', '03.2025',
    'Закупка MacBook Pro 14 для команды (5 шт.)', 35000000.00,
    acc_0150, acc_5110, org_id, false, now());

  -- 9. Административные расходы (аренда офиса)
  INSERT INTO "Transaction" (id, date, period, description, amount, debit_id, credit_id, organization_id, is_deleted, "createdAt")
  VALUES (gen_random_uuid(), '2025-03-31', '03.2025',
    'Аренда офиса за март 2025 — ООО Бизнес Центр', 5500000.00,
    acc_9420, acc_6010, org_id, false, now());

  -- ── АПРЕЛЬ 2025 ─────────────────────────────────────────────────────

  -- 10. Закрытие аванса: оказаны услуги по IT-консалтингу Sterling Group
  INSERT INTO "Transaction" (id, date, period, description, amount, debit_id, credit_id, organization_id, is_deleted, "createdAt")
  VALUES (gen_random_uuid(), '2025-04-02', '04.2025',
    'Признание выручки: IT-консалтинг Sterling Group (закрытие аванса)', 12000000.00,
    acc_6310, acc_9030, org_id, false, now());

  -- 11. Себестоимость оказанных услуг
  INSERT INTO "Transaction" (id, date, period, description, amount, debit_id, credit_id, organization_id, is_deleted, "createdAt")
  VALUES (gen_random_uuid(), '2025-04-02', '04.2025',
    'Списание себестоимости услуг по IT-консалтингу', 7200000.00,
    acc_9130, acc_5110, org_id, false, now());

  -- 12. Уплата налога на прибыль
  INSERT INTO "Transaction" (id, date, period, description, amount, debit_id, credit_id, organization_id, is_deleted, "createdAt")
  VALUES (gen_random_uuid(), '2025-04-15', '04.2025',
    'Перечисление налога на прибыль за Q1 2025 в бюджет', 3100000.00,
    acc_6410, acc_5110, org_id, false, now());

  -- ── МАЙ 2025 ────────────────────────────────────────────────────────

  -- 13. Поступление валютной выручки (экспорт услуг)
  INSERT INTO "Transaction" (id, date, period, description, amount, debit_id, credit_id, organization_id, is_deleted, "createdAt")
  VALUES (gen_random_uuid(), '2025-05-05', '05.2025',
    'Валютная выручка: разработка мобильного приложения — Global Tech Inc (USD)', 52000000.00,
    acc_5210, acc_9030, org_id, false, now());

  -- 14. Расходы на маркетинг (участие в конференции)
  INSERT INTO "Transaction" (id, date, period, description, amount, debit_id, credit_id, organization_id, is_deleted, "createdAt")
  VALUES (gen_random_uuid(), '2025-05-10', '05.2025',
    'Расходы на маркетинг: выставка IT-Forum Tashkent 2025', 4800000.00,
    acc_9410, acc_5110, org_id, false, now());

  -- 15. Начисление зарплаты за май + взносы в соц. фонд
  INSERT INTO "Transaction" (id, date, period, description, amount, debit_id, credit_id, organization_id, is_deleted, "createdAt")
  VALUES (gen_random_uuid(), '2025-05-31', '05.2025',
    'Начисление ЕСП (единый социальный платёж) за май 2025', 3600000.00,
    acc_9420, acc_6520, org_id, false, now());

  RAISE NOTICE 'Успешно добавлено 15 транзакций для Gorgeous Partners';
END $$;

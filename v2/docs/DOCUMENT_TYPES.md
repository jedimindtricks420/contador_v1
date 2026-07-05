# Типы документов Contador v2

> Автогенерируется из `src/lib/ensureBaseData.ts` (`baseDocumentTypes`).
> **Не редактировать вручную** — правки будут потеряны при следующем запуске `npm run docs:types`.
> Регенерировать: `npm run docs:types`.

Всего типов документов: **140**.

## Автоматически по банковской выписке (67)

### `ACCOUNTABLE`

**Подотчётные суммы**

- Режим: `BANK_AUTO`
- открывает Open Item на `4220`; контрагент не обязателен

Проводки:
  - Дт `4220` = `amount`
  - Кт `5110` = `amount`

### `ACCOUNTABLE_GENERAL`

**Подотчётные суммы (общехозяйственные расходы)**

- Режим: `BANK_AUTO`
- открывает Open Item на `4230`; контрагент не обязателен

Проводки:
  - Дт `4230` = `amount`
  - Кт `5110` = `amount`

### `ACCOUNTABLE_GENERAL_RETURN`

**Возврат неизрасходованного остатка подотчётных сумм (общехозяйственные)**

- Режим: `BANK_AUTO`
- закрывает Open Item на `4230`; требует контрагента

Проводки:
  - Дт `5110` = `amount`
  - Кт `4230` = `amount`

### `ACCOUNTABLE_RETURN`

**Возврат неизрасходованного остатка подотчётных сумм (командировочные)**

- Режим: `BANK_AUTO`
- закрывает Open Item на `4220`; требует контрагента

Проводки:
  - Дт `5110` = `amount`
  - Кт `4220` = `amount`

### `ADVANCE_PAID`

**Аванс выданный**

- Режим: `BANK_AUTO`
- открывает Open Item на `4310`; требует контрагента

Проводки:
  - Дт `4310` = `amount`
  - Кт `5110` = `amount`

### `ADVANCE_RECEIVED`

**Аванс полученный**

- Режим: `BANK_AUTO`
- открывает Open Item на `6310`; требует контрагента

Проводки:
  - Дт `5110` = `amount`
  - Кт `6310` = `amount`

### `ADVANCE_RETURN_SENT`

**Возврат ошибочно полученного аванса покупателю**

- Режим: `BANK_AUTO`
- закрывает Open Item на `6310`; требует контрагента

Проводки:
  - Дт `6310` = `amount`
  - Кт `5110` = `amount`

### `ADVERTISING`

**Реклама / маркетинг**

- Режим: `BANK_AUTO`
- требует контрагента

Проводки:
  - Дт `9410` = `amount`
  - Кт `5110` = `amount`

### `BANK_COMMISSION`

**Комиссия банка**

- Режим: `BANK_AUTO`
- контрагент не обязателен

Проводки:
  - Дт `9430` = `amount`
  - Кт `5110` = `amount`

### `BANK_LOAN_RECEIVED`

**Получение банковского кредита**

- Режим: `BANK_AUTO`
- открывает Open Item на `6810`; требует контрагента

Проводки:
  - Дт `5110` = `amount`
  - Кт `6810` = `amount`

### `BANK_LOAN_REPAYMENT`

**Погашение банковского кредита**

- Режим: `BANK_AUTO`
- закрывает Open Item на `6810`; требует контрагента

Проводки:
  - Дт `6810` = `amount`
  - Кт `5110` = `amount`

### `CAPITAL_CONTRIBUTION`

**Оплата доли в уставном капитале**

- Режим: `BANK_AUTO`
- закрывает Open Item на `4610`; требует контрагента

Проводки:
  - Дт `5110` = `amount`
  - Кт `4610` = `amount`

### `CAPITAL_INCREASE_PENDING`

**Довзнос учредителя сверх устава (до регистрации изменений)**

- Режим: `BANK_AUTO`
- открывает Open Item на `6630`; требует контрагента

Проводки:
  - Дт `5110` = `amount`
  - Кт `6630` = `amount`

### `CASH_DEPOSIT`

**Взнос наличных на расчётный счёт**

- Режим: `BANK_AUTO`
- контрагент не обязателен

Проводки:
  - Дт `5110` = `amount`
  - Кт `5010` = `amount`

### `CASH_WITHDRAWAL`

**Снятие наличных с расчётного счёта**

- Режим: `BANK_AUTO`
- контрагент не обязателен

Проводки:
  - Дт `5010` = `amount`
  - Кт `5110` = `amount`

### `CUSTOMS_DUTY`

**Таможенные платежи и пошлины**

- Режим: `BANK_AUTO`
- контрагент не обязателен

Проводки:
  - Дт `2910` = `amount` — при условии `customsType == 'import_goods'`
  - Дт `0820` = `amount` — при условии `customsType == 'import_asset'`
  - Дт `9430` = `amount` — при условии `customsType != 'import_goods' && customsType != 'import_asset'`
  - Кт `5110` = `amount`

### `DEPOSIT`

**Гарантийный депозит**

- Режим: `BANK_AUTO`
- открывает Open Item на `4890`; требует контрагента

Проводки:
  - Дт `4890` = `amount`
  - Кт `5110` = `amount`

### `DEPOSIT_RETURN`

**Возврат гарантийного депозита**

- Режим: `BANK_AUTO`
- закрывает Open Item на `4890`; требует контрагента

Проводки:
  - Дт `5110` = `amount`
  - Кт `4890` = `amount`

### `DIVIDEND_INCOME_RECEIVED`

**Дивидендный доход полученный**

- Режим: `BANK_AUTO`
- контрагент не обязателен

Проводки:
  - Дт `5110` = `amount`
  - Кт `9520` = `amount`

### `DIVIDEND_PAYMENT`

**Выплата дивидендов учредителям**

- Режим: `BANK_AUTO`
- закрывает Open Item на `6610`; требует контрагента

Проводки:
  - Дт `6610` = `amount * 0.05`
  - Кт `6410` = `amount * 0.05`
  - Дт `6610` = `amount * (1 - 0.05)`
  - Кт `5110` = `amount * (1 - 0.05)`

### `EMPLOYEE_LOAN`

**Займ сотруднику**

- Режим: `BANK_AUTO`
- открывает Open Item на `4720`; контрагент не обязателен

Проводки:
  - Дт `4720` = `amount`
  - Кт `5110` = `amount`

### `EMPLOYEE_LOAN_REPAYMENT`

**Возврат займа сотрудником**

- Режим: `BANK_AUTO`
- контрагент не обязателен

Проводки:
  - Дт `5110` = `amount`
  - Кт `4720` = `amount`

### `FINANCE_LEASE_INTEREST`

**Проценты по финансовой аренде**

- Режим: `BANK_AUTO`
- контрагент не обязателен

Проводки:
  - Дт `9610` = `amount`
  - Кт `5110` = `amount`

### `FINANCE_LEASE_PAYMENT`

**Платёж по финансовой аренде (основная сумма)**

- Режим: `BANK_AUTO`
- закрывает Open Item на `7910`; контрагент не обязателен

Проводки:
  - Дт `7910` = `amount`
  - Кт `5110` = `amount`

### `FINE_PENALTY`

**Штраф, пеня, неустойка (уплата)**

- Режим: `BANK_AUTO`
- контрагент не обязателен

Проводки:
  - Дт `9430` = `amount`
  - Кт `5110` = `amount`

### `FIXED_ASSET_PURCHASE`

**Приобретение основного средства**

- Режим: `BANK_AUTO`
- требует контрагента

Проводки:
  - Дт `0820` = `amount`
  - Кт `5110` = `amount`

### `FIXED_ASSET_SALE`

**Поступление от продажи основного средства**

- Режим: `BANK_AUTO`
- требует контрагента

Проводки:
  - Дт `5110` = `amount`
  - Кт `9210` = `amount / 1.12` — при условии `isVatPayer`
  - Кт `9210` = `amount` — при условии `isVatPayer == 0`
  - Кт `6410` = `amount - (amount / 1.12)` — при условии `isVatPayer`

### `FOUNDER_LOAN`

**Займ от учредителя**

- Режим: `BANK_AUTO`
- открывает Open Item на `6820`; требует контрагента

Проводки:
  - Дт `5110` = `amount`
  - Кт `6820` = `amount`

### `FOUNDER_LOAN_REPAYMENT`

**Возврат займа учредителю**

- Режим: `BANK_AUTO`
- закрывает Open Item на `6820`; требует контрагента

Проводки:
  - Дт `6820` = `amount`
  - Кт `5110` = `amount`

### `GOODS_IN_TRANSIT`

**Товары в пути**

- Режим: `BANK_AUTO`
- открывает Open Item на `2970`; требует контрагента

Проводки:
  - Дт `2970` = `amount`
  - Кт `$creditAccountCode` = `amount`

### `GRANT_RECEIVED`

**Получение гранта**

- Режим: `BANK_AUTO`
- закрывает Open Item на `4890`; контрагент не обязателен

Проводки:
  - Дт `5110` = `amount`
  - Кт `4890` = `amount`

### `IMPORT_VAT_PAYMENT`

**Уплата импортного НДС**

- Режим: `BANK_AUTO`
- контрагент не обязателен

Проводки:
  - Дт `4410` = `amount`
  - Кт `5110` = `amount`

### `INPS_PAYMENT`

**Уплата ИНПС (накопительная пенсия)**

- Режим: `BANK_AUTO`
- контрагент не обязателен

Проводки:
  - Дт `6530` = `amount`
  - Кт `5110` = `amount`

### `INSURANCE_PAYMENT`

**Страховой взнос (предоплата)**

- Режим: `BANK_AUTO`
- требует контрагента

Проводки:
  - Дт `3120` = `amount`
  - Кт `5110` = `amount`

### `INTANGIBLE_ASSET_PURCHASE`

**Приобретение нематериального актива**

- Режим: `BANK_AUTO`
- требует контрагента

Проводки:
  - Дт `0830` = `amount`
  - Кт `5110` = `amount`

### `INTEREST_INCOME_RECEIVED`

**Процентный доход полученный**

- Режим: `BANK_AUTO`
- контрагент не обязателен

Проводки:
  - Дт `5110` = `amount`
  - Кт `9530` = `amount`

### `INTEREST_PAYMENT`

**Выплата процентов по кредиту / займу**

- Режим: `BANK_AUTO`
- требует контрагента

Проводки:
  - Дт `9610` = `amount`
  - Кт `5110` = `amount`

### `INTERNAL_TRANSFER`

**Внутренний перевод (исходящий)**

- Режим: `BANK_AUTO`
- открывает Open Item на `5710`; контрагент не обязателен

Проводки:
  - Дт `5710` = `amount`
  - Кт `5110` = `amount`

### `INTERNAL_TRANSFER_RECEIVED`

**Внутренний перевод (поступление)**

- Режим: `BANK_AUTO`
- закрывает Open Item на `5710`; контрагент не обязателен

Проводки:
  - Дт `$destinationAccountCode` = `amount`
  - Кт `5710` = `amount`

### `LETTER_OF_CREDIT_OPEN`

**Открытие аккредитива**

- Режим: `BANK_AUTO`
- открывает Open Item на `5510`; требует контрагента

Проводки:
  - Дт `5510` = `amount`
  - Кт `5110` = `amount`

### `LONG_TERM_LOAN_RECEIVED`

**Получение долгосрочного займа**

- Режим: `BANK_AUTO`
- открывает Open Item на `$loanAccountCode`; контрагент не обязателен

Проводки:
  - Дт `5110` = `amount`
  - Кт `$loanAccountCode` = `amount`

### `LONG_TERM_LOAN_REPAYMENT`

**Погашение долгосрочного займа**

- Режим: `BANK_AUTO`
- закрывает Open Item на `$loanAccountCode`; контрагент не обязателен

Проводки:
  - Дт `$loanAccountCode` = `amount`
  - Кт `5110` = `amount`

### `MARKETPLACE_INCOME`

**Поступление от маркетплейса (расчёты с агрегатором)**

- Режим: `BANK_AUTO`
- открывает Open Item на `4890`; требует контрагента

Проводки:
  - Дт `5110` = `amount`
  - Кт `4890` = `amount`

### `OTHER_EXPENSE`

**Прочий расход**

- Режим: `BANK_AUTO`
- контрагент не обязателен

Проводки:
  - Дт `9430` = `amount`
  - Кт `5110` = `amount`

### `PREPAID_RENT_PAYMENT`

**Предоплата аренды**

- Режим: `BANK_AUTO`
- контрагент не обязателен

Проводки:
  - Дт `3110` = `amount`
  - Кт `5110` = `amount`

### `REFUND`

**Возврат / корректировка**

- Режим: `BANK_AUTO`
- требует контрагента

Проводки:
  - Дт `9040` = `amount`
  - Кт `5110` = `amount`

### `RENT`

**Аренда**

- Режим: `BANK_AUTO`
- требует контрагента

Проводки:
  - Дт `9420` = `amount`
  - Кт `5110` = `amount`

### `RENT_PAYMENT`

**Оплата аренды (после начисления)**

- Режим: `BANK_AUTO`
- требует контрагента

Проводки:
  - Дт `6010` = `amount`
  - Кт `5110` = `amount`

### `RENTAL_INCOME_RECEIVED`

**Доход от аренды**

- Режим: `BANK_AUTO`
- контрагент не обязателен

Проводки:
  - Дт `5110` = `amount`
  - Кт `9350` = `amount`

### `REVENUE_COLLECTION`

**Поступление оплаты за отгруженные товары/услуги (постоплата)**

- Режим: `BANK_AUTO`
- закрывает Open Item на `4010`; требует контрагента

Проводки:
  - Дт `5110` = `amount`
  - Кт `4010` = `amount`

### `ROYALTY_INCOME`

**Доход от роялти получен**

- Режим: `BANK_AUTO`
- требует контрагента

Проводки:
  - Дт `5110` = `amount`
  - Кт `9510` = `amount`

### `ROYALTY_PAYMENT`

**Выплата роялти**

- Режим: `BANK_AUTO`
- требует контрагента

Проводки:
  - Дт `9430` = `amount`
  - Кт `5110` = `amount`

### `SALARY`

**Выплата зарплаты**

- Режим: `BANK_AUTO`
- контрагент не обязателен

Проводки:
  - Дт `6710` = `amount`
  - Кт `5110` = `amount`

### `SALARY_ADVANCE`

**Аванс по заработной плате**

- Режим: `BANK_AUTO`
- контрагент не обязателен

Проводки:
  - Дт `4210` = `amount`
  - Кт `5110` = `amount`

### `SALARY_DEPOSIT_PAYMENT`

**Выплата депонированной заработной платы**

- Режим: `BANK_AUTO`
- закрывает Open Item на `6720`; контрагент не обязателен

Проводки:
  - Дт `6720` = `amount`
  - Кт `5110` = `amount`

### `SOCIAL_TAX_PAYMENT`

**Уплата социального налога**

- Режим: `BANK_AUTO`
- контрагент не обязателен

Проводки:
  - Дт `6520` = `amount`
  - Кт `5110` = `amount`

### `SUBSCRIPTION`

**Подписка, лицензия, SaaS-сервис**

- Режим: `BANK_AUTO`
- требует контрагента

Проводки:
  - Дт `9420` = `amount` — при условии `subscriptionPeriod == 'monthly'`
  - Дт `3120` = `amount` — при условии `subscriptionPeriod != 'monthly'`
  - Кт `5110` = `amount`

### `SUBSIDY_RECEIVED`

**Получение субсидии**

- Режим: `BANK_AUTO`
- закрывает Open Item на `4890`; контрагент не обязателен

Проводки:
  - Дт `5110` = `amount`
  - Кт `4890` = `amount`

### `SUPPLIER_PAYMENT_GOODS`

**Закупка товаров (погашение долга)**

- Режим: `BANK_AUTO`
- закрывает Open Item на `6010`; требует контрагента

Проводки:
  - Дт `6010` = `amount`
  - Кт `5110` = `amount`

### `SUPPLIER_PAYMENT_OTHER`

**Прочая закупка (погашение долга)**

- Режим: `BANK_AUTO`
- закрывает Open Item на `6010`; требует контрагента

Проводки:
  - Дт `6010` = `amount`
  - Кт `5110` = `amount`

### `SUPPLIER_PAYMENT_SERVICES`

**Оплата за услуги (погашение долга)**

- Режим: `BANK_AUTO`
- закрывает Open Item на `6010`; требует контрагента

Проводки:
  - Дт `6010` = `amount`
  - Кт `5110` = `amount`

### `SUPPLIER_PAYMENT_VAT`

**Оплата поставщику (погашение долга)**

- Режим: `BANK_AUTO`
- закрывает Open Item на `6010`; требует контрагента

Проводки:
  - Дт `6010` = `amount`
  - Кт `5110` = `amount`

### `SUPPLIER_REFUND`

**Возврат от поставщика**

- Режим: `BANK_AUTO`
- закрывает Open Item на `4310`; требует контрагента

Проводки:
  - Дт `5110` = `amount`
  - Кт `4310` = `amount`

### `TARGET_RECEIPTS`

**Целевые поступления (членские взносы / прочие)**

- Режим: `BANK_AUTO`
- контрагент не обязателен

Проводки:
  - Дт `5110` = `amount`
  - Кт `8830` = `amount` — при условии `receiptType == 'membership'`
  - Кт `8890` = `amount` — при условии `receiptType != 'membership'`

### `TAX_PAYMENT`

**Уплата налога**

- Режим: `BANK_AUTO`
- контрагент не обязателен

Проводки:
  - Дт `6410` = `amount`
  - Кт `5110` = `amount`

### `UTILITY_PAYMENT`

**Коммунальные услуги (электроэнергия, вода, газ, тепло)**

- Режим: `BANK_AUTO`
- требует контрагента

Проводки:
  - Дт `9420` = `amount`
  - Кт `5110` = `amount`

### `VAT_REFUND_FROM_BUDGET`

**Возврат НДС из бюджета**

- Режим: `BANK_AUTO`
- контрагент не обязателен

Проводки:
  - Дт `5110` = `amount`
  - Кт `4410` = `amount`

## Только ручной ввод (73)

### `ACCOUNTABLE_GENERAL_WRITEOFF`

**Списание подотчётных сумм (общехозяйственные расходы)**

- Режим: `MANUAL_ONLY`
- закрывает Open Item на `4230`; требует контрагента

Проводки:
  - Дт `9430` = `amount`
  - Кт `4230` = `amount`

### `ACCOUNTABLE_WRITEOFF`

**Списание подотчётных сумм (командировочные, авансовый отчёт)**

- Режим: `MANUAL_ONLY`
- закрывает Open Item на `4220`; требует контрагента

Проводки:
  - Дт `9420` = `amount`
  - Кт `4220` = `amount`

### `BAD_DEBT_WRITEOFF`

**Списание безнадёжной дебиторской задолженности**

- Режим: `MANUAL_ONLY`
- требует контрагента

Проводки:
  - Дт `4910` = `amount` — при условии `useReserve`
  - Дт `9430` = `amount` — при условии `!useReserve`
  - Кт `4010` = `amount`

### `CAPITAL_INCREASE_REGISTERED`

**Реклассификация довзноса в уставный капитал (после регистрации устава)**

- Режим: `MANUAL_ONLY`
- закрывает Open Item на `6630`; требует контрагента

Проводки:
  - Дт `6630` = `amount`
  - Кт `8330` = `amount`

### `CORRECTIVE_INVOICE_ISSUED`

**Корректировочный счёт-фактура выданный**

- Режим: `MANUAL_ONLY`
- требует контрагента

Проводки:
  - Дт `9030` = `correctionAmount`
  - Дт `6410` = `vatCorrection`
  - Кт `$settlementAccountCode` = `correctionAmount + vatCorrection`

### `CORRECTIVE_INVOICE_RECEIVED`

**Корректировочный счёт-фактура полученный**

- Режим: `MANUAL_ONLY`
- требует контрагента

Проводки:
  - Дт `6010` = `correctionAmount + vatCorrection`
  - Кт `$expenseOrAssetAccountCode` = `correctionAmount`
  - Кт `4410` = `vatCorrection`

### `COUNTERPARTY_SETOFF`

**Взаимозачёт с контрагентом**

- Режим: `MANUAL_ONLY`
- требует контрагента

Проводки:
  - Дт `6010` = `amount`
  - Кт `4010` = `amount`

### `DEPOSIT_INTEREST_ACCRUAL`

**Начисление процентов по депозиту**

- Режим: `MANUAL_ONLY`
- контрагент не обязателен

Проводки:
  - Дт `4830` = `amount`
  - Кт `9530` = `amount`

### `DEPRECIATION_ACCRUAL`

**Начисление амортизации основных средств**

- Режим: `MANUAL_ONLY`
- контрагент не обязателен

Проводки:
  - Дт `9420` = `depreciationAmount`
  - Кт `0200` = `depreciationAmount`

### `DIVIDEND_ACCRUAL`

**Начисление дивидендов учредителям**

- Режим: `MANUAL_ONLY`
- открывает Open Item на `6610`; требует контрагента

Проводки:
  - Дт `8710` = `amount`
  - Кт `6610` = `amount`

### `EXTRAORDINARY_GAIN_LOSS`

**Чрезвычайные доходы/расходы**

- Режим: `MANUAL_ONLY`
- контрагент не обязателен

Проводки:
  - Дт `$accountCode` = `gainAmount` — при условии `gainAmount > 0`
  - Кт `9710` = `gainAmount` — при условии `gainAmount > 0`
  - Дт `9720` = `lossAmount` — при условии `lossAmount > 0`
  - Кт `$accountCode` = `lossAmount` — при условии `lossAmount > 0`

### `FINANCE_LEASE_ASSET_RECEIVED`

**Получение основных средств по финансовой аренде**

- Режим: `MANUAL_ONLY`
- открывает Open Item на `7910`; требует контрагента

Проводки:
  - Дт `0310` = `amount`
  - Кт `7910` = `amount`

### `FINANCE_LEASE_DEPRECIATION`

**Амортизация имущества по финансовой аренде**

- Режим: `MANUAL_ONLY`
- контрагент не обязателен

Проводки:
  - Дт `9420` = `amount`
  - Кт `0299` = `amount`

### `FINISHED_GOODS_OUTPUT`

**Выпуск готовой продукции**

- Режим: `MANUAL_ONLY`
- контрагент не обязателен

Проводки:
  - Дт `2810` = `amount`
  - Кт `2010` = `amount`

### `FINISHED_GOODS_SOLD`

**Списание себестоимости реализованной готовой продукции**

- Режим: `MANUAL_ONLY`
- контрагент не обязателен

Проводки:
  - Дт `9110` = `amount`
  - Кт `2810` = `amount`

### `FIXED_ASSET_COMMISSIONING`

**Ввод основного средства в эксплуатацию**

- Режим: `MANUAL_ONLY`
- контрагент не обязателен

Проводки:
  - Дт `$assetAccountCode` = `acquisitionCost`
  - Кт `0820` = `acquisitionCost`

### `FIXED_ASSET_DISPOSAL`

**Выбытие (списание) основного средства**

- Режим: `MANUAL_ONLY`
- контрагент не обязателен

Проводки:
  - Дт `0200` = `accumulatedDepreciation`
  - Дт `9210` = `acquisitionCost - accumulatedDepreciation` — при условии `acquisitionCost > accumulatedDepreciation`
  - Кт `$assetAccountCode` = `acquisitionCost`

### `FIXED_ASSET_DISPOSAL_RESULT`

**Признание прибыли/убытка от выбытия ОС (закрытие 9210)**

- Режим: `MANUAL_ONLY`
- контрагент не обязателен

Проводки:
  - Дт `9210` = `profit` — при условии `profit > 0`
  - Кт `9310` = `profit` — при условии `profit > 0`
  - Дт `9320` = `loss` — при условии `loss > 0`
  - Кт `9210` = `loss` — при условии `loss > 0`

### `FIXED_ASSET_REVALUATION`

**Переоценка основных средств**

- Режим: `MANUAL_ONLY`
- контрагент не обязателен

Проводки:
  - Дт `$assetAccountCode` = `increaseAmount` — при условии `increaseAmount > 0`
  - Кт `8510` = `increaseAmount` — при условии `increaseAmount > 0`
  - Дт `8510` = `deprAdjustment` — при условии `deprAdjustment > 0`
  - Кт `0200` = `deprAdjustment` — при условии `deprAdjustment > 0`
  - Дт `9430` = `decreaseAmount` — при условии `decreaseAmount > 0`
  - Кт `$assetAccountCode` = `decreaseAmount` — при условии `decreaseAmount > 0`

### `FIXED_ASSET_SALVAGE`

**Оприходование годных остатков после выбытия ОС**

- Режим: `MANUAL_ONLY`
- контрагент не обязателен

Проводки:
  - Дт `1090` = `amount`
  - Кт `9210` = `amount`

### `FX_DIFFERENCE`

**Курсовая разница валютных счетов**

- Режим: `MANUAL_ONLY`
- контрагент не обязателен

Проводки:
  - Дт `$fxAccountCode` = `fxDifference` — при условии `fxDifference > 0`
  - Кт `9540` = `fxDifference` — при условии `fxDifference > 0`
  - Дт `9620` = `-fxDifference` — при условии `fxDifference < 0`
  - Кт `$fxAccountCode` = `-fxDifference` — при условии `fxDifference < 0`

### `GOODS_IN_TRANSIT_RECEIVED`

**Оприходование товаров в пути на склад**

- Режим: `MANUAL_ONLY`
- закрывает Open Item на `2970`; контрагент не обязателен

Проводки:
  - Дт `2910` = `amount`
  - Кт `2970` = `amount`

### `GOODS_RECEIVED`

**Поступление товаров (начисление постоплаты)**

- Режим: `MANUAL_ONLY`
- открывает Open Item на `6010`; требует контрагента

Проводки:
  - Дт `2910` = `amount - vatAmount`
  - Дт `4410` = `vatAmount` — при условии `vatAmount > 0`
  - Кт `6010` = `amount`

### `GOODS_RECEIVED_PREPAID`

**Поступление товаров (зачет аванса)**

- Режим: `MANUAL_ONLY`
- закрывает Open Item на `4310`; требует контрагента

Проводки:
  - Дт `2910` = `amount - vatAmount`
  - Дт `4410` = `vatAmount` — при условии `vatAmount > 0`
  - Кт `4310` = `amount`

### `GOODS_RETURNED_FROM_CUSTOMER`

**Возврат товара от покупателя**

- Режим: `MANUAL_ONLY`
- требует контрагента

Проводки:
  - Дт `9040` = `amount`
  - Кт `$settlementAccountCode` = `amount`
  - Дт `6410` = `vatAmount`
  - Кт `$settlementAccountCode` = `vatAmount`
  - Дт `2910` = `costAmount`
  - Кт `9120` = `costAmount`

### `GOODS_RETURNED_TO_SUPPLIER`

**Возврат товаров поставщику**

- Режим: `MANUAL_ONLY`
- требует контрагента

Проводки:
  - Дт `6010` = `amount`
  - Кт `2910` = `amount`

### `GOODS_REVALUATION`

**Переоценка товаров**

- Режим: `MANUAL_ONLY`
- контрагент не обязателен

Проводки:
  - Дт `2910` = `increaseAmount` — при условии `increaseAmount > 0`
  - Кт `6230` = `increaseAmount` — при условии `increaseAmount > 0`
  - Дт `3190` = `decreaseAmount` — при условии `decreaseAmount > 0`
  - Кт `2910` = `decreaseAmount` — при условии `decreaseAmount > 0`

### `GOODS_SOLD`

**Списание себестоимости реализованных товаров**

- Режим: `MANUAL_ONLY`
- контрагент не обязателен

Проводки:
  - Дт `9120` = `amount`
  - Кт `2910` = `amount`

### `GRANT_RECEIVABLE`

**Признание гранта (получено уведомление)**

- Режим: `MANUAL_ONLY`
- открывает Open Item на `4890`; контрагент не обязателен

Проводки:
  - Дт `4890` = `amount`
  - Кт `8810` = `amount`

### `GRATUITOUS_RECEIPT_FA`

**Безвозмездное получение основных средств**

- Режим: `MANUAL_ONLY`
- контрагент не обязателен

Проводки:
  - Дт `$assetAccountCode` = `amount`
  - Кт `8530` = `amount`

### `GRATUITOUS_RECEIPT_GOODS`

**Безвозмездное получение товаров**

- Режим: `MANUAL_ONLY`
- контрагент не обязателен

Проводки:
  - Дт `2910` = `amount`
  - Кт `8530` = `amount`

### `GRATUITOUS_RECEIPT_IA`

**Безвозмездное получение нематериальных активов**

- Режим: `MANUAL_ONLY`
- контрагент не обязателен

Проводки:
  - Дт `$assetAccountCode` = `amount`
  - Кт `8530` = `amount`

### `GRATUITOUS_RECEIPT_MATERIALS`

**Безвозмездное получение материалов**

- Режим: `MANUAL_ONLY`
- контрагент не обязателен

Проводки:
  - Дт `1010` = `amount`
  - Кт `8530` = `amount`

### `GRATUITOUS_RECEIPT_SECURITIES`

**Безвозмездное получение ценных бумаг**

- Режим: `MANUAL_ONLY`
- контрагент не обязателен

Проводки:
  - Дт `0610` = `amount`
  - Кт `8530` = `amount`

### `INSURANCE_WRITEOFF`

**Списание предоплаченной страховки по периодам**

- Режим: `MANUAL_ONLY`
- контрагент не обязателен

Проводки:
  - Дт `9420` = `amount`
  - Кт `3120` = `amount`

### `INTANGIBLE_ASSET_COMMISSIONING`

**Ввод нематериального актива в эксплуатацию**

- Режим: `MANUAL_ONLY`
- контрагент не обязателен

Проводки:
  - Дт `$assetAccountCode` = `acquisitionCost`
  - Кт `0830` = `acquisitionCost`

### `INVENTORY_SHORTAGE`

**Недостачи, выявленные при инвентаризации**

- Режим: `MANUAL_ONLY`
- контрагент не обязателен

Проводки:
  - Дт `5910` = `amount`
  - Кт `$assetAccountCode` = `amount`

### `INVENTORY_SHORTAGE_RESOLUTION`

**Отнесение недостачи (на виновного / в убыток)**

- Режим: `MANUAL_ONLY`
- контрагент не обязателен

Проводки:
  - Дт `4730` = `amount` — при условии `hasCulprit`
  - Дт `9430` = `amount` — при условии `!hasCulprit`
  - Кт `5910` = `amount`

### `INVENTORY_SURPLUS`

**Оприходование излишков, выявленных при инвентаризации**

- Режим: `MANUAL_ONLY`
- контрагент не обязателен

Проводки:
  - Дт `$assetAccountCode` = `amount`
  - Кт `9390` = `amount`

### `INVENTORY_WRITEOFF`

**Списание товарно-материальных запасов**

- Режим: `MANUAL_ONLY`
- контрагент не обязателен

Проводки:
  - Дт `$expenseAccountCode` = `amount`
  - Кт `$inventoryAccountCode` = `amount`

### `INVOICE_CONFIRMED`

**Подтверждение ЭСФ покупателем (начисление постоплаты)**

- Режим: `MANUAL_ONLY`
- открывает Open Item на `4010`; требует контрагента

Проводки:
  - Дт `4010` = `amount`
  - Кт `9030` = `amount - vatAmount`
  - Кт `6410` = `vatAmount` — при условии `vatAmount > 0`

### `INVOICE_CONFIRMED_PREPAID`

**Подтверждение ЭСФ покупателем (зачет аванса)**

- Режим: `MANUAL_ONLY`
- требует контрагента

Проводки:
  - Дт `6310` = `amount`
  - Кт `9030` = `amount - vatAmount`
  - Кт `6410` = `vatAmount` — при условии `vatAmount > 0`

### `LETTER_OF_CREDIT_EXECUTION`

**Исполнение аккредитива**

- Режим: `MANUAL_ONLY`
- закрывает Open Item на `5510`; требует контрагента

Проводки:
  - Дт `6010` = `amount`
  - Кт `5510` = `amount`

### `LONG_TERM_TO_CURRENT_RECLASS`

**Перевод долгосрочной задолженности в краткосрочную часть**

- Режим: `MANUAL_ONLY`
- контрагент не обязателен

Проводки:
  - Дт `7810` = `amount`
  - Кт `6950` = `amount`

### `MARKETPLACE_REVENUE`

**Выручка маркетплейса (зачет расчётов с агрегатором и комиссия)**

- Режим: `MANUAL_ONLY`
- требует контрагента

Проводки:
  - Дт `4890` = `netAmount`
  - Дт `9430` = `commissionAmount`
  - Кт `9030` = `amount - vatAmount`
  - Кт `6410` = `vatAmount` — при условии `vatAmount > 0`

### `MATERIALS_RECEIVED`

**Поступление материалов от поставщика**

- Режим: `MANUAL_ONLY`
- открывает Open Item на `6010`; требует контрагента

Проводки:
  - Дт `1010` = `amount`
  - Дт `4410` = `vatAmount` — при условии `vatAmount > 0`
  - Кт `6010` = `amount + vatAmount`

### `MATERIALS_RETURNED_TO_SUPPLIER`

**Возврат материалов поставщику**

- Режим: `MANUAL_ONLY`
- требует контрагента

Проводки:
  - Дт `6010` = `amount`
  - Кт `1010` = `amount`

### `MATERIALS_TO_PRODUCTION`

**Передача материалов в производство**

- Режим: `MANUAL_ONLY`
- контрагент не обязателен

Проводки:
  - Дт `2010` = `amount`
  - Кт `1010` = `amount`

### `NMA_AMORTIZATION`

**Начисление амортизации НМА**

- Режим: `MANUAL_ONLY`
- контрагент не обязателен

Проводки:
  - Дт `$expenseAccountCode` = `amount`
  - Кт `$amortizationAccountCode` = `amount`

### `OPENING_CAPITAL_DECLARATION`

**Декларация уставного капитала**

- Режим: `MANUAL_ONLY`
- контрагент не обязателен

Проводки:
  - Дт `4610` = `amount`
  - Кт `8330` = `amount`
  - Дт `5110` = `amount` — при условии `fundingType == 'FULLY_PAID_CASH'`
  - Кт `4610` = `amount` — при условии `fundingType == 'FULLY_PAID_CASH'`
  - Дт `5110` = `paidAmount` — при условии `fundingType == 'PARTIALLY_PAID'`
  - Кт `4610` = `paidAmount` — при условии `fundingType == 'PARTIALLY_PAID'`
  - Дт `$fundedAccountCode` = `paidAmount` — при условии `fundingType == 'PAID_IN_KIND'`
  - Кт `4610` = `paidAmount` — при условии `fundingType == 'PAID_IN_KIND'`

### `PERIOD_CLOSING`

**Закрытие счетов доходов и расходов (реформация баланса)**

- Режим: `MANUAL_ONLY`
- контрагент не обязателен

Проводки:
  _(нет строк проводки)_

### `PREPAID_RENT_RECOGNITION`

**Признание предоплаченной аренды**

- Режим: `MANUAL_ONLY`
- контрагент не обязателен

Проводки:
  - Дт `9420` = `amount`
  - Кт `3110` = `amount`

### `PROFIT_TAX_ACCRUAL`

**Начисление налога на прибыль**

- Режим: `MANUAL_ONLY`
- контрагент не обязателен

Проводки:
  - Дт `9810` = `taxAmount`
  - Кт `6410` = `taxAmount`

### `PROVISION_FOR_DOUBTFUL_DEBTS`

**Резерв по сомнительным долгам**

- Режим: `MANUAL_ONLY`
- контрагент не обязателен

Проводки:
  - Дт `9430` = `amount`
  - Кт `4910` = `amount`

### `PROVISION_FUTURE_EXPENSES`

**Создание резерва предстоящих расходов и платежей**

- Режим: `MANUAL_ONLY`
- контрагент не обязателен

Проводки:
  - Дт `$expenseAccountCode` = `amount`
  - Кт `8910` = `amount`

### `PROVISION_FUTURE_EXPENSES_USE`

**Использование резерва предстоящих расходов**

- Режим: `MANUAL_ONLY`
- контрагент не обязателен

Проводки:
  - Дт `8910` = `amount`
  - Кт `$targetAccountCode` = `amount`

### `PROVISION_UNUSED_TO_INCOME`

**Восстановление неиспользованного резерва в доход**

- Режим: `MANUAL_ONLY`
- контрагент не обязателен

Проводки:
  - Дт `8910` = `amount`
  - Кт `9390` = `amount`

### `RENT_ACCRUAL`

**Начисление аренды (неденежное)**

- Режим: `MANUAL_ONLY`
- контрагент не обязателен

Проводки:
  - Дт `9420` = `rentAmount`
  - Кт `6010` = `rentAmount`

### `RESERVE_CAPITAL_FORMATION`

**Формирование резервного капитала**

- Режим: `MANUAL_ONLY`
- контрагент не обязателен

Проводки:
  - Дт `8710` = `amount`
  - Кт `8520` = `amount`

### `REVENUE_NO_VAT`

**Поступление от покупателя (без НДС)**

- Режим: `MANUAL_ONLY`
- требует контрагента

Проводки:
  - Дт `5110` = `amount`
  - Кт `9030` = `amount`

### `REVENUE_VAT`

**Поступление от покупателя (с НДС)**

- Режим: `MANUAL_ONLY`
- требует контрагента

Проводки:
  - Дт `5110` = `amount`
  - Кт `9030` = `amount / 1.12`
  - Кт `6410` = `amount - (amount / 1.12)`

### `SALARY_ACCRUAL`

**Начисление заработной платы и налогов ФОТ**

- Режим: `MANUAL_ONLY`
- контрагент не обязателен

Проводки:
  - Дт `$expenseAccountCode` = `salaryAmount`
  - Кт `6710` = `salaryAmount`
  - Дт `6710` = `salaryAmount * 0.001`
  - Кт `6530` = `salaryAmount * 0.001`
  - Дт `6710` = `salaryAmount * 0.119`
  - Кт `6410` = `salaryAmount * 0.119`
  - Дт `$expenseAccountCode` = `salaryAmount * 0.12`
  - Кт `6520` = `salaryAmount * 0.12`

### `SALARY_DEPOSIT`

**Депонирование заработной платы**

- Режим: `MANUAL_ONLY`
- открывает Open Item на `6720`; контрагент не обязателен

Проводки:
  - Дт `6710` = `amount`
  - Кт `6720` = `amount`

### `SALARY_OFFSET`

**Зачёт займа сотруднику в счёт зарплаты**

- Режим: `MANUAL_ONLY`
- контрагент не обязателен

Проводки:
  - Дт `6710` = `amount`
  - Кт `4720` = `amount`

### `SERVICE_RECEIVED`

**Получение услуги (начисление постоплаты)**

- Режим: `MANUAL_ONLY`
- открывает Open Item на `6010`; требует контрагента

Проводки:
  - Дт `9420` = `amount - vatAmount`
  - Дт `4410` = `vatAmount` — при условии `vatAmount > 0`
  - Кт `6010` = `amount`

### `SERVICE_RECEIVED_PREPAID`

**Получение услуги (зачет аванса)**

- Режим: `MANUAL_ONLY`
- закрывает Open Item на `4310`; требует контрагента

Проводки:
  - Дт `9420` = `amount - vatAmount`
  - Дт `4410` = `vatAmount` — при условии `vatAmount > 0`
  - Кт `4310` = `amount`

### `SUBSCRIPTION_WRITEOFF`

**Списание расходов будущих периодов (подписка)**

- Режим: `MANUAL_ONLY`
- контрагент не обязателен

Проводки:
  - Дт `9420` = `amount`
  - Кт `3120` = `amount`

### `SUBSIDY_RECEIVABLE`

**Признание субсидии (получено уведомление)**

- Режим: `MANUAL_ONLY`
- открывает Open Item на `4890`; контрагент не обязателен

Проводки:
  - Дт `4890` = `amount`
  - Кт `8820` = `amount`

### `SUPPLIER_PAYMENT`

**Оплата поставщику (погашение долга, устаревший тип)**

- Режим: `MANUAL_ONLY`
- закрывает Open Item на `6010`; требует контрагента

Проводки:
  - Дт `6010` = `amount`
  - Кт `5110` = `amount`

### `TAX_EXEMPTION_RECOGNITION`

**Признание целевых налоговых льгот**

- Режим: `MANUAL_ONLY`
- контрагент не обязателен

Проводки:
  - Дт `6410` = `amount`
  - Кт `8840` = `amount`

### `TURNOVER_TAX_ACCRUAL`

**Начисление налога с оборота**

- Режим: `MANUAL_ONLY`
- контрагент не обязателен

Проводки:
  - Дт `9810` = `taxAmount`
  - Кт `6410` = `taxAmount`

### `VAT_OFFSET`

**Зачёт входящего НДС в счёт исходящего (4410 → 6410)**

- Режим: `MANUAL_ONLY`
- закрывает Open Item на `4410`; контрагент не обязателен

Проводки:
  - Дт `6410` = `vatAmount`
  - Кт `4410` = `vatAmount`

### `WRITE_OFF_CREDITORS`

**Списание кредиторской задолженности**

- Режим: `MANUAL_ONLY`
- требует контрагента

Проводки:
  - Дт `6010` = `amount`
  - Кт `9360` = `amount`


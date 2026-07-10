# Типы документов Contador v2

> Автогенерируется из `src/lib/ensureBaseData.ts` (`baseDocumentTypes`).
> **Не редактировать вручную** — правки будут потеряны при следующем запуске `npm run docs:types`.
> Регенерировать: `npm run docs:types`.

Всего типов документов: **178**.

## Автоматически по банковской выписке (104)

### `ACCOUNTABLE`

**Деньги под отчёт — командировка (Расход)**

- Режим: `BANK_AUTO`
- открывает Open Item на `4220`; контрагент не обязателен

Проводки:
  - Дт `4220` = `amount`
  - Кт `5110` = `amount`

### `ACCOUNTABLE_GENERAL`

**Деньги под отчёт — офис (Расход)**

- Режим: `BANK_AUTO`
- открывает Open Item на `4230`; контрагент не обязателен

Проводки:
  - Дт `4230` = `amount`
  - Кт `5110` = `amount`

### `ACCOUNTABLE_GENERAL_RETURN`

**Сотрудник вернул остаток — офис (Доход)**

- Режим: `BANK_AUTO`
- закрывает Open Item на `4230`; требует контрагента

Проводки:
  - Дт `5110` = `amount`
  - Кт `4230` = `amount`

### `ACCOUNTABLE_RETURN`

**Сотрудник вернул остаток — командировка (Доход)**

- Режим: `BANK_AUTO`
- закрывает Open Item на `4220`; требует контрагента

Проводки:
  - Дт `5110` = `amount`
  - Кт `4220` = `amount`

### `ACQUIRING_COMMISSION`

**Комиссия эквайринга (Расход)**

- Режим: `BANK_AUTO`
- требует контрагента

Проводки:
  - Дт `9430` = `amount`
  - Кт `5110` = `amount`

### `ADVANCE_PAID`

**Предоплата поставщику (Расход)**

- Режим: `BANK_AUTO`
- открывает Open Item на `4310`; требует контрагента

Проводки:
  - Дт `4310` = `amount`
  - Кт `5110` = `amount`

### `ADVANCE_RECEIVED`

**Предоплата от клиента (Доход)**

- Режим: `BANK_AUTO`
- открывает Open Item на `6310`; требует контрагента

Проводки:
  - Дт `5110` = `amount`
  - Кт `6310` = `amount`

### `ADVANCE_RETURN_SENT`

**Возврат предоплаты клиенту (Расход)**

- Режим: `BANK_AUTO`
- закрывает Open Item на `6310`; требует контрагента

Проводки:
  - Дт `6310` = `amount`
  - Кт `5110` = `amount`

### `ADVERTISING`

**Реклама и маркетинг (Расход)**

- Режим: `BANK_AUTO`
- требует контрагента

Проводки:
  - Дт `9410` = `amount`
  - Кт `5110` = `amount`

### `BANK_COMMISSION`

**Комиссия банка (Расход)**

- Режим: `BANK_AUTO`
- контрагент не обязателен

Проводки:
  - Дт `9430` = `amount`
  - Кт `5110` = `amount`

### `BANK_LOAN_RECEIVED`

**Кредит от банка получен (Доход)**

- Режим: `BANK_AUTO`
- открывает Open Item на `6810`; требует контрагента

Проводки:
  - Дт `5110` = `amount`
  - Кт `6810` = `amount`

### `BANK_LOAN_REPAYMENT`

**Погашение кредита банку (Расход)**

- Режим: `BANK_AUTO`
- закрывает Open Item на `6810`; требует контрагента

Проводки:
  - Дт `6810` = `amount`
  - Кт `5110` = `amount`

### `CAPITAL_CONTRIBUTION`

**Взнос учредителя в уставный капитал (Доход)**

- Режим: `BANK_AUTO`
- закрывает Open Item на `4610`; требует контрагента

Проводки:
  - Дт `5110` = `amount`
  - Кт `4610` = `amount`

### `CAPITAL_INCREASE_PENDING`

**Довзнос учредителя сверх устава (Доход)**

- Режим: `BANK_AUTO`
- открывает Open Item на `6630`; требует контрагента

Проводки:
  - Дт `5110` = `amount`
  - Кт `6630` = `amount`

### `CASH_COLLECTION_SERVICE`

**Инкассация (Расход)**

- Режим: `BANK_AUTO`
- требует контрагента

Проводки:
  - Дт `9430` = `amount`
  - Кт `5110` = `amount`

### `CASH_DEPOSIT`

**Внесение наличных на счёт (Доход)**

- Режим: `BANK_AUTO`
- контрагент не обязателен

Проводки:
  - Дт `5110` = `amount`
  - Кт `5010` = `amount`

### `CASH_WITHDRAWAL`

**Снятие наличных в кассу (Расход)**

- Режим: `BANK_AUTO`
- контрагент не обязателен

Проводки:
  - Дт `5010` = `amount`
  - Кт `5110` = `amount`

### `CHARITY_PAYMENT`

**Благотворительный взнос (Расход)**

- Режим: `BANK_AUTO`
- требует контрагента

Проводки:
  - Дт `9430` = `amount`
  - Кт `5110` = `amount`

### `CIVIL_CONTRACT_PAYMENT`

**Оплата по договору ГПХ (Расход)**

- Режим: `BANK_AUTO`
- требует контрагента

Проводки:
  - Дт `6710` = `amount`
  - Кт `5110` = `amount`

### `CONFERENCE_FEE`

**Участие в конференции/мероприятии (Расход)**

- Режим: `BANK_AUTO`
- требует контрагента

Проводки:
  - Дт `9420` = `amount`
  - Кт `5110` = `amount`

### `CURRENCY_EXCHANGE`

**Обмен валюты (Перевод)**

- Режим: `BANK_AUTO`
- контрагент не обязателен

Проводки:
  - Дт `5110` = `amount`
  - Кт `5210` = `amount`

### `CUSTOMS_BROKER`

**Оплата таможенному брокеру (Расход)**

- Режим: `BANK_AUTO`
- требует контрагента

Проводки:
  - Дт `2910` = `amount`
  - Кт `5110` = `amount`

### `CUSTOMS_DUTY`

**Таможенные платежи (Расход)**

- Режим: `BANK_AUTO`
- контрагент не обязателен

Проводки:
  - Дт `2910` = `amount` — при условии `customsType == 'import_goods'`
  - Дт `0820` = `amount` — при условии `customsType == 'import_asset'`
  - Дт `9430` = `amount` — при условии `customsType != 'import_goods' && customsType != 'import_asset'`
  - Кт `5110` = `amount`

### `DELIVERY_TO_CUSTOMER`

**Доставка товара покупателю (Расход)**

- Режим: `BANK_AUTO`
- требует контрагента

Проводки:
  - Дт `9410` = `amount`
  - Кт `5110` = `amount`

### `DEPOSIT`

**Гарантийный депозит выдан (Расход)**

- Режим: `BANK_AUTO`
- открывает Open Item на `4890`; требует контрагента

Проводки:
  - Дт `4890` = `amount`
  - Кт `5110` = `amount`

### `DEPOSIT_RETURN`

**Возврат гарантийного депозита (Доход)**

- Режим: `BANK_AUTO`
- закрывает Open Item на `4890`; требует контрагента

Проводки:
  - Дт `5110` = `amount`
  - Кт `4890` = `amount`

### `DIVIDEND_INCOME_RECEIVED`

**Дивиденды от других компаний (Доход)**

- Режим: `BANK_AUTO`
- контрагент не обязателен

Проводки:
  - Дт `5110` = `amount`
  - Кт `9520` = `amount`

### `DIVIDEND_PAYMENT`

**Дивиденды учредителям (Расход)**

- Режим: `BANK_AUTO`
- закрывает Open Item на `6610`; требует контрагента

Проводки:
  - Дт `6610` = `amount * 0.05`
  - Кт `6410` = `amount * 0.05`
  - Дт `6610` = `amount * (1 - 0.05)`
  - Кт `5110` = `amount * (1 - 0.05)`

### `EMPLOYEE_LOAN`

**Займ сотруднику (Расход)**

- Режим: `BANK_AUTO`
- открывает Open Item на `4720`; контрагент не обязателен

Проводки:
  - Дт `4720` = `amount`
  - Кт `5110` = `amount`

### `EMPLOYEE_LOAN_REPAYMENT`

**Сотрудник вернул займ (Доход)**

- Режим: `BANK_AUTO`
- контрагент не обязателен

Проводки:
  - Дт `5110` = `amount`
  - Кт `4720` = `amount`

### `EMPLOYEE_TRAINING`

**Обучение сотрудников (Расход)**

- Режим: `BANK_AUTO`
- требует контрагента

Проводки:
  - Дт `9420` = `amount`
  - Кт `5110` = `amount`

### `FACTORING_RECEIVED`

**Деньги по факторингу получены (Доход)**

- Режим: `BANK_AUTO`
- требует контрагента

Проводки:
  - Дт `5110` = `amount`
  - Кт `4010` = `amount`

### `FINANCE_LEASE_INTEREST`

**Проценты по лизингу (Расход)**

- Режим: `BANK_AUTO`
- контрагент не обязателен

Проводки:
  - Дт `9610` = `amount`
  - Кт `5110` = `amount`

### `FINANCE_LEASE_PAYMENT`

**Платёж по лизингу — тело (Расход)**

- Режим: `BANK_AUTO`
- закрывает Open Item на `7910`; контрагент не обязателен

Проводки:
  - Дт `7910` = `amount`
  - Кт `5110` = `amount`

### `FINE_PENALTY`

**Штраф/пеня уплачена (Расход)**

- Режим: `BANK_AUTO`
- контрагент не обязателен

Проводки:
  - Дт `9430` = `amount`
  - Кт `5110` = `amount`

### `FIXED_ASSET_PURCHASE`

**Покупка оборудования (Расход)**

- Режим: `BANK_AUTO`
- требует контрагента

Проводки:
  - Дт `0820` = `amount`
  - Кт `5110` = `amount`

### `FIXED_ASSET_SALE`

**Продажа оборудования (Доход)**

- Режим: `BANK_AUTO`
- требует контрагента

Проводки:
  - Дт `5110` = `amount`
  - Кт `9210` = `amount / 1.12` — при условии `isVatPayer`
  - Кт `9210` = `amount` — при условии `isVatPayer == 0`
  - Кт `6410` = `amount - (amount / 1.12)` — при условии `isVatPayer`

### `FOUNDER_LOAN`

**Займ от учредителя (Доход)**

- Режим: `BANK_AUTO`
- открывает Open Item на `6820`; требует контрагента

Проводки:
  - Дт `5110` = `amount`
  - Кт `6820` = `amount`

### `FOUNDER_LOAN_REPAYMENT`

**Возврат займа учредителю (Расход)**

- Режим: `BANK_AUTO`
- закрывает Open Item на `6820`; требует контрагента

Проводки:
  - Дт `6820` = `amount`
  - Кт `5110` = `amount`

### `FUEL_PURCHASE`

**Закупка топлива — ГСМ (Расход)**

- Режим: `BANK_AUTO`
- требует контрагента

Проводки:
  - Дт `1030` = `amount`
  - Кт `5110` = `amount`

### `GOODS_IN_TRANSIT`

**Товар оплачен, в пути (Перевод)**

- Режим: `BANK_AUTO`
- открывает Open Item на `2970`; требует контрагента

Проводки:
  - Дт `2970` = `amount`
  - Кт `$creditAccountCode` = `amount`

### `GRANT_RECEIVED`

**Грант получен (Доход)**

- Режим: `BANK_AUTO`
- закрывает Open Item на `4890`; контрагент не обязателен

Проводки:
  - Дт `5110` = `amount`
  - Кт `4890` = `amount`

### `IMPORT_VAT_PAYMENT`

**НДС на импорт (Расход)**

- Режим: `BANK_AUTO`
- контрагент не обязателен

Проводки:
  - Дт `4410` = `amount`
  - Кт `5110` = `amount`

### `INPS_PAYMENT`

**Накопительная пенсия — ИНПС (Расход)**

- Режим: `BANK_AUTO`
- контрагент не обязателен

Проводки:
  - Дт `6530` = `amount`
  - Кт `5110` = `amount`

### `INSURANCE_CLAIM_RECEIVED`

**Страховое возмещение получено (Доход)**

- Режим: `BANK_AUTO`
- требует контрагента

Проводки:
  - Дт `5110` = `amount`
  - Кт `9390` = `amount`

### `INSURANCE_PAYMENT`

**Страховой взнос (Расход)**

- Режим: `BANK_AUTO`
- требует контрагента

Проводки:
  - Дт `3120` = `amount`
  - Кт `5110` = `amount`

### `INTANGIBLE_ASSET_PURCHASE`

**Покупка ПО/лицензии/бренда (Расход)**

- Режим: `BANK_AUTO`
- требует контрагента

Проводки:
  - Дт `0830` = `amount`
  - Кт `5110` = `amount`

### `INTEREST_INCOME_RECEIVED`

**Проценты по депозиту получены (Доход)**

- Режим: `BANK_AUTO`
- контрагент не обязателен

Проводки:
  - Дт `5110` = `amount`
  - Кт `9530` = `amount`

### `INTEREST_PAYMENT`

**Проценты по кредиту/займу (Расход)**

- Режим: `BANK_AUTO`
- требует контрагента

Проводки:
  - Дт `9610` = `amount`
  - Кт `5110` = `amount`

### `INTERNAL_TRANSFER`

**Перевод на другой свой счёт (Перевод)**

- Режим: `BANK_AUTO`
- открывает Open Item на `5710`; контрагент не обязателен

Проводки:
  - Дт `5710` = `amount`
  - Кт `5110` = `amount`

### `INTERNAL_TRANSFER_RECEIVED`

**Поступление с другого своего счёта (Перевод)**

- Режим: `BANK_AUTO`
- закрывает Open Item на `5710`; контрагент не обязателен

Проводки:
  - Дт `$destinationAccountCode` = `amount`
  - Кт `5710` = `amount`

### `LETTER_OF_CREDIT_OPEN`

**Открытие аккредитива (Перевод)**

- Режим: `BANK_AUTO`
- открывает Open Item на `5510`; требует контрагента

Проводки:
  - Дт `5510` = `amount`
  - Кт `5110` = `amount`

### `LONG_TERM_LOAN_RECEIVED`

**Долгосрочный займ получен (Доход)**

- Режим: `BANK_AUTO`
- открывает Open Item на `$loanAccountCode`; контрагент не обязателен

Проводки:
  - Дт `5110` = `amount`
  - Кт `$loanAccountCode` = `amount`

### `LONG_TERM_LOAN_REPAYMENT`

**Погашение долгосрочного займа (Расход)**

- Режим: `BANK_AUTO`
- закрывает Open Item на `$loanAccountCode`; контрагент не обязателен

Проводки:
  - Дт `$loanAccountCode` = `amount`
  - Кт `5110` = `amount`

### `MARKETPLACE_INCOME`

**Поступление от маркетплейса (Доход)**

- Режим: `BANK_AUTO`
- открывает Open Item на `4890`; требует контрагента

Проводки:
  - Дт `5110` = `amount`
  - Кт `4890` = `amount`

### `MARKETPLACE_PROMOTION`

**Продвижение на маркетплейсе (Расход)**

- Режим: `BANK_AUTO`
- требует контрагента

Проводки:
  - Дт `9410` = `amount`
  - Кт `5110` = `amount`

### `MEDICAL_LICENSE`

**Медицинская лицензия (Расход)**

- Режим: `BANK_AUTO`
- требует контрагента

Проводки:
  - Дт `9430` = `amount`
  - Кт `5110` = `amount`

### `MEMBERSHIP_FEE`

**Членский взнос в организацию (Расход)**

- Режим: `BANK_AUTO`
- требует контрагента

Проводки:
  - Дт `9430` = `amount`
  - Кт `5110` = `amount`

### `MOBILE_COMMUNICATION`

**Мобильная связь сотрудников (Расход)**

- Режим: `BANK_AUTO`
- контрагент не обязателен

Проводки:
  - Дт `9420` = `amount`
  - Кт `5110` = `amount`

### `MUSIC_LICENSE`

**Лицензия на публичное воспроизведение музыки (Расход)**

- Режим: `BANK_AUTO`
- требует контрагента

Проводки:
  - Дт `9430` = `amount`
  - Кт `5110` = `amount`

### `OTHER_EXPENSE`

**Прочий расход (Расход)**

- Режим: `BANK_AUTO`
- контрагент не обязателен

Проводки:
  - Дт `9430` = `amount`
  - Кт `5110` = `amount`

### `PACKAGING_COST`

**Упаковка и тара (Расход)**

- Режим: `BANK_AUTO`
- контрагент не обязателен

Проводки:
  - Дт `9410` = `amount`
  - Кт `5110` = `amount`

### `PARTNER_LOAN_ISSUED`

**Займ выдан другой компании (Расход)**

- Режим: `BANK_AUTO`
- открывает Open Item на `4890`; требует контрагента

Проводки:
  - Дт `4890` = `amount`
  - Кт `5110` = `amount`

### `PARTNER_LOAN_RECEIVED`

**Займ от другой компании получен (Доход)**

- Режим: `BANK_AUTO`
- открывает Open Item на `6820`; требует контрагента

Проводки:
  - Дт `5110` = `amount`
  - Кт `6820` = `amount`

### `PARTNER_LOAN_REPAID`

**Возврат займа другой компании (Расход)**

- Режим: `BANK_AUTO`
- закрывает Open Item на `6820`; требует контрагента

Проводки:
  - Дт `6820` = `amount`
  - Кт `5110` = `amount`

### `PARTNER_LOAN_RETURNED`

**Другая компания вернула займ (Доход)**

- Режим: `BANK_AUTO`
- закрывает Open Item на `4890`; требует контрагента

Проводки:
  - Дт `5110` = `amount`
  - Кт `4890` = `amount`

### `PENALTY_INCOME`

**Неустойка от партнёра получена (Доход)**

- Режим: `BANK_AUTO`
- требует контрагента

Проводки:
  - Дт `5110` = `amount`
  - Кт `9330` = `amount`

### `PERMITS_APPROVALS`

**Разрешения и согласования (Расход)**

- Режим: `BANK_AUTO`
- контрагент не обязателен

Проводки:
  - Дт `9430` = `amount`
  - Кт `5110` = `amount`

### `PREPAID_RENT_PAYMENT`

**Предоплата за аренду (Расход)**

- Режим: `BANK_AUTO`
- контрагент не обязателен

Проводки:
  - Дт `3110` = `amount`
  - Кт `5110` = `amount`

### `PRODUCT_CERTIFICATION`

**Сертификация товара/продукции (Расход)**

- Режим: `BANK_AUTO`
- требует контрагента

Проводки:
  - Дт `9430` = `amount`
  - Кт `5110` = `amount`

### `PROFESSIONAL_SERVICES`

**Профессиональные услуги — юрист/аудит/консультант (Расход)**

- Режим: `BANK_AUTO`
- требует контрагента

Проводки:
  - Дт `9420` = `amount`
  - Кт `5110` = `amount`

### `RAW_MATERIALS_PURCHASE`

**Прямая закупка сырья (Расход)**

- Режим: `BANK_AUTO`
- требует контрагента

Проводки:
  - Дт `1010` = `amount`
  - Кт `5110` = `amount`

### `REFERRAL_COMMISSION`

**Реферальная комиссия партнёру (Расход)**

- Режим: `BANK_AUTO`
- требует контрагента

Проводки:
  - Дт `9410` = `amount`
  - Кт `5110` = `amount`

### `REFUND`

**Возврат денег клиенту (Расход)**

- Режим: `BANK_AUTO`
- требует контрагента

Проводки:
  - Дт `9040` = `amount`
  - Кт `5110` = `amount`

### `RENT`

**Аренда — прямая оплата (Расход)**

- Режим: `BANK_AUTO`
- требует контрагента

Проводки:
  - Дт `9420` = `amount`
  - Кт `5110` = `amount`

### `RENT_PAYMENT`

**Аренда — оплата по начислению (Расход)**

- Режим: `BANK_AUTO`
- требует контрагента

Проводки:
  - Дт `6010` = `amount`
  - Кт `5110` = `amount`

### `RENTAL_INCOME_RECEIVED`

**Доход от сдачи в аренду (Доход)**

- Режим: `BANK_AUTO`
- контрагент не обязателен

Проводки:
  - Дт `5110` = `amount`
  - Кт `9350` = `amount`

### `REVENUE_COLLECTION`

**Оплата от клиента — постоплата (Доход)**

- Режим: `BANK_AUTO`
- закрывает Open Item на `4010`; требует контрагента

Проводки:
  - Дт `5110` = `amount`
  - Кт `4010` = `amount`

### `ROAD_TOLLS`

**Платные дороги и парковки (Расход)**

- Режим: `BANK_AUTO`
- контрагент не обязателен

Проводки:
  - Дт `9430` = `amount`
  - Кт `5110` = `amount`

### `ROYALTY_INCOME`

**Роялти получены (Доход)**

- Режим: `BANK_AUTO`
- требует контрагента

Проводки:
  - Дт `5110` = `amount`
  - Кт `9510` = `amount`

### `ROYALTY_PAYMENT`

**Выплата роялти (Расход)**

- Режим: `BANK_AUTO`
- требует контрагента

Проводки:
  - Дт `9430` = `amount`
  - Кт `5110` = `amount`

### `SALARY`

**Выплата зарплаты сотрудникам (Расход)**

- Режим: `BANK_AUTO`
- контрагент не обязателен

Проводки:
  - Дт `6710` = `amount`
  - Кт `5110` = `amount`

### `SALARY_ADVANCE`

**Аванс по зарплате (Расход)**

- Режим: `BANK_AUTO`
- контрагент не обязателен

Проводки:
  - Дт `4210` = `amount`
  - Кт `5110` = `amount`

### `SALARY_DEPOSIT_PAYMENT`

**Выплата задержанной зарплаты (Расход)**

- Режим: `BANK_AUTO`
- закрывает Open Item на `6720`; контрагент не обязателен

Проводки:
  - Дт `6720` = `amount`
  - Кт `5110` = `amount`

### `SECURITY_SERVICES`

**Охрана / ЧОП (Расход)**

- Режим: `BANK_AUTO`
- требует контрагента

Проводки:
  - Дт `9420` = `amount`
  - Кт `5110` = `amount`

### `SELF_EMPLOYED_PAYMENT`

**Оплата самозанятому (Расход)**

- Режим: `BANK_AUTO`
- требует контрагента

Проводки:
  - Дт `9420` = `amount`
  - Кт `5110` = `amount`

### `SOCIAL_TAX_PAYMENT`

**Социальный налог с ФОТ (Расход)**

- Режим: `BANK_AUTO`
- контрагент не обязателен

Проводки:
  - Дт `6520` = `amount`
  - Кт `5110` = `amount`

### `STATE_DUTY`

**Оплата госпошлины (Расход)**

- Режим: `BANK_AUTO`
- контрагент не обязателен

Проводки:
  - Дт `9430` = `amount`
  - Кт `5110` = `amount`

### `SUBSCRIPTION`

**Подписка/лицензия (Расход)**

- Режим: `BANK_AUTO`
- требует контрагента

Проводки:
  - Дт `9420` = `amount` — при условии `subscriptionPeriod == 'monthly'`
  - Дт `3120` = `amount` — при условии `subscriptionPeriod != 'monthly'`
  - Кт `5110` = `amount`

### `SUBSIDY_RECEIVED`

**Субсидия получена (Доход)**

- Режим: `BANK_AUTO`
- закрывает Open Item на `4890`; контрагент не обязателен

Проводки:
  - Дт `5110` = `amount`
  - Кт `4890` = `amount`

### `SUPPLIER_PAYMENT_GOODS`

**Оплата поставщику за товары (Расход)**

- Режим: `BANK_AUTO`
- закрывает Open Item на `6010`; требует контрагента

Проводки:
  - Дт `6010` = `amount`
  - Кт `5110` = `amount`

### `SUPPLIER_PAYMENT_OTHER`

**Оплата поставщику — прочее (Расход)**

- Режим: `BANK_AUTO`
- закрывает Open Item на `6010`; требует контрагента

Проводки:
  - Дт `6010` = `amount`
  - Кт `5110` = `amount`

### `SUPPLIER_PAYMENT_SERVICES`

**Оплата поставщику за услуги (Расход)**

- Режим: `BANK_AUTO`
- закрывает Open Item на `6010`; требует контрагента

Проводки:
  - Дт `6010` = `amount`
  - Кт `5110` = `amount`

### `SUPPLIER_PAYMENT_VAT`

**Оплата поставщику — НДС (Расход)**

- Режим: `BANK_AUTO`
- закрывает Open Item на `6010`; требует контрагента

Проводки:
  - Дт `6010` = `amount`
  - Кт `5110` = `amount`

### `SUPPLIER_REFUND`

**Возврат денег от поставщика (Доход)**

- Режим: `BANK_AUTO`
- закрывает Open Item на `4310`; требует контрагента

Проводки:
  - Дт `5110` = `amount`
  - Кт `4310` = `amount`

### `TARGET_RECEIPTS`

**Целевые взносы получены (Доход)**

- Режим: `BANK_AUTO`
- контрагент не обязателен

Проводки:
  - Дт `5110` = `amount`
  - Кт `8830` = `amount` — при условии `receiptType == 'membership'`
  - Кт `8890` = `amount` — при условии `receiptType != 'membership'`

### `TAX_PAYMENT`

**Оплата налога (Расход)**

- Режим: `BANK_AUTO`
- контрагент не обязателен

Проводки:
  - Дт `6410` = `amount`
  - Кт `5110` = `amount`

### `TAX_REFUND_OTHER`

**Возврат переплаты налога — не НДС (Доход)**

- Режим: `BANK_AUTO`
- контрагент не обязателен

Проводки:
  - Дт `5110` = `amount`
  - Кт `6410` = `amount`

### `TAXI_BUSINESS`

**Такси/транспорт для бизнеса (Расход)**

- Режим: `BANK_AUTO`
- контрагент не обязателен

Проводки:
  - Дт `9420` = `amount`
  - Кт `5110` = `amount`

### `TENANT_UTILITIES_RECEIVED`

**Коммунальные от арендатора — возмещение (Доход)**

- Режим: `BANK_AUTO`
- требует контрагента

Проводки:
  - Дт `5110` = `amount`
  - Кт `6310` = `amount`

### `TRANSLATION_SERVICES`

**Перевод документов (Расход)**

- Режим: `BANK_AUTO`
- требует контрагента

Проводки:
  - Дт `9420` = `amount`
  - Кт `5110` = `amount`

### `UTILITY_PAYMENT`

**Коммунальные услуги (Расход)**

- Режим: `BANK_AUTO`
- требует контрагента

Проводки:
  - Дт `9420` = `amount`
  - Кт `5110` = `amount`

### `VAT_REFUND_FROM_BUDGET`

**Возврат НДС из бюджета (Доход)**

- Режим: `BANK_AUTO`
- контрагент не обязателен

Проводки:
  - Дт `5110` = `amount`
  - Кт `4410` = `amount`

### `WARRANTY_REPAIR`

**Гарантийный ремонт клиенту (Расход)**

- Режим: `BANK_AUTO`
- требует контрагента

Проводки:
  - Дт `9430` = `amount`
  - Кт `5110` = `amount`

## Только ручной ввод (74)

### `ACCOUNTABLE_GENERAL_WRITEOFF`

**Списание подотчётных — офис**

- Режим: `MANUAL_ONLY`
- закрывает Open Item на `4230`; требует контрагента

Проводки:
  - Дт `9430` = `amount`
  - Кт `4230` = `amount`

### `ACCOUNTABLE_WRITEOFF`

**Списание подотчётных — командировка**

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

**Реклассификация довзноса в УК**

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

**Начисление амортизации ОС**

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

**Чрезвычайный доход/расход**

- Режим: `MANUAL_ONLY`
- контрагент не обязателен

Проводки:
  - Дт `$accountCode` = `gainAmount` — при условии `gainAmount > 0`
  - Кт `9710` = `gainAmount` — при условии `gainAmount > 0`
  - Дт `9720` = `lossAmount` — при условии `lossAmount > 0`
  - Кт `$accountCode` = `lossAmount` — при условии `lossAmount > 0`

### `FINANCE_LEASE_ASSET_RECEIVED`

**ОС получено в лизинг**

- Режим: `MANUAL_ONLY`
- открывает Open Item на `7910`; требует контрагента

Проводки:
  - Дт `0310` = `amount`
  - Кт `7910` = `amount`

### `FINANCE_LEASE_DEPRECIATION`

**Амортизация лизингового ОС**

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

**Ввод ОС в эксплуатацию**

- Режим: `MANUAL_ONLY`
- контрагент не обязателен

Проводки:
  - Дт `$assetAccountCode` = `acquisitionCost`
  - Кт `0820` = `acquisitionCost`

### `FIXED_ASSET_DISPOSAL`

**Выбытие (списание) ОС**

- Режим: `MANUAL_ONLY`
- контрагент не обязателен

Проводки:
  - Дт `0200` = `accumulatedDepreciation`
  - Дт `9210` = `acquisitionCost - accumulatedDepreciation` — при условии `acquisitionCost > accumulatedDepreciation`
  - Кт `$assetAccountCode` = `acquisitionCost`

### `FIXED_ASSET_DISPOSAL_RESULT`

**Итог от выбытия ОС**

- Режим: `MANUAL_ONLY`
- контрагент не обязателен

Проводки:
  - Дт `9210` = `profit` — при условии `profit > 0`
  - Кт `9310` = `profit` — при условии `profit > 0`
  - Дт `9320` = `loss` — при условии `loss > 0`
  - Кт `9210` = `loss` — при условии `loss > 0`

### `FIXED_ASSET_REVALUATION`

**Переоценка ОС**

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

**Оприходование остатков от ОС**

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

**Товар в пути оприходован на склад**

- Режим: `MANUAL_ONLY`
- закрывает Open Item на `2970`; контрагент не обязателен

Проводки:
  - Дт `2910` = `amount`
  - Кт `2970` = `amount`

### `GOODS_RECEIVED`

**Поступление товаров — в долг**

- Режим: `MANUAL_ONLY`
- открывает Open Item на `6010`; требует контрагента

Проводки:
  - Дт `2910` = `amount - vatAmount`
  - Дт `4410` = `vatAmount` — при условии `vatAmount > 0`
  - Кт `6010` = `amount`

### `GOODS_RECEIVED_PREPAID`

**Поступление товаров — в счёт аванса**

- Режим: `MANUAL_ONLY`
- закрывает Open Item на `4310`; требует контрагента

Проводки:
  - Дт `2910` = `amount - vatAmount`
  - Дт `4410` = `vatAmount` — при условии `vatAmount > 0`
  - Кт `4310` = `amount`

### `GOODS_RETURNED_FROM_CUSTOMER`

**Клиент вернул товар**

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

**Грант признан (документы получены)**

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

**Ввод НМА в эксплуатацию**

- Режим: `MANUAL_ONLY`
- контрагент не обязателен

Проводки:
  - Дт `$assetAccountCode` = `acquisitionCost`
  - Кт `0830` = `acquisitionCost`

### `INVENTORY_SHORTAGE`

**Недостача при инвентаризации**

- Режим: `MANUAL_ONLY`
- контрагент не обязателен

Проводки:
  - Дт `5910` = `amount`
  - Кт `$assetAccountCode` = `amount`

### `INVENTORY_SHORTAGE_RESOLUTION`

**Списание недостачи**

- Режим: `MANUAL_ONLY`
- контрагент не обязателен

Проводки:
  - Дт `4730` = `amount` — при условии `hasCulprit`
  - Дт `9430` = `amount` — при условии `!hasCulprit`
  - Кт `5910` = `amount`

### `INVENTORY_SURPLUS`

**Излишки при инвентаризации**

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

**ЭСФ подтверждён — постоплата**

- Режим: `MANUAL_ONLY`
- открывает Open Item на `4010`; требует контрагента

Проводки:
  - Дт `4010` = `amount`
  - Кт `9030` = `amount - vatAmount`
  - Кт `6410` = `vatAmount` — при условии `vatAmount > 0`

### `INVOICE_CONFIRMED_PREPAID`

**ЭСФ подтверждён — зачёт аванса**

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

**Перевод долга в краткосрочный**

- Режим: `MANUAL_ONLY`
- контрагент не обязателен

Проводки:
  - Дт `7810` = `amount`
  - Кт `6950` = `amount`

### `MARKETPLACE_REVENUE`

**Выручка маркетплейса (с комиссией)**

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

**Списание предоплаты аренды по периодам**

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

### `PROFIT_TAX_REVERSAL`

**Сторно налога на прибыль (уменьшение нарастающим итогом)**

- Режим: `MANUAL_ONLY`
- контрагент не обязателен

Проводки:
  - Дт `6410` = `taxAmount`
  - Кт `9810` = `taxAmount`

### `PROVISION_FOR_DOUBTFUL_DEBTS`

**Резерв по сомнительным долгам**

- Режим: `MANUAL_ONLY`
- контрагент не обязателен

Проводки:
  - Дт `9430` = `amount`
  - Кт `4910` = `amount`

### `PROVISION_FUTURE_EXPENSES`

**Резерв предстоящих расходов**

- Режим: `MANUAL_ONLY`
- контрагент не обязателен

Проводки:
  - Дт `$expenseAccountCode` = `amount`
  - Кт `8910` = `amount`

### `PROVISION_FUTURE_EXPENSES_USE`

**Использование резерва расходов**

- Режим: `MANUAL_ONLY`
- контрагент не обязателен

Проводки:
  - Дт `8910` = `amount`
  - Кт `$targetAccountCode` = `amount`

### `PROVISION_UNUSED_TO_INCOME`

**Восстановление резерва в доход**

- Режим: `MANUAL_ONLY`
- контрагент не обязателен

Проводки:
  - Дт `8910` = `amount`
  - Кт `9390` = `amount`

### `RENT_ACCRUAL`

**Начисление аренды (без оплаты)**

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

**Продажа с документами (без НДС)**

- Режим: `MANUAL_ONLY`
- требует контрагента

Проводки:
  - Дт `5110` = `amount`
  - Кт `9030` = `amount`

### `REVENUE_VAT`

**Продажа с документами (с НДС)**

- Режим: `MANUAL_ONLY`
- требует контрагента

Проводки:
  - Дт `5110` = `amount`
  - Кт `9030` = `amount / 1.12`
  - Кт `6410` = `amount - (amount / 1.12)`

### `SALARY_ACCRUAL`

**Начисление зарплаты и налогов ФОТ**

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

**Получение услуги — в долг**

- Режим: `MANUAL_ONLY`
- открывает Open Item на `6010`; требует контрагента

Проводки:
  - Дт `9420` = `amount - vatAmount`
  - Дт `4410` = `vatAmount` — при условии `vatAmount > 0`
  - Кт `6010` = `amount`

### `SERVICE_RECEIVED_PREPAID`

**Получение услуги — в счёт аванса**

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

**Субсидия признана (документы)**

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


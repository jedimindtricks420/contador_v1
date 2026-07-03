# Модуль F — Дашборды, P&L, Cashflow

**Статус:** ✅ Реализован  
**Файлы:** `src/app/dashboard/`, `src/app/pnl/`, `src/app/cashflow/`, `src/app/accounts/`  
**Последнее обновление:** 2026-07-02

---

## F1. Главный дашборд (`/v2/dashboard`)

**Компонент:** `DashboardClient.tsx`  
**API:** `GET /api/dashboard?periodId=`

### Логика выбора периода

Если `periodId` указан в параметрах — загружает указанный период. Иначе — текущий месяц.

**Защита от undefined:** если период не найден, транзакционные статистики не запрашиваются:
```typescript
const [totalImported, needsClarification, confirmed] = period
  ? await Promise.all([...])
  : [0, 0, 0];
```

### KPI блоки

| Блок | Источник | Формула |
|------|---------|---------|
| Выручка | JournalEntry счета 90xx, 93xx, 95xx | Кт − Дт за период |
| Расходы | JournalEntry 91xx, 94xx, 96xx, 98xx | Дт − Кт за период |
| Чистая прибыль | Выручка − Расходы | |
| Остаток банк. счетов | BankAccount.lastBalance (UZS + USD) | Сумма всех счетов |
| Долг по зарплате | Кт − Дт счёта 6710 | raw SQL по всей истории |
| Налоги к уплате | TaxCalendarEvent.estimatedAmount (PENDING, текущий период) | |

**Примечание:** Документы типа `PERIOD_CLOSING` исключаются из расчёта выручки/расходов, чтобы не задваивать обороты закрытого периода.

### Блоки дашборда

- **Налоговый календарь** — ближайшие 5 сроков уплаты налогов из TaxCalendarEvent (в пределах 30 дней)
- **Открытые позиции риска** — OpenItem со статусом RISK (до 5 позиций)
- **Чеклист периода** — импортирована ли выписка, классифицированы ли транзакции, подтверждены начисления, выполнена Soliq-сверка, закрыт месяц
- **Транзакции к классификации** — количество NEEDS_CLARIFICATION
- **KPI** — баланс банка, доходы, расходы, налоги к уплате, долг по зарплате

### Ответ API

```typescript
{
  period: { id, year, month, status } | null,
  allPeriods: Period[],
  monthStatus: "awaiting_data" | "awaiting_action" | "closed",
  stats: { totalImported, needsClarification, confirmed, totalBalance, revenue, expenses, profit, riskItems },
  bankAccounts: BankAccount[],
  upcomingTax: TaxCalendarEvent[],
  importStatus: { bankTransactions, soliqMatched },
  closingChecklist: [{ step, done, label }],
  kpi: { totalBalance, income, expense, taxesOwed, salaryDebt },
  riskOpenItems: [{ id, counterpartyName, accountCode, amount, dateOpened, overdueDays }]
}
```

---

## F2. P&L (`/v2/pnl`)

**Компонент:** `PnLClient.tsx`  
**API:** `GET /api/pnl?from=YYYY-MM-DD&to=YYYY-MM-DD`

### Формула P&L (строки 010–270)

```
Выручка (стр.010) = Кт(9010 + 9020 + 9030) − Дт(9040 + 9050)
COGS (стр.020)    = Дт(9110 + 9120 + 9130)
  # 9130 — себестоимость услуг, ПРОДАВАЕМЫХ клиентам. Покупка услуг у поставщика
  # (SERVICE_RECEIVED/_PREPAID) больше не пишет на 9130 — она идёт на 9420 (стр.060),
  # т.к. это административный расход, а не себестоимость.
Расходы по реализации (стр.050) = Дт(9410)
Административные расходы (стр.060) = Дт(9420)
Прочие операционные расходы (стр.070) = Дт(9430)
Прочие доходы (стр.090) = Кт(9310–9390)
Доходы фин. деятельности (стр.110–160): 9520, 9530, 9540, 9550, ...
Расходы фин. деятельности (стр.170–210): 9610, 9620, 9630, ...
Налог (стр.250) = Дт(9810) → fallback TaxCalendarEvent
Чистая прибыль (стр.270) = 240 − 250 − 260
```

Подробные строки — см. Модуль G.

---

## F3. Cashflow (`/v2/cashflow`)

**Компонент:** `CashFlowClient.tsx`  
**API:** `GET /api/cashflow?from=YYYY-MM-DD&to=YYYY-MM-DD&accountId=`

Движение денег по банковским счетам (5110, 5210, 5710) за период с разбивкой по категориям.

### Определение наличия смешанных валют

`hasMixedCurrencies` определяется по фактическим строкам `BankAccount`:
```typescript
const orgBankAccounts = await prisma.bankAccount.findMany({ where: { orgId } });
const hasMixedCurrencies = accountId === "ALL"
  ? orgBankAccounts.some(a => a.currency !== "USD") && orgBankAccounts.some(a => a.currency === "USD")
  : accountCodes.some(c => BANK_UZS_CODES.includes(c)) && accountCodes.some(c => BANK_USD_CODES.includes(c));
```
(Запрос к модели `BankAccount`, не к кодам счетов напрямую.)

### Категории притоков

| Код | Название |
|-----|---------|
| `REVENUE` | Выручка от продаж |
| `ADVANCE_RECEIVED` | Авансы полученные |
| `FOUNDER_LOAN` | Займы от учредителя |
| `CAPITAL_CONTRIBUTION` | Пополнение уставного капитала |
| `BANK_LOAN` | Банковские кредиты |
| `FX_GAIN` | Положительные курсовые разницы |
| `OTHER_INFLOW` | Прочие поступления |

### Категории оттоков

| Код | Название | Типы документов |
|-----|---------|-----------------|
| `SUPPLIER_PAYMENT` | Закупка товаров/услуг | `SUPPLIER_PAYMENT`, `_GOODS`, `_SERVICES`, `_OTHER`, `_VAT` |
| `ADVANCE_PAID` | Авансы выданные | `ADVANCE_PAID` |
| `SALARY` | Выплата зарплаты (нетто) | `SALARY` |
| `TAXES` | Налоги в бюджет (TAX_PAYMENT) | `TAX_PAYMENT` |
| `INPS` | ИНПС (INPS_PAYMENT) | `INPS_PAYMENT` |
| `SOCIAL_TAX` | Соцналог (SOCIAL_TAX_PAYMENT) | `SOCIAL_TAX_PAYMENT` |
| `RENT` | Аренда | `RENT` |
| `ADVERTISING` | Реклама | `ADVERTISING` |
| `ACCOUNTABLE` | Подотчётные суммы | `ACCOUNTABLE` |
| `DEPOSIT` | Гарантийный депозит | `DEPOSIT` |
| `CAPEX` | Капитальные расходы (ОС/НМА) | `FIXED_ASSET_PURCHASE`, `INTANGIBLE_ASSET_PURCHASE` |
| `LOAN_REPAYMENT` | Погашение кредитов/займов | `FOUNDER_LOAN_REPAYMENT`, `BANK_LOAN_REPAYMENT` |
| `FX_LOSS` | Отрицательные курсовые разницы | `FX_DIFFERENCE` (кредитовая сторона) |
| `OTHER_OUTFLOW` | Прочие расходы | всё остальное (в т.ч. `EMPLOYEE_LOAN` — балансовая операция) |

Возвраты ранее выплаченных сумм — `ACCOUNTABLE_RETURN`, `ACCOUNTABLE_GENERAL_RETURN`,
`DEPOSIT_RETURN`, `SUPPLIER_REFUND`, `EMPLOYEE_LOAN_REPAYMENT` — попадают в `OTHER_INFLOW`
(балансовые операции, не выделены в отдельную категорию притока).

`INTERNAL_TRANSFER` и `INTERNAL_TRANSFER_RECEIVED` полностью исключены из отчёта (`continue`
до попадания в категории) — обе стороны внутреннего перевода лежат в отслеживаемом пуле
счетов (5110/5210/5710), поэтому включение исказило бы суммы категорий нулевым по факту
движением денег.

### Ответ API

```typescript
{
  months: string[],         // ['2026-01', '2026-02', ...]
  income: [{ categoryCode, categoryName, amounts: number[], total }],
  expense: [{ categoryCode, categoryName, amounts: number[], total }],
  netFlow: number[],
  openingBalance: number,
  closingBalance: number,
  hasMixedCurrencies: boolean,
  openingBalanceUZS: number,
  closingBalanceUZS: number,
  openingBalanceUSD: number,
  closingBalanceUSD: number
}
```

---

## F4. Банковские счета (`/v2/accounts`)

**Компонент:** `AccountsClient.tsx`  
**API:** `GET/POST/PUT/DELETE /api/bank-accounts`

CRUD банковских счетов организации.

- Создание: название, валюта (UZS/USD), номер счёта, остаток
- Редактирование остатка: `min="0.01"` (проверка на уровне формы)
- Удаление: 409 если есть привязанные транзакции
- Ошибки: инлайн в форме и в модале удаления

---

*Последнее обновление: 2026-07-02*

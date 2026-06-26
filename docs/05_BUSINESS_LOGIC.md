# 05 — Бизнес-логика

**Документ:** Business Logic Reference  
**Версия:** 2.1  
**Дата:** 2026-06-26

---

## 1. Движок проводок (Posting Engine)

**Файл:** `v2/src/lib/posting/postingEngine.ts`

### 1.1 postDocument(documentId, tx?, userId?)

Алгоритм из 10 шагов:

1. Загрузить `Document` + `DocumentType` (с `postingTemplate`)
2. Проверить что период **не CLOSED** (lockDate = null) → 423 если закрыт
3. Загрузить `Organization` (для `isVatPayer`, `taxRegime`, `turnoverTaxRate`)
4. Найти или создать `Counterparty` по `payload.counterpartyInn` / `payload.counterpartyHint`
5. Собрать `evalPayload = { ...payload, isVatPayer, vatRate: 12 }`
6. Обработать строки шаблона:
   - Вычислить `condition` (если 0 → пропустить строку)
   - Найти `Account` по `line.accountCode` (ошибка если не найден)
   - Вычислить `amount = evaluate(line.expression, evalPayload)`
   - Пропустить строки с нулевой суммой
7. Валидация: `Σ debit === Σ credit` → иначе 422
8. Массовая вставка `JournalEntry[]` в БД
9. Если `template.opensItem === true` → создать `OpenItem` с `riskDeadline`
10. Записать `AuditLog` (action: `POST_DOCUMENT`)

### 1.2 voidDocument(documentId, tx?, userId?)

1. Проверить период (не CLOSED)
2. `Document.status = VOIDED`
3. Удалить `JournalEntry` по `documentId`
4. Закрыть связанные `OpenItem` (OPEN → CLOSED)
5. Записать `AuditLog`

### 1.3 repostDocument(documentId, newTypeId)

`voidDocument()` → обновить `Document.typeId` → `postDocument()`

---

## 2. Шаблоны проводок (PostingTemplate)

### Формат

```typescript
interface PostingLine {
  accountCode: string          // Код счёта НСБУ
  side: "debit" | "credit"
  expression: string           // Математическое выражение (Decimal.js)
  condition?: string           // Условие (0 = пропустить строку)
  subcontoType?: "counterparty" | "contract"
}

interface PostingTemplate {
  lines: PostingLine[]
  opensItem?: boolean          // Создавать ли OpenItem
  itemAccountCode?: string     // Счёт для OpenItem
}
```

### Вычислитель выражений (expressionEval.ts)

Поддерживаемые операции: `+`, `-`, `*`, `/`, скобки.  
Переменные подставляются из `evalPayload`.

**Доступные переменные:**
- `amount` — сумма транзакции
- `vatRate` — ставка НДС (12)
- `isVatPayer` — 1 или 0
- `salaryAmount`, `depreciationAmount`, `rentAmount` — для начислений
- `exchangeRate`, `difference` — для курсовых разниц
- `taxAmount` — для налоговых документов (TURNOVER_TAX_ACCRUAL, PROFIT_TAX_ACCRUAL)

---

## 3. Финализация периода (finalizePeriod)

**Файл:** `v2/src/lib/closing.ts`  
**Вызов:** `POST /api/closing/[periodId]/finalize`

### Блок A — Загрузка данных

Загружает `Period`, `Organization`, вычисляет `periodStart`, `accrualDate` (28-е число месяца), `nextMonth20th`.

### Блок B — Применение начислений

Создаёт документы из `closingData.accruals`:

| Поле | Тип документа | Проводка |
|------|-------------|---------|
| salaryAmount > 0 | SALARY_ACCRUAL | Дт 9420 → Кт 6710 |
| | SALARY_OFFSET | Дт 6710 → Кт 6410 (НДФЛ 12%) + Кт 6520 (соцналог 12%) |
| depreciationAmount > 0 | DEPRECIATION_ACCRUAL | Дт 9430 → Кт 0200 |
| rentAmount > 0 | ACCRUAL | Дт 9420 → Кт 6010 |

### Блок C — Курсовые разницы

Если `closingData.fxDiff.difference ≠ 0` → создаёт `FX_DIFFERENCE`.

### Блок D — Расчёт выручки и прибыли

Агрегирует JournalEntry по 9xxx-счетам за период:
- `totalRevenue` = Кт(9010+9020+9030) − Дт(9040+9050)
- `totalCOGS`, `totalExpense`, `otherIncome`, `totalFxIncome`, `totalFxExpense`
- `netProfit` = выручка + прочие доходы − расходы (предналоговая прибыль)

### Блок E — Начисление налогов

**Режим VAT (isVatPayer = true):**
- Если netProfit > 0 → `PROFIT_TAX_ACCRUAL`:
  - Дт 9810 → Кт 6410 (15% от netProfit)

**Режим TURNOVER_TAX:**
- Если totalRevenue > 0 → `TURNOVER_TAX_ACCRUAL`:
  - Дт 9810 → Кт 6410 (ставка = `org.turnoverTaxRate`, по умолчанию 4%)
  - Ставка берётся из `Organization.turnoverTaxRate` (настраивается в Settings)
  - Документ создаётся через `postDocument()` — соблюдается Σ Дт = Σ Кт

Оба режима добавляют TaxCalendarEvent со сроком `nextMonth20th`.

### Блок F — TaxCalendarEvent

Удаляет все `PENDING` события за период, создаёт новые из массива `taxes[]`.

### Блок G — upsertTaxCalendarEventsForPeriod

Актуализирует суммы в TaxCalendarEvent при повторном вызове.

### Блок H — Закрытие TRANSIT-счетов (PERIOD_CLOSING)

Для каждого TRANSIT-счёта с ненулевым сальдо создаёт обратные проводки через 9910:

```
Кредитовое сальдо (выручка 9010, 9020, 9030):
  Дт 9010 → Кт 9910  (переносим выручку)

Дебетовое сальдо (расходы 9110, 9420, 9810):
  Дт 9910 → Кт 9410  (переносим расходы)
```

Один документ `PERIOD_CLOSING` на весь период.

### Блок I — Блокировка периода

`Period.status = CLOSED`, `Period.lockDate = последний день месяца`.

---

## 4. Годовое закрытие (Year-End Close)

**Файл:** `v2/src/app/api/closing/year-end/route.ts`  
**Вызов:** `POST /api/closing/year-end` с `{ periodId }` (декабрь)

**Условия:** `period.month === 12`, `period.status === "CLOSED"`, нет дублирующего `YEAR_END_CLOSE`.

**Алгоритм:**
1. `net9910 = Σ(debit − credit)` по счёту 9910 за год
2. Если `net9910 === 0` → перенос не нужен
3. Создать документ `YEAR_END_CLOSE` (дата: 31 декабря)
4. Проводки:
   - Прибыль (`net9910 < 0`, кредитовый остаток): Дт 9910 → Кт 8710
   - Убыток (`net9910 > 0`, дебетовый остаток): Дт 8710 → Кт 9910
5. После: 9910 = 0, сальдо 8710 = накопленная нераспределённая прибыль

---

## 5. Формирование Формы №2 (P&L)

**Файл:** `v2/src/app/api/pnl/route.ts`

Строки берутся из оборотов JournalEntry за период, **исключая** `PERIOD_CLOSING` (чтобы не задваивать):

```sql
AND dt.code != 'PERIOD_CLOSING'
```

| Строка | Формула |
|--------|---------|
| 010 | Кт(9010+9020+9030) − Дт(9040+9050) |
| 020 | Дт(9110+9120+9130) |
| 030 | 010 − 020 |
| 040 | 050+060+070+080 |
| 050–080 | Дт(9410)...Дт(9440) |
| 090 | Кт(9310–9390) |
| 100 | 030 − 040 + 090 |
| 110 | 120+130+140+150+160 |
| 120–160 | Кт(9520), Кт(9530), Кт(9550), Кт(9540), Кт(9510+9560+9590) |
| 170 | 180+200+210 |
| 180–210 | Дт(9610), Дт(9620), Дт(9630+9690) |
| 220 | 100 + 110 − 170 |
| 230 | Кт(9710) − Дт(9720) |
| 240 | 220 ± 230 |
| 250 | Дт(9810) → fallback: TaxCalendarEvent если 0 |
| 260 | Дт(9820) |
| 270 | 240 − 250 − 260 |

---

## 6. Формирование Формы №1 (Баланс)

**Файл:** `v2/src/app/api/reports/balance/route.ts`

Кумулятивные остатки JournalEntry по дату `endDate` включительно (все типы документов, включая PERIOD_CLOSING):

```sql
AND d.date <= ${endDate}
```

Вспомогательные функции:
- `balDebit(...codes)` → `max(0, Σ_debit − Σ_credit)` — для активных счетов
- `balCredit(...codes)` → `max(0, Σ_credit − Σ_debit)` — для пассивных счетов

**Строка 450 (Нераспределённая прибыль):**
```typescript
const transitNet = Кт − Дт всех TRANSIT-счетов ≤ endDate;
const line450 = balCredit("8710").plus(transitNet);
// transitNet > 0 → незакрытая прибыль добавляется к капиталу
// transitNet < 0 → незакрытый убыток вычитается из капитала
// После YEAR_END_CLOSE: transitNet = 0
```

Контроль: `|line400 − line780| ≤ 1` → поле `balanceCheck`.

---

## 7. Типы документов

**Файл:** `v2/src/lib/ensureBaseData.ts`  
Создаются автоматически при старте приложения.

| Код | Название | Ключевая проводка |
|-----|---------|------------------|
| `SALARY` | Выплата зарплаты по ведомости | Дт 6710 → Кт 5110 |
| `SALARY_ACCRUAL` | Начисление заработной платы | Дт 9420 → Кт 6710 |
| `SALARY_OFFSET` | Удержание НДФЛ + соцналог | Дт 6710 → Кт 6410/6520 |
| `DEPRECIATION_ACCRUAL` | Начисление амортизации | Дт 9430 → Кт 0200 |
| `FX_DIFFERENCE` | Курсовая разница | Дт 5210 → Кт 9540 / Дт 9620 → Кт 5210 |
| `PROFIT_TAX_ACCRUAL` | Налог на прибыль 15% | Дт 9810 → Кт 6410 |
| `TURNOVER_TAX_ACCRUAL` | Налог с оборота (1–4%) | Дт 9810 → Кт 6410 |
| `PERIOD_CLOSING` | Закрытие TRANSIT-счетов | 9xxx ↔ 9910 |
| `YEAR_END_CLOSE` | Перенос финрезультата в прибыль | Дт 9910 → Кт 8710 |
| `REFUND` | Возврат покупателю | Дт 9040 → Кт 5110 |
| `SUPPLIER_REFUND` | Возврат от поставщика | Дт 5110 → Кт 4310 |
| `DIVIDEND_PAYMENT` | Выплата дивидендов учредителям | Дт 8710 → Кт 5110 |

Полный справочник — [DOCUMENT_TYPES.md](DOCUMENT_TYPES.md).

---

## 8. Открытые позиции (OpenItem)

**Файл:** `v2/src/lib/openItems.ts`

Создаются автоматически при проводке документов с `opensItem: true`.

**Дедлайны:**

| Счёт | Тип | Дедлайн |
|------|-----|---------|
| 4220 | Подотчёт (командировки) | 10 дней |
| 4310 | Аванс поставщику | 30 дней |
| 6310 | Аванс от покупателя | 30 дней |
| 6990 | Неидентифицированное поступление | 30 дней |
| 5830 | Краткосрочный депозит | 365 дней |
| 6820 | Займ учредителя | 365 дней |

Статус `RISK` устанавливается когда `riskDeadline < now()`.

---

## 9. Взаимоувязка Формы №1 и Формы №2 (§8)

Контрольное равенство согласно спецификации:

```
8710_конец = 8710_начало + line270(Ф2) − дивиденды
```

В системе это достигается после `YEAR_END_CLOSE`. До закрытия года:
- `8710` = прошлогодний остаток (не меняется в течение года)
- `line450` = `8710` + `transitNet` (включает текущий незакрытый финрезультат)

После `YEAR_END_CLOSE`:
- `9910 = 0`
- `8710` включает прибыль/убыток текущего года
- `transitNet = 0`

Равенство §8 рекомендуется проверять вручную при составлении годовой отчётности.

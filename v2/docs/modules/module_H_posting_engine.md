# Модуль H — Движок проводок (Posting Engine)

**Статус:** ✅ Реализован  
**Файлы:** `src/lib/posting/postingEngine.ts`, `src/lib/posting/expressionEval.ts`, `src/app/api/posting/`  
**Последнее обновление:** 2026-06-30

---

## Назначение

Атомарное преобразование `Document` в `JournalEntry`. Три операции: проведение, аннулирование, перепроведение.

---

## postDocument(documentId, tx?, userId?)

10-шаговый алгоритм:

1. Загрузить Document + DocumentType (с postingTemplate). Если документ VOIDED — вернуть `{ journalEntries: [] }`.
2. Проверить период: не CLOSED и `lockDate === null`.
3. Загрузить организацию (isVatPayer, vatRate).
4. Определить контрагента по `payload.counterpartyInn` (приоритет) или `payload.counterpartyHint`. Поиск по имени: **case-insensitive** (`mode: "insensitive"`). Если не найден — создать автоматически.
5. Собрать `evalPayload` = payload + isVatPayer + vatRate.
6. Обработать строки шаблона:
   - Если есть `condition` — вычислить; 0 → пропустить строку
   - Код счёта может быть динамическим (`"$fieldName"`) — берётся из payload
   - Найти Account по `code`; не найден → ошибка с кодом счёта
   - Вычислить сумму через `evaluate(expression, evalPayload)`; 0 → пропустить
7. Валидация: Σ Дт == Σ Кт (иначе ошибка с суммами).
8. Записать JournalEntry[] в БД.
9a. Если `template.opensItem === true` → создать OpenItem (буферный счёт `template.itemAccountCode`, дедлайн `getRiskDeadline()`).
9b. Если `template.closesOpenItemByAccount` задан → найти OPEN позицию (orgId + счёт + counterpartyId); предпочесть точное совпадение по сумме, иначе самую старую; закрыть (`status: "CLOSED"`).
    - Применяется для: **SUPPLIER_REFUND** (закрывает 4310), **ADVANCE_RETURN_SENT** (закрывает 6310)
10. Записать AuditLog (action: `POST_DOCUMENT`).

**После записи:**  
Вызывает `upsertTaxCalendarEventsForPeriod(periodId, orgId, tx)` — ошибки перехватываются молча (только console.error).

**Автозакрытие налоговых событий:**
- `TAX_PAYMENT` → DONE для VAT, PERSONAL_INCOME_TAX, PROFIT_TAX, TURNOVER_TAX (dueDate ≤ даты документа)
- `SOCIAL_TAX_PAYMENT` → DONE для SOCIAL_TAX
- `INPS_PAYMENT` → DONE для INPS

---

## voidDocument(documentId, tx?, userId?)

1. Загрузить документ, проверить период
2. Document.status = VOIDED
3. JournalEntry.deleteMany({ documentId })
4. Закрыть связанные OpenItem: updateMany({ openingDocumentId, status: "OPEN" }) → status: "CLOSED"
5. Записать AuditLog (action: `VOID_DOCUMENT`)

---

## repostDocument(documentId, newTypeId, tx?, userId?)

1. voidDocument() — аннулировать текущие проводки
2. Document.typeId = newTypeId, status = POSTED
3. postDocument() — новые проводки по новому шаблону

---

## PostingTemplate

```typescript
interface PostingTemplate {
  lines: PostingLine[]
  opensItem?: boolean
  itemAccountCode?: string
  closesOpenItemByAccount?: string   // авто-закрыть открытую позицию на этом счёте
}

interface PostingLine {
  accountCode: string         // код счёта или "$fieldName"
  side: "debit" | "credit"
  expression: string          // математическое выражение
  condition?: string          // 0 = пропустить строку
  subcontoType?: "counterparty" | "contract"
}
```

### Пример: REVENUE_VAT

```json
{
  "lines": [
    { "accountCode": "5110", "side": "debit",  "expression": "amount" },
    { "accountCode": "9030", "side": "credit", "expression": "amount / (1 + vatRate / 100)" },
    { "accountCode": "6410", "side": "credit", "expression": "amount - amount / (1 + vatRate / 100)" }
  ]
}
```

### Пример: SALARY_ACCRUAL

Брутто ФОТ: Дт 9420 → Кт 6710  
ИНПС 0.1%: Дт 6710 → Кт 6530  
НДФЛ в бюджет 11.9%: Дт 6710 → Кт 6410  
Соцналог 12%: Дт 9420 → Кт 6520

---

## Вычислитель выражений (expressionEval.ts)

```typescript
evaluate(expression: string, payload: Record<string, any>): Decimal
```

Операции: `+`, `-`, `*`, `/`, `(`, `)`. Переменные из evalPayload.

---

## API проводок

```
POST /api/posting/post
Body: { documentId }
→ { journalEntries, openItem? }

POST /api/posting/void
Body: { documentId }
→ { ok: true }

POST /api/posting/repost
Body: { documentId, newTypeId }
→ { journalEntries, openItem? }
```

**Защиты:** период CLOSED → 423; несбалансированный шаблон → 422; счёт не найден → 422.

---

## Коды DocumentType и их проводки

| code | Дебет | Кредит | Примечание |
|------|-------|--------|-----------|
| `REVENUE_VAT` | 5110 | 9030 + 6410 | НДС включён |
| `REVENUE_NO_VAT` | 5110 | 9010 | Без НДС |
| `SUPPLIER_PAYMENT` | 6010 | 5110 | Субконто контрагент |
| `SALARY` | 6710 | 5110 | Выплата зарплаты |
| `TAX_PAYMENT` | 6410 | 5110 | Закрывает VAT/НДФЛ/НнП/НсО события |
| `INPS_PAYMENT` | 6530 | 5110 | Закрывает INPS события |
| `SOCIAL_TAX_PAYMENT` | 6520 | 5110 | Закрывает SOCIAL_TAX события |
| `RENT` | 6010 | 5110 | Аренда (оплата) |
| `SALARY_ACCRUAL` | 9420 | 6710+6520+6530+6410 | ФОТ + налоги |
| `DEPRECIATION_ACCRUAL` | 9430 | 0200 | Амортизация ОС |
| `RENT_ACCRUAL` | 9420 | 6010 | Начисление аренды |
| `PROFIT_TAX_ACCRUAL` | 9810 | 6410 | Налог на прибыль 15% |
| `TURNOVER_TAX_ACCRUAL` | 9810 | 6410 | Налог с оборота |
| `FX_DIFFERENCE` | 5210 / 9620 | 9540 / 5210 | Счета 9540/9620 (FX_INCOME/FX_EXPENSE) |
| `ADVANCE_PAID` | 4310 | 5110 | opensItem: true, счёт 4310 |
| `ADVANCE_RECEIVED` | 5110 | 6310 | opensItem: true, счёт 6310 |
| `SUPPLIER_REFUND` | 5110 | 4310 | closesOpenItemByAccount: "4310" |
| `ADVANCE_RETURN_SENT` | 6310 | 5110 | closesOpenItemByAccount: "6310" |
| `PERIOD_CLOSING` | 9xxx/9910 | 9910/9xxx | Реформация баланса |
| `YEAR_END_CLOSE` | 9910/8710 | 8710/9910 | Перенос в 8710 |

---

## Налоговые константы (`constants.ts: TAX_RATES`)

```typescript
TAX_RATES = {
  NDFL: 0.12,         // НДФЛ суммарно
  NDFL_BUDGET: 0.119, // НДФЛ в бюджет 11.9%
  INPS: 0.001,        // ИНПС 0.1%
  SOCIAL_TAX: 0.12,   // Соцналог 12%
  VAT: 0.12,          // НДС 12%
  PROFIT_TAX: 0.15,   // Налог на прибыль 15%
  TURNOVER_TAX: 0.04, // Налог с оборота (дефолт; переопределяется org.turnoverTaxRate)
}
```

---

## Переменные в expressionEval

| Переменная | Описание |
|-----------|---------|
| `amount` | Сумма транзакции |
| `vatRate` | Ставка НДС (12 если плательщик, 0 иначе) |
| `salaryAmount` | Сумма ФОТ |
| `depreciationAmount` | Сумма амортизации |
| `rentAmount` | Сумма аренды |
| `fxDifference` | Сумма курсовой разницы |
| `taxAmount` | Сумма налога |

---

## prismaWithOrg(orgId)

**Файл:** `src/lib/prisma.ts` — Prisma Extension для автоматической изоляции по orgId.

| Операция | Действие |
|---------|---------|
| findMany / findFirst / count / updateMany / deleteMany | Добавляет `WHERE orgId` |
| create | Добавляет `data.orgId` |
| createMany | Добавляет `orgId` в каждый элемент |
| upsert | Добавляет `where.orgId` + `create.orgId` |
| findUnique / findUniqueOrThrow | Выполняет запрос, затем проверяет `result.orgId === orgId` |
| update / delete | Сначала `findFirst({ id, orgId })`; ошибка FORBIDDEN если не найдено |

---

*Последнее обновление: 2026-06-30*

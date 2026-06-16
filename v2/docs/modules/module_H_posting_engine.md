# Модуль H — Движок проводок (Posting Engine)

**Статус:** ✅ Реализован  
**Файлы:** `src/lib/posting/postingEngine.ts`, `src/lib/posting/expressionEval.ts`, `src/app/api/posting/`

---

## Назначение

Атомарное преобразование `Document` в `JournalEntry`. Три операции: проведение, аннулирование, перепроведение.

---

## Функции движка

### `postDocument(documentId, tx?, userId?)`

10-шаговый алгоритм:

1. Загрузить `Document` и его `DocumentType` (с `postingTemplate`)
2. Проверить существование периода и что он **не закрыт** (`CLOSED` / `lockDate ≠ null`)
3. Загрузить организацию (для `isVatPayer`, `taxRegime`)
4. Определить контрагента по `payload.counterpartyInn` или `payload.counterpartyHint`; если не найден — создать автоматически
5. Собрать `evalPayload` = payload + `isVatPayer` + `vatRate`
6. Обработать строки шаблона (`template.lines`):
   - Вычислить `condition` — если ноль, пропустить строку
   - Найти `Account` по `line.accountCode`; если не найден — кинуть ошибку
   - Вычислить `amount` через `evaluate(line.expression, evalPayload)`
   - Строки с нулевой суммой пропускаются
7. Валидация баланса: `Σ Дт == Σ Кт` — иначе ошибка
8. Записать `JournalEntry[]` в БД
9. Если `template.opensItem == true` → создать `OpenItem` с буферным счётом `template.itemAccountCode` и дедлайном риска
10. Записать `AuditLog` (action: `POST_DOCUMENT`)

### `voidDocument(documentId, tx?, userId?)`

1. Загрузить документ, проверить период
2. `Document.status = VOIDED`
3. `JournalEntry.deleteMany({ documentId })`
4. Закрыть связанные OpenItem: `updateMany({ openingDocumentId, status: "OPEN" }) → status: "CLOSED"`
5. Записать `AuditLog` (action: `VOID_DOCUMENT`)

### `repostDocument(documentId, newTypeId, tx?, userId?)`

1. `voidDocument()` — аннулировать текущие проводки
2. `Document.typeId = newTypeId`, `Document.status = POSTED`
3. `postDocument()` — генерация новых проводок по новому шаблону

---

## PostingTemplate

Хранится в `DocumentType.postingTemplate` (JSON в БД).

```typescript
interface PostingTemplate {
  lines: PostingLine[]
  opensItem?: boolean         // создавать ли OpenItem
  itemAccountCode?: string    // буферный счёт для OpenItem
}

interface PostingLine {
  accountCode: string         // код счёта из плана счетов
  side: "debit" | "credit"
  expression: string          // математическое выражение
  condition?: string          // если задано — строка вычисляется, 0 = пропустить
  subcontoType?: "counterparty" | "contract"
}
```

### Примеры шаблонов

**REVENUE_VAT (Поступление с НДС):**
```json
{
  "lines": [
    { "accountCode": "5110", "side": "debit",  "expression": "amount" },
    { "accountCode": "9030", "side": "credit", "expression": "amount / (1 + vatRate / 100)" },
    { "accountCode": "6410", "side": "credit", "expression": "amount - amount / (1 + vatRate / 100)" }
  ]
}
```

**SUPPLIER_PAYMENT (Оплата поставщику):**
```json
{
  "lines": [
    { "accountCode": "6010", "side": "debit",  "expression": "amount", "subcontoType": "counterparty" },
    { "accountCode": "5110", "side": "credit", "expression": "amount" }
  ]
}
```

**SALARY_ACCRUAL (Начисление ФОТ):**
```json
{
  "lines": [
    { "accountCode": "9420", "side": "debit",  "expression": "salaryAmount" },
    { "accountCode": "6710", "side": "credit", "expression": "salaryAmount" },
    { "accountCode": "6710", "side": "debit",  "expression": "salaryAmount * 0.12" },
    { "accountCode": "6410", "side": "credit", "expression": "salaryAmount * 0.12" },
    { "accountCode": "9420", "side": "debit",  "expression": "salaryAmount * 0.12" },
    { "accountCode": "6520", "side": "credit", "expression": "salaryAmount * 0.12" }
  ]
}
```

---

## Вычислитель выражений (expressionEval.ts)

```typescript
evaluate(expression: string, payload: Record<string, any>): Decimal
```

Поддерживаемые операции: `+`, `-`, `*`, `/`, `(`, `)`.  
Переменные подставляются из `payload` (например, `amount`, `vatRate`, `salaryAmount`).

---

## API проводок

```
POST /api/posting/post
Body: { documentId: string }
→ { journalEntries: JournalEntry[], openItem?: OpenItem }

POST /api/posting/void
Body: { documentId: string }
→ { ok: true }

POST /api/posting/repost
Body: { documentId: string, newTypeId: string }
→ { journalEntries: JournalEntry[], openItem?: OpenItem }
```

**Защиты:**
- Период CLOSED → 423 Locked
- Несбалансированный шаблон → 422 Unprocessable
- Счёт не найден → 422 с указанием кода счёта

---

## Коды DocumentType и их проводки

| code | Дебет | Кредит | Примечание |
|------|-------|--------|-----------|
| `REVENUE_VAT` | 5110 | 9030 + 6410 | НДС включён в сумму |
| `REVENUE_NO_VAT` | 5110 | 9010 | Без НДС |
| `SUPPLIER_PAYMENT` | 6010 | 5110 | Контрагент → субконто |
| `SALARY` | 6710 | 5110 | Выплата с расчётного счёта |
| `TAX_PAYMENT` | 6410 | 5110 | Уплата в бюджет |
| `RENT` | 6010 | 5110 | Оплата аренды |
| `SALARY_ACCRUAL` | 9420 | 6710, 6520 + 6410 | ФОТ + соцналог + НДФЛ |
| `DEPRECIATION_ACCRUAL` | 9430 | 0200 | Начисление износа ОС |
| `RENT_ACCRUAL` | 9420 | 6010 | Начисление аренды |
| `FX_DIFFERENCE` | 5210 / 9620 | 9540 / 5210 | Доход/расход курсовой разницы |

---

## Налоговые константы (constants.ts: TAX_RATES)

```typescript
export const TAX_RATES = {
  VAT: 12,               // НДС 12%
  INCOME_TAX: 15,        // Налог на прибыль 15%
  TURNOVER_TAX: 4,       // Налог с оборота 4%
  SOCIAL_TAX: 12,        // Социальный налог 12%
  PERSONAL_INCOME_TAX: 12  // НДФЛ 12%
}
```

---

*Последнее обновление: 2026-06-16*

# Модуль C — Реестр транзакций и документов

**Статус:** ✅ Реализован  
**Файлы:** `src/app/transactions/TransactionsClient.tsx`, `src/app/api/transactions/route.ts`  
**Последнее обновление:** 2026-07-01

---

## Назначение

Просмотр и ручная корректировка `StagedTransaction` — всех импортированных операций периода. Позволяет изменить тип документа, пропустить транзакцию или отменить пропуск.

---

## API транзакций

### GET /api/transactions

```
GET /api/transactions?periodId=&status=&search=&page=&limit=&accountId=&direction=&categoryId=
```

**Фильтрация по статусу:**

| Значение `status` | Условие в WHERE |
|------------------|----------------|
| `attention` | `status = "NEEDS_CLARIFICATION"` |
| `uncategorized` | `status IN ("IMPORTED", "NEEDS_CLARIFICATION")` |
| `A,B` (через запятую) | `status IN ("A", "B")` |
| любое одно значение | `status = value` |

**Поиск:** параметр `search` транслируется в Prisma OR-условие на стороне БД:
```typescript
where.OR = [
  { description: { contains: search, mode: "insensitive" } },
  { counterpartyHint: { contains: search, mode: "insensitive" } },
  { counterpartyInn: { contains: search, mode: "insensitive" } },
]
```

**Лимит:** `Math.min(2000, parseInt(limit || "50"))` — максимум 2000 строк на страницу.

**Ответ:**
```typescript
{
  items: StagedTransaction[],
  total: number,
  page: number,
  pages: number
}
```

Каждая транзакция включает:
- `bankAccount: { name, currency, bankName, accountNumber }` — название счёта, валюта, название банка, номер счёта (20 цифр)
- `period: { year, month }`
- `document: { id, type: { id, name, code }, journalEntries: [{ account: { code, name } }] }`

---

## Страница реестра (`/v2/transactions`)

### Фильтры

| Фильтр | API-параметр | Описание |
|--------|-------------|---------|
| Период | `periodId` | Выбор из списка периодов |
| Статус | `status` | ALL / IMPORTED / AUTO_MATCHED / NEEDS_CLARIFICATION / CONFIRMED / POSTED / SKIPPED / uncategorized |
| Поиск | `search` | По description, counterpartyHint, counterpartyInn (case-insensitive, в БД) |

### Действия

| Действие | API | Поведение |
|---------|-----|----------|
| Изменить тип документа | `PATCH /api/transactions/[id]/category` | Управляемый select + кнопка подтверждения |
| Пропустить | `PATCH /api/transactions/[id]/skip` `{ skip: true }` | status → SKIPPED |
| Снять пропуск | `PATCH /api/transactions/[id]/skip` `{ skip: false }` | status → IMPORTED |

**Пропуск (Skip):** вызывает `voidDocument` если у транзакции уже есть документ. Ошибка `voidDocument` теперь **пробрасывается** (не перехватывается молча) — клиент получает корректный статус ошибки.

### UI особенности (`TransactionsClient.tsx`)

- `loadTransactions(page?)` принимает явный аргумент `page` для исправления ошибки устаревшего замыкания (stale closure) — при пагинации используется переданное значение, а не захваченное состояние
- Polling (автообновление) хранится в `pollIntervalRef` (useRef), очищается при unmount компонента
- Транзит-ИНН (`TRANSIT_INNS`) импортируется из `src/lib/constants.ts`
- Ошибки API показываются в инлайн-баннере (не через `alert()`)

### Колонка «Счет»

Показывает пользовательское название счёта (`bankAccount.name`). Если `name` совпадает с `accountNumber` (20-значный номер), вместо него показывается `bankName` (название банка). Под основным названием отображается `bankName` мелким текстом.

```
Логика приоритета:
  name !== accountNumber → показать name + bankName снизу
  name === accountNumber → показать bankName вместо name
```

### Колонка «Категория» — компонент CategoryCombobox (compact)

В compact-режиме (в строке таблицы) режим отображения vs. редактирования разделён:

- **Отображение** (`!open`): `<div>` — текст переносится, показывается полное название категории
- **Редактирование** (`open`): `<input>` с `autoFocus` — поле поиска по списку

Это обеспечивает отображение длинных названий категорий (например, «Оплата поставщику за товары и услуги») без обрезания.

---

## Документы

`Document` создаётся при постинге `StagedTransaction`.

**Структура:**
```typescript
interface Document {
  id: string
  orgId: string
  typeId: string        // DocumentType.id
  periodId: string
  date: Date
  status: "POSTED" | "VOIDED"
  payload: Json         // данные для шаблона проводки
  sourceTransactionId?: string
}
```

**Операции с документами:**
- `POST /api/posting/post` — провести документ (создать JournalEntry)
- `POST /api/posting/void` — аннулировать (удалить JournalEntry)
- `POST /api/posting/repost` — перепровести (void + post с новым типом)

---

## Типы документов (DocumentType)

**API:** `GET /api/document-types`

Базовые типы (создаются через `ensureBaseData.ts` при старте):

| code | Название |
|------|---------|
| `REVENUE_VAT` | Поступление с НДС |
| `REVENUE_NO_VAT` | Поступление без НДС |
| `SUPPLIER_PAYMENT` | Оплата поставщику |
| `SALARY` | Выплата зарплаты |
| `TAX_PAYMENT` | Уплата налога (НДФЛ, НДС, НнП, НсО) |
| `INPS_PAYMENT` | Уплата ИНПС |
| `SOCIAL_TAX_PAYMENT` | Уплата соцналога |
| `RENT` | Аренда (оплата по выписке) |
| `ADVANCE_PAID` | Аванс выданный поставщику |
| `ADVANCE_RECEIVED` | Аванс полученный от покупателя |
| `SALARY_ACCRUAL` | Начисление ФОТ |
| `DEPRECIATION_ACCRUAL` | Начисление амортизации |
| `RENT_ACCRUAL` | Начисление аренды (неденежное) |
| `FX_DIFFERENCE` | Курсовая разница |
| `PERIOD_CLOSING` | Реформация баланса (закрытие TRANSIT-счетов) |
| `YEAR_END_CLOSE` | Перенос 9910 → 8710 (годовое закрытие) |

---

*Последнее обновление: 2026-06-30*

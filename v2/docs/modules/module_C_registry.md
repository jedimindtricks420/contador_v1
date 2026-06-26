# Модуль C — Реестр транзакций и документов

**Статус:** ✅ Реализован  
**Файлы:** `src/app/transactions/TransactionsClient.tsx`, `src/app/api/transactions/`

---

## Назначение

Просмотр и ручная корректировка `StagedTransaction` — всех импортированных операций периода. Позволяет изменить тип документа, пропустить транзакцию или отменить пропуск.

---

## Страница реестра (`/v2/transactions`)

### Фильтры

| Фильтр | API-параметр | Описание |
|--------|-------------|---------|
| Период | `periodId` | Выбор из списка периодов |
| Статус | `status` | ALL / IMPORTED / AUTO_MATCHED / NEEDS_CLARIFICATION / CONFIRMED / POSTED / SKIPPED |
| Поиск | `search` | По description и counterpartyHint |

### Действия

| Действие | API | Поведение |
|---------|-----|----------|
| Изменить тип документа | `PATCH /api/transactions/[id]/category` | Управляемый select + кнопка «✓» |
| Пропустить | `PATCH /api/transactions/[id]/skip` `{ skip: true }` | status → SKIPPED |
| Снять пропуск | `PATCH /api/transactions/[id]/skip` `{ skip: false }` | status → IMPORTED |

### UI особенности

- Поиск с 15-секундным debounce
- Спиннер вместо кнопки «✗» пока идёт поиск
- Ошибки API показываются в инлайн-баннере (не через `alert()`)
- Toast с отменой удаления правила — показывается 15 секунд

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
  payload: Json         // Данные для шаблона проводки
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
| `TAX_PAYMENT` | Уплата налога |
| `RENT` | Аренда |
| `SALARY_ACCRUAL` | Начисление ФОТ |
| `DEPRECIATION_ACCRUAL` | Начисление амортизации |
| `RENT_ACCRUAL` | Начисление аренды |
| `FX_DIFFERENCE` | Курсовая разница |

---

*Последнее обновление: 2026-06-26*

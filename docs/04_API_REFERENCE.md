# 04 — API Reference

**Документ:** REST API Reference  
**Версия:** 2.0  
**Дата:** 2026-06-26  
**Base URL:** `https://contador.uz/v2/api`  
**Формат:** JSON (`Content-Type: application/json`)  
**Авторизация:** HTTP-only cookie `v2_session` (JWT)

---

## Соглашения

- Все пути относительно `/v2/api/`
- `[id]` — UUID параметр в пути
- `?param=` — query-параметр
- Тело запроса — JSON
- Ошибки: `{ "error": "Сообщение об ошибке" }`

### Коды ответов

| Код | Значение |
|-----|---------|
| 200 | OK — запрос выполнен |
| 201 | Created — ресурс создан |
| 400 | Bad Request — неверные параметры |
| 401 | Unauthorized — нет сессии |
| 403 | Forbidden — нет прав |
| 404 | Not Found — ресурс не найден |
| 409 | Conflict — конфликт (например, счёт с транзакциями) |
| 422 | Unprocessable — ошибка бизнес-логики (несбалансированная проводка) |
| 423 | Locked — период закрыт |
| 500 | Internal Server Error |

---

## Аутентификация

### POST /auth/register

Регистрация нового пользователя.

**Body:**
```json
{
  "name": "Иван Иванов",
  "email": "ivan@company.uz",
  "password": "SecurePass123",
  "orgName": "ООО Ромашка"
}
```

**Response 201:**
```json
{
  "user": { "id": "uuid", "email": "ivan@company.uz", "name": "Иван Иванов" }
}
```

Устанавливает cookie `v2_session`. Если `orgName` указан — создаёт организацию и назначает роль `OWNER`.

---

### POST /auth/login

**Body:** `{ "email": "...", "password": "..." }`

**Response 200:**
```json
{
  "user": { "id": "uuid", "email": "...", "name": "..." },
  "activeOrgId": "org-uuid"
}
```

Устанавливает HTTP-only cookie `v2_session` (7 дней).

---

### POST /auth/logout

**Response 200:** `{ "ok": true }` — удаляет cookie.

---

### POST /auth/forgot-password

**Body:** `{ "email": "ivan@company.uz" }`  
**Response 200:** `{ "ok": true }` — всегда 200 (не раскрывает наличие email). Отправляет письмо со ссылкой (токен действует 1 час).

---

### POST /auth/reset-password

**Body:** `{ "token": "uuid-from-email", "password": "NewPass123" }`  
**Response 200:** `{ "ok": true }`

---

## Организация

### GET /org/members

Список участников активной организации.

**Response 200:**
```json
[
  { "id": "member-uuid", "role": "ADMIN", "user": { "id": "...", "email": "...", "name": "..." } }
]
```

---

### POST /org/members/invite

**Body:** `{ "email": "new@member.uz", "role": "ACCOUNTANT" }`  
Роли: `ADMIN | ACCOUNTANT`  
**Response 200/201:** `{ "member": {...} }`

---

### DELETE /org/members/[userId]

Удалить участника. `userId` — это `User.id` (не `OrgMember.id`).  
**403** если удаляете себя / последнего ADMIN.

---

### POST /org/switch

Переключить активную организацию.

**Body:** `{ "orgId": "org-uuid" }`  
**Response 200:** `{ "ok": true }` — перевыпускает cookie с новым `activeOrgId`.

---

## Периоды

### GET /periods

**Response 200:** `Period[]` — все периоды организации, сортировка: год DESC, месяц DESC.

---

### POST /periods

**Body:** `{ "year": 2026, "month": 5 }`  
**Response 201:** `{ "period": Period }`

---

### DELETE /periods/[id]

Удалить период. **423** если период CLOSED. **409** если есть документы.

---

## Банковские счета

### GET /bank-accounts

**Response 200:** `BankAccount[]`

---

### POST /bank-accounts

**Body:**
```json
{
  "name": "Основной счёт UZS",
  "currency": "UZS",
  "bankName": "АТ Банк",
  "accountNumber": "20208000300100001234",
  "lastBalance": 15000000
}
```

**Response 201:** `{ "account": BankAccount }`

---

### PUT /bank-accounts/[id]

**Body:** те же поля, частичное обновление.  
**Response 200:** `{ "account": BankAccount }`

---

### DELETE /bank-accounts/[id]

**409** если есть связанные транзакции (с сообщением: "Нельзя удалить счёт: к нему привязано N транзакций. Сначала откатите импорт.").

---

## Импорт банковской выписки

### POST /import

Загрузка банковской выписки (multipart/form-data).

**Form fields:**
- `file` — файл (`*.xml` для 1C, `*.xlsx` для Excel)
- `bankAccountId` — UUID банковского счёта
- `periodId` — UUID периода
- `preview` — `"true"` для предварительного просмотра (не сохраняет)

**Response 200 (preview=true):**
```json
{
  "preview": [
    { "date": "2026-05-15", "amount": 5000000, "direction": "CREDIT", "description": "Оплата за услуги" }
  ],
  "total": 47
}
```

**Response 200 (import):**
```json
{
  "imported": 45,
  "duplicates": 2,
  "importBatchId": "batch-uuid"
}
```

---

### DELETE /import/[batchId]

Откат пакета импорта — удаляет все `StagedTransaction` с данным `importBatchId`.  
**Response 200:** `{ "deleted": 45 }`

---

## Транзакции

### GET /transactions

**Query params:**
| Параметр | Тип | Описание |
|---------|-----|---------|
| `periodId` | UUID | Фильтр по периоду (обязателен) |
| `status` | string | ALL / IMPORTED / AUTO_MATCHED / NEEDS_CLARIFICATION / CONFIRMED / POSTED / SKIPPED |
| `search` | string | Поиск по description и counterpartyHint |

**Response 200:**
```json
{
  "transactions": [StagedTransaction, ...],
  "total": 150
}
```

---

### PATCH /transactions/[id]/category

Изменить тип документа транзакции.

**Body:** `{ "documentTypeId": "uuid" }`  
**Response 200:** `{ "transaction": StagedTransaction }`

---

### PATCH /transactions/[id]/skip

**Body:** `{ "skip": true }` → SKIPPED; `{ "skip": false }` → IMPORTED  
**Response 200:** `{ "transaction": StagedTransaction }`

---

## Классификация

### POST /classification/run-rules

Запуск движка правил для периода.

**Body:** `{ "periodId": "uuid" }`  
**Response 200:** `{ "matched": 23, "remaining": 12 }`

---

### POST /classification/run-ai

Запуск AI-классификатора для оставшихся IMPORTED транзакций.

**Body:** `{ "periodId": "uuid" }`  
**Response 200:** `{ "processed": 12, "autoMatched": 9, "needsClarification": 3 }`

---

### GET /classification/status/[periodId]

Статус выполнения AI-классификации.

**Response 200:** `{ "status": "running" | "done", "progress": { "processed": 8, "total": 12 } }`

---

## Очередь уточнений (Clarification)

### GET /clarification/queue

**Query:** `?periodId=uuid`

**Response 200:**
```json
{
  "groups": [
    {
      "groupId": "uuid",
      "counterpartyHint": "ООО AGROSERVIS",
      "counterpartyInn": "301846873",
      "transactions": [StagedTransaction, ...],
      "aiSuggestion": {
        "categoryId": "uuid",
        "confidence": 72,
        "extractedCounterparty": "ООО AGROSERVIS",
        "vatApplicable": false
      }
    }
  ]
}
```

---

### POST /clarification/answer

Ответ пользователя на группу уточнений.

**Body:**
```json
{
  "transactionIds": ["uuid1", "uuid2"],
  "documentTypeId": "uuid",
  "createRule": true,
  "ruleMatchType": "INN",
  "ruleMatchValue": "301846873"
}
```

**Response 200:** `{ "ok": true }`

---

## Проводки (Posting Engine)

### POST /posting/post

Провести документ.

**Body:** `{ "documentId": "uuid" }`  
**Response 200:**
```json
{
  "journalEntries": [JournalEntry, ...],
  "openItem": OpenItem | null
}
```

**423** если период CLOSED. **422** если несбалансированная проводка.

---

### POST /posting/void

Аннулировать документ.

**Body:** `{ "documentId": "uuid" }`  
**Response 200:** `{ "ok": true }`

---

### POST /posting/repost

Перепровести с новым типом.

**Body:** `{ "documentId": "uuid", "newTypeId": "uuid" }`  
**Response 200:** `{ "journalEntries": [...], "openItem": ... }`

---

## Закрытие периода

### GET /closing/[periodId]/state

Текущее состояние мастера закрытия.

**Response 200:**
```json
{
  "period": Period,
  "closingData": ClosingData,
  "stats": {
    "imported": 47,
    "needsClarification": 2,
    "posted": 44,
    "skipped": 1
  }
}
```

---

### POST /closing/[periodId]/step/[N]/complete

Завершить шаг N (1–6).

**Шаг 4 — Body:** `{ "salaryAmount": 5000000, "depreciationAmount": 200000, "rentAmount": 1500000 }`  
**Шаг 5 — Body:** `{ "exchangeRate": 12700.5, "difference": 15000 }`  
**Шаги 1, 2, 3, 6 — Body:** `{}`

---

### DELETE /closing/[periodId]/accruals

Сброс начислений шага 4.

**Response 200:** `{ "reset": true }`

---

### POST /closing/[periodId]/finalize

Финализация периода (шаг 7). Применяет начисления, налоги, блокирует период.

**Response 200:**
```json
{
  "period": Period,
  "documentsCreated": 5,
  "taxEvents": [TaxCalendarEvent, ...]
}
```

---

### POST /closing/year-end

Закрытие года: перенос остатков, создание следующего периода.

---

### GET /closing/year-end/status

Статус операции закрытия года.

---

## Правила классификации

### GET /rules

**Response 200:** `Rule[]` (с `documentType: { name, code }`, сортировка по `order ASC`)

---

### POST /rules

**Body:** `{ "matchType": "INN", "matchValue": "301846873", "categoryId": "uuid" }`  
**Response 201:** `{ ...Rule }`

---

### PATCH /rules/[id]

**Body:** `{ "matchType"?, "matchValue"?, "categoryId"?, "isActive"? }`

---

### DELETE /rules/[id]

**Response 200:** `{ "ok": true }`

---

### PUT /rules/reorder

**Body:** `{ "ids": ["uuid1", "uuid2", "uuid3"] }` — порядок = индекс в массиве.

---

## Открытые позиции

### GET /open-items

**Query:** `?status=OPEN|CLOSED|RISK|UNRESOLVED&accountId=&periodId=&search=`

**Response 200:** `{ "items": OpenItem[], "total": number }`

---

### PATCH /open-items/[id]/close

**Body:** `{ "reason": "Закрыто вручную" }`  
**Response 200:** `{ "item": OpenItem }`

---

### POST /open-items/[id]/reopen

Только для позиций со статусом `CLOSED` (закрытых вручную).  
**Response 200:** `{ "item": OpenItem }`

---

## Отчёты

### GET /reports/osv

Оборотно-сальдовая ведомость.

**Query:** `?from=2026-05-01&to=2026-05-31&expandSubconto=true`

**Response 200:**
```json
{
  "rows": [
    {
      "accountCode": "5110",
      "accountName": "Расчётный счёт (UZS)",
      "accountType": "ASSET",
      "openingDebit": 10000000,
      "openingCredit": 0,
      "debitTurnover": 5000000,
      "creditTurnover": 3000000,
      "closingDebit": 12000000,
      "closingCredit": 0,
      "subconto": [...]
    }
  ],
  "totals": { "openingDebit": ..., "openingCredit": ..., ... }
}
```

---

### GET /reports/journal

**Query:** `?from=&to=&accountCode=5110`

**Response 200:** `JournalEntry[]` с инклудом document и account.

---

### GET /reports/account-card

**Query:** `?from=&to=&accountCode=5110`

**Response 200:**
```json
{
  "openingBalance": { "debit": 10000000, "credit": 0 },
  "entries": [{ "date": "...", "document": "...", "debit": 5000000, "credit": 0, "balance": 15000000 }],
  "closingBalance": { "debit": 12000000, "credit": 0 }
}
```

---

### GET /reports/balance

Бухгалтерский баланс (Форма №1) — строки 010–780 по НСБУ №21.

**Query:** `?to=YYYY-MM-DD`

**Response 200 (сокращённо):**
```json
{
  "asOf": "2026-05-31",
  "lines": {
    "line010": 5000000,
    "line130": 5000000,
    "line220": 15000000,
    "line390": 28000000,
    "line400": 33000000,
    "line410": 10000000,
    "line450": 8500000,
    "line480": 18500000,
    "line680": 2000000,
    "line770": 14500000,
    "line780": 33000000
  },
  "balanceCheck": true,
  "difference": 0
}
```

---

### GET /reports/subconto

**Query:** `?from=&to=&accountCode=6010&counterpartyId=uuid`

---

### GET /pnl

Отчёт о финансовых результатах (Форма №2) — строки 010–270 по НСБУ №21.

**Query:** `?from=2026-01-01&to=2026-05-31`

**Response 200:**
```json
{
  "period": { "from": "2026-01-01", "to": "2026-05-31" },
  "taxRegime": "TURNOVER_TAX",
  "turnoverTaxRate": 0.04,
  "lines": {
    "line010": 15000000,
    "line020": 3000000,
    "line030": 12000000,
    "line040": 2000000,
    "line100": 10000000,
    "line220": 10000000,
    "line240": 10000000,
    "line250": 600000,
    "line270": 9400000
  },
  "months": ["2026-01", "2026-02", "2026-03", "2026-04", "2026-05"],
  "monthlyRevenue": [2000000, 2500000, 3000000, 3500000, 4000000],
  "monthlyNetProfit": [1500000, 1800000, 2000000, 2200000, 1900000]
}
```

---

### GET /cashflow

Движение денежных средств.

**Query:** `?from=&to=&accountId=uuid|ALL`

**Response 200:**
```json
{
  "incoming": 20000000,
  "outgoing": 12000000,
  "net": 8000000,
  "opening": 5000000,
  "closing": 13000000,
  "currency": "UZS"
}
```

---

## Справочники

### GET /document-types

**Response 200:** `DocumentType[]`

---

### GET /cbu-rate

Текущий курс ЦБ РУз (USD/UZS).

**Response 200:** `{ "rate": 12750.5, "date": "2026-06-16" }`

---

### GET /accounts

Список счетов плана счетов.

**Query:** `?search=&layer=CORE&type=ASSET`

---

## Настройки

### GET /settings/org

Настройки организации.

### PATCH /settings/org

**Body (все поля опциональны):**
```json
{
  "name": "ООО Новое название",
  "inn": "123456789",
  "taxRegime": "TURNOVER_TAX",
  "isVatPayer": false,
  "activityGroup": "TRADE",
  "activityDescription": "Оптовая торговля продуктами питания",
  "aiConfidenceThreshold": 75,
  "maxClarificationQuestions": 10
}
```

---

### GET /settings/tax-deadlines

### POST /settings/tax-deadlines

**Body:** `{ "type": "VAT", "dayOfMonth": 20, "frequency": "MONTHLY", "taxRegime": "VAT", "isActive": true }`

### PUT /settings/tax-deadlines

**Body:** `{ "id": "uuid", "dayOfMonth": 25, "isActive": true }`

### DELETE /settings/tax-deadlines?id=[id]

**404** если не найдено.

---

### GET /settings/open-item-deadlines

**Response 200:** `{ "4310": 30, "6310": 30, "4220": 10 }`

### PATCH /settings/open-item-deadlines

**Body:** `{ "4310": 45, "6310": 30, "4220": 10 }` — полная замена.

---

## Дашборд

### GET /dashboard

**Query:** `?periodId=uuid`

**Response 200:**
```json
{
  "revenue": 15000000,
  "expenses": 5725000,
  "netProfit": 9275000,
  "bankBalanceUZS": 12000000,
  "bankBalanceUSD": 5000,
  "taxEvents": [TaxCalendarEvent, ...],
  "riskItems": [OpenItem, ...],
  "needsClarification": 3,
  "periodClosed": false
}
```

---

*Дата: 2026-06-16*

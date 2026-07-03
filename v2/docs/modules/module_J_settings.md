# Модуль J — Настройки

**Статус:** ✅ Реализован  
**Файлы:** `src/app/api/settings/`, `src/app/api/rules/`, `src/app/settings/`  
**Последнее обновление:** 2026-07-02

---

## J1. Настройки организации

**API:** `GET /api/settings/org`, `PATCH /api/settings/org`

### Читаемые поля

```typescript
{
  name: string               // Название организации
  inn: string                // ИНН
  taxRegime: TaxRegime       // VAT | TURNOVER_TAX
  isVatPayer: boolean        // Плательщик НДС
  turnoverTaxRate: number    // Ставка налога с оборота, default: 0.04
  activityGroup: string | null
  activityDescription: string | null
  activityCustom: string | null
  aiConfidenceThreshold: number   // Порог уверенности AI, default: 70
  maxClarificationQuestions: number
}
```

### PATCH — обновление

Требует роль **OWNER** или **ADMIN**.

Все поля необязательны (частичное обновление). Для `turnoverTaxRate`:
```typescript
Math.max(0.01, Math.min(0.25, Number(body.turnoverTaxRate)))
```
Диапазон: 0.01–**0.25** (1%–25%). Значение за пределами зажимается (не отклоняется).

### Обработка ошибок

GET и PATCH: `UNAUTHORIZED` или `NO_ACTIVE_ORG` → **401** (не 500).

---

## J2. Правила классификации (Rules)

**API:** `GET/POST /api/rules`, `PATCH/DELETE /api/rules/[id]`, `PUT /api/rules/reorder`

### Структура правила

```typescript
interface Rule {
  id: string
  orgId: string
  matchType: "INN" | "KEYWORD" | "AMOUNT_RANGE" | "TREASURY_ACCOUNT"
  matchValue: string
  categoryId: string          // DocumentType.id
  order: number               // Приоритет выполнения (ASC)
  isActive: boolean
  createdFrom: "MANUAL" | "USER_ANSWER"
}
```

### API

```
GET /api/rules
→ Rule[] (с include: documentType.name, documentType.code, сортировка по order ASC)

POST /api/rules
Body: { matchType, matchValue, categoryId }
→ Rule (201)

PATCH /api/rules/[id]
Body: { matchType?, matchValue?, categoryId?, isActive? }
→ Rule

DELETE /api/rules/[id]
→ { ok: true }

PUT /api/rules/reorder
Body: { ids: string[] }
→ { ok: true }
```

### Источники правил

| `createdFrom` | Источник |
|-------------|---------|
| `MANUAL` | Пользователь создал вручную в настройках |
| `USER_ANSWER` | Создано автоматически при ответе в очереди уточнений |

### Кэш правил

Правила кэшируются в памяти на 30 секунд. Один запрос к БД на 30 сек.

---

## J3. Налоговый календарь (Tax Deadline Templates)

**API:** `GET/POST/PUT/DELETE /api/settings/tax-deadlines`

### Структура

```typescript
interface TaxDeadlineTemplate {
  id: string
  orgId: string
  type: string          // "VAT", "PERSONAL_INCOME_TAX", "PROFIT_TAX", "SOCIAL_TAX", "INPS", "TURNOVER_TAX"
  dayOfMonth: number    // День месяца уплаты
  frequency: string     // "MONTHLY" | "QUARTERLY" | "ANNUAL"
  taxRegime: string | null
  isActive: boolean
}
```

### API

```
GET /api/settings/tax-deadlines
→ TaxDeadlineTemplate[]

POST /api/settings/tax-deadlines
Body: { type, dayOfMonth, frequency, taxRegime?, isActive? }
→ TaxDeadlineTemplate (201)

PUT /api/settings/tax-deadlines
Body: { id, dayOfMonth?, frequency?, isActive? }
→ TaxDeadlineTemplate
```

PUT использует `where: { id, orgId }` через `prismaWithOrg(orgId)` — изоляция по организации.

```
DELETE /api/settings/tax-deadlines?id=<id>
→ { ok: true }
→ 404 если не найдено
```

---

## J4. Начальные остатки

**API:** `GET /api/settings/opening-balance`, `POST /api/settings/opening-balance`

### GET — получение текущих остатков

```
GET /api/settings/opening-balance
→ { lines: [{ accountCode, accountName, debit, credit }], documentId? }
```

Строка счёта `8890` (OPENING_BALANCE_EQUITY) фильтруется из ответа.

### POST — запись остатков

```
POST /api/settings/opening-balance
Body: { lines: [{ accountCode, debit, credit }], date? }
→ { id: documentId }  (201)
```

- Балансировка автоматическая через счёт `8890`
- Если документ OPENING_BALANCE уже существует → аннулирует старый, создаёт новый
- В одном `prisma.$transaction()`

### Обработка ошибок

Оба метода: `UNAUTHORIZED` или `NO_ACTIVE_ORG` → **401** (не 500).  
Ошибки 500 возвращают `"Внутренняя ошибка сервера"` (не `err.message`).

---

## J5. Дедлайны открытых позиций

**API:** `GET/PATCH /api/settings/open-item-deadlines`

Переопределение дедлайнов риска для буферных счетов. Хранится в
`Organization.settings.openItemDeadlines` (JSON) и **реально применяется** —
`getRiskDeadline(accountCode, dateOpened, org.settings)` в `openItems.ts` читает override
для конкретного счёта при создании OpenItem в `postDocument()` (приоритет: override
организации → встроенный дефолт `RISK_DAYS_BY_ACCOUNT` → общий `RISK_DAYS_DEFAULT`).

Список счетов не хардкодится в UI/API — `getOpenItemBufferAccountCodes()` в
`ensureBaseData.ts` вычисляет его из всех типов документов с `opensItem: true`, а названия
берутся из таблицы `Account`.

### Формат

```
GET /api/settings/open-item-deadlines
→ {
    "accounts": [
      { "code": "4220", "name": "Авансы, выданные на служебные командировки", "days": 10 },
      { "code": "4310", "name": "Авансы поставщикам под ТМЦ", "days": 30 },
      ...
    ]
  }

PATCH /api/settings/open-item-deadlines
Body: { "4310": 45, "6610": 180 }   // частичное обновление — только переданные коды
→ { "openItemDeadlines": { "4310": 45, "6610": 180, ... } }   // объединённый объект overrides
```

**Валидация PATCH:** код счёта должен входить в `getOpenItemBufferAccountCodes()` (иначе
400 — «не используется как буферный счёт»), значение — положительное число (иначе 400).

---

## J6. Видимость счетов плана счетов

Счета помечены флагом `Account.isDeprecated` — устаревшие скрыты по умолчанию в выпадающих списках.

---

## Страницы настроек в UI

| Страница | Путь |
|---------|------|
| Организация | `/v2/settings` |
| Правила | `/v2/settings/rules` |
| Участники | `/v2/settings/members` |
| Налоговый календарь | `/v2/settings/tax-deadlines` |
| Открытые позиции | `/v2/settings/open-items-deadlines` |
| Счета (видимость) | `/v2/settings/accounts` |

---

*Последнее обновление: 2026-07-02*

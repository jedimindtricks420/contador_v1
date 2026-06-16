# Модуль J — Настройки

**Статус:** ✅ Реализован  
**Файлы:** `src/app/api/settings/`, `src/app/api/rules/`, `src/app/settings/`

---

## J1. Настройки организации

**API:** `GET /api/settings/org`, `PATCH /api/settings/org`

### Читаемые поля

```typescript
{
  name: string               // Название организации
  inn: string                // ИНН (9 цифр)
  taxRegime: TaxRegime       // GENERAL | SIMPLIFIED | TURNOVER_TAX | VAT
  isVatPayer: boolean        // Плательщик НДС
  activityGroup: string | null    // Группа вида деятельности
  activityDescription: string | null
  activityCustom: string | null
  aiConfidenceThreshold: number   // Порог уверенности AI, default: 70
  maxClarificationQuestions: number
}
```

### PATCH-поля

Все вышеуказанные поля. Частичное обновление (только переданные поля).

### activityGroup

Используется AI-классификатором для контекста при разметке транзакций. Значения задаются из справочника `ActivityCategory` (таблица `activity_categories`).

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
  order: number               // Приоритет выполнения
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
Обязательные: matchType, matchValue, categoryId
→ Rule (201)

PATCH /api/rules/[id]
Body: { matchType?, matchValue?, categoryId?, isActive? }
→ Rule

DELETE /api/rules/[id]
→ { ok: true }

PUT /api/rules/reorder
Body: { ids: string[] }   // массив ID в новом порядке
→ { ok: true }
```

### Логика reorder

Обновляет `Rule.order` = индекс в массиве `ids` для каждого правила через `prisma.$transaction()`.

### Источники правил

| `createdFrom` | Источник |
|-------------|---------|
| `MANUAL` | Пользователь создал вручную в настройках |
| `USER_ANSWER` | Создано автоматически при ответе в очереди уточнений (чекбокс «Запомнить для контрагента») |

### Кэш правил

Правила кэшируются в памяти на 30 секунд. Один запрос к БД на 30 секунд для всего движка классификации.

---

## J3. Налоговый календарь (Tax Deadline Templates)

**API:** `GET/POST/PUT/DELETE /api/settings/tax-deadlines`

### Структура

```typescript
interface TaxDeadlineTemplate {
  id: string
  orgId: string
  type: string              // Тип налога ("VAT", "INCOME_TAX", "SOCIAL_TAX", ...)
  dayOfMonth: number        // День месяца уплаты
  frequency: string         // "MONTHLY" | "QUARTERLY" | "ANNUAL"
  taxRegime: string | null  // Применимый режим или null (все режимы)
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

DELETE /api/settings/tax-deadlines?id=<id>
→ { ok: true }
→ 404 если не найдено (фиксированная ошибка: ранее возвращало 500)
```

При финализации периода (`POST /api/closing/[periodId]/finalize`) — автоматически создаются `TaxCalendarEvent` на основе активных шаблонов.

---

## J4. Дедлайны открытых позиций

**API:** `GET/PATCH /api/settings/open-item-deadlines`

Переопределение дедлайнов риска для буферных счетов на уровне организации. Хранятся в `Organization.settings` (JSON-поле).

### Формат

```typescript
{
  "4310": 30,   // Авансы выданные — 30 дней
  "6310": 30,   // Авансы полученные — 30 дней
  "4220": 10,   // Подотчётные суммы — 10 дней
  "5110_UNIDENTIFIED": 5   // Невыясненные — 5 дней
}
```

```
GET /api/settings/open-item-deadlines
→ объект вида { "4310": 30, ... }

PATCH /api/settings/open-item-deadlines
Body: { "4310": 45, ... }   // полная замена объекта дедлайнов
→ обновлённый объект
```

Дедлайны из этого эндпоинта используются функцией `getRiskDeadline()` в `openItems.ts` при создании OpenItem движком проводок.

---

## J5. Видимость счетов плана счетов

Настройка видимости счетов в UI (какие счета показывать в выпадающих списках при ручной корректировке документов).

Счета помечены флагом `Account.isDeprecated` — устаревшие счета скрыты по умолчанию.

---

## Страницы настроек в UI

| Страница | Путь |
|---------|------|
| Организация | `/v2/settings` |
| Правила | `/v2/settings/rules` |
| Участники | `/v2/settings/members` |
| Налоговый календарь | `/v2/settings/tax-deadlines` |
| Открытые позиции | `/v2/settings/open-item-deadlines` |

---

*Последнее обновление: 2026-06-16*

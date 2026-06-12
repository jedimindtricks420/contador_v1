# Техническое описание Contador v2.0

## Технологический стек

| Компонент | Технология |
|---|---|
| Framework | Next.js 16.2.1 (App Router) |
| Database | PostgreSQL 16 |
| ORM | Prisma 6.2.1 |
| Styling | Tailwind CSS 4 |
| Финансовые расчёты | Decimal.js (все суммы — Decimal, не float) |
| State Management | TanStack Query v5 (React Query) |
| AI | OpenAI GPT-4o (модель `gpt-4o`) |
| Auth | JWT (jose), bcryptjs |
| Validation | Zod |

---

## Архитектура Multi-tenancy

Модель **Shared Database, Shared Schema** — данные всех организаций в одной БД, изоляция через `organization_id`.

### Механизм доступа
1. **User** — владеет неограниченным числом организаций. Поле `active_org_id` задаёт текущий контекст.
2. **Organization** — все финансовые данные (`Transaction`, `Account`, `Counterparty`, `SystemSettings`) жёстко привязаны к `organization_id`.
3. Все API-эндпоинты фильтруют данные через `getActiveOrganizationId()` из `src/lib/context.ts`.

---

## Типы счетов (AccountType enum)

Девять типов, определяют логику сальдо в ОСВ и Балансе:

| Тип | Описание | Нормальное сальдо |
|---|---|---|
| `ACTIVE` | Активный | Дебетовое |
| `PASSIVE` | Пассивный | Кредитовое |
| `CONTRA_ACTIVE` | Контрактивный (02xx, 05xx) | Кредитовое |
| `CONTRA_PASSIVE` | Контрпассивный | Дебетовое |
| `ACTIVE_PASSIVE` | Активно-пассивный (0000, 4400, 9900) | Любое |
| `INCOME` | Доходный (90xx, 93xx, 95xx) | Нулевое (закрывается в конце периода) |
| `EXPENSE` | Расходный (91xx, 92xx, 94xx, 96xx, 98xx) | Нулевое (закрывается в конце периода) |
| `CONTRA_INCOME` | Контрдоходный (9040, 9050) | Нулевое |
| `OFF_BALANCE` | Забалансовый (001–016) | Нет двойной записи |

Доходные и расходные счета **не несут остаток** между периодами — ОСВ и Баланс возвращают 0 для их сальдо.

---

## Модели данных (Prisma)

### Ключевые модели

```prisma
model Account {
  id                String      @id @default(uuid())
  code              String
  name              String
  type              AccountType
  is_postable       Boolean     @default(true)
  organization_id   String
  master_account_id String?
  is_active         Boolean     @default(true)
  is_custom         Boolean     @default(false)
  @@unique([code, organization_id])
}

model Transaction {
  id              String   @id @default(uuid())
  date            DateTime
  period          String   // Формат "MM.YYYY"
  description     String
  amount          Decimal  @db.Decimal(20, 2)
  debit_id        String
  credit_id       String
  organization_id String
  is_deleted      Boolean  @default(false)
}

model MasterAccount {
  id          String      @id @default(uuid())
  code        String      @unique
  name        String
  type        AccountType
  is_postable Boolean     @default(true)
  group       String?
  description String?
}
```

### Справочные данные
- **MasterAccount** — эталонный план счетов НСБУ. **340 записей** (324 балансовых + 16 забалансовых).
- **IndustryTemplate** — 22 отраслевых шаблона с набором счетов.

---

## AI-модуль

### Файлы
- `ai/knowledge-base.ts` — `MASTER_COA_COMPACT` (266 проводимых счетов в pipe-формате) + `INDUSTRY_TEMPLATES_COMPACT` (22 шаблона).
- `ai/prompts.ts` — системный промпт с правилами НСБУ (зарплатный цикл, НДС, займы, налог с оборота).
- `src/app/api/ai/chat/route.ts` — приём сообщений, ответ AI, сохранение истории.
- `src/app/api/ai/execute/route.ts` — создание проводок из JSON-ответа AI.

### Тарификация
- FREE: 10 запросов/месяц
- PRO: 300 запросов/месяц
- MYAPI: пользовательский ключ OpenAI, без ограничений

### Стоимость токенов (GPT-4o)
- Input: $2.50 / 1M токенов
- Output: $10.00 / 1M токенов

---

## Финансовая логика

### Формулы ОСВ
- **S1 (начальное сальдо)** — сумма проводок до `opening_balance_date` включительно.
- **Обороты** — суммы дебета/кредита за запрошенный период (исключая дату открытия).
- **S2 (конечное сальдо)** = S1 + обороты.

### Формулы дашборда
```
Выручка     = Кредит(9010+9020+9030) − Дебет(9040+9050)
Расходы     = Дебет(91*+94*)
Прочие дох. = Кредит(93*+95*)
Прочие расх.= Дебет(96*)
Налог прибыли = Дебет(981*)
Чистая прибыль = Выручка − Расходы + Прочие дох. − Прочие расх. − Налог прибыли
```

### Валидация транзакций (`src/lib/accounting-logic.ts`)
- Запрет на даты ранее `closed_period_date`.
- Счёт 0000 — только на дату `opening_balance_date`.
- Дебет ≠ Кредит (запрет проводки с одним счётом на обоих сторонах).
- Забалансовые счета (OFF_BALANCE) — запрет в двойной записи.

---

## Безопасность

- **Auth**: JWT-сессии через cookies (`session`). Middleware защищает все `/api/*` кроме `/api/auth/`.
- **Soft Delete**: транзакции помечаются `is_deleted: true`, физически не удаляются.
- **Audit Log**: все AI-транзакции пишутся в `AuditLog` с action `AI_TRANSACTION_AUTO_CREATE`.
- **Zod**: валидация всех входящих JSON на API-эндпоинтах.

---

## Глобальный UI

- **ClientLayout** — при открытии AI-чата добавляет `padding-right: 400px`, контент сжимается и перецентрируется.
- **UIContext** (`src/lib/ui-context.tsx`) — состояние `isChatOpen`, `toggleChat()`.
- **Organization Switcher** — в нижней части сайдбара, обновляет `active_org_id` в БД и перезагружает контекст.

---

*Contador v2.0 — НСБУ №21, Узбекистан*

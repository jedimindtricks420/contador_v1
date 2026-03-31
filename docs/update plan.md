# Enterprise Architecture Plan: Contador v2.0

## Принципы, взятые из индустрии

Единственный способ обеспечить мультитенантную безопасность — это tenant-scoped доступ к данным **по конструкции**, а не по привычке. Каждый репозиторий должен получать `organizationId` один раз при инициализации, и все запросы автоматически фильтруются. Это значит: не передавать `org_id` в каждый метод вручную, а **биндить контекст один раз** в middleware.

Мейнстримный подход 2025 года — встраивать tenant информацию в JWT-токен, а на уровне БД использовать Shared Database + Row-Level Isolation через `organization_id` на каждой таблице. У тебя это уже сделано правильно.

---

## Обновлённая схема базы данных

### Что добавляется к существующей схеме:

```prisma
// 1. ГЛОБАЛЬНЫЙ МАСТЕР-СПРАВОЧНИК (неизменяемый эталон COA)
model MasterAccount {
  id           String          @id @default(uuid())
  code         String          @unique
  name         String
  type         AccountType
  description  String?         // подсказка для AI и пользователя
  
  // К каким шаблонам относится (JSON array of industry keys)
  // ["trade", "construction", "saas", "all"]
  industry_tags String[]        @default([])
  
  is_system    Boolean         @default(false) // счет 0000 и системные
  sort_order   Int             @default(0)

  template_items IndustryTemplateItem[]
}

// 2. ОТРАСЛЕВЫЕ ШАБЛОНЫ
model IndustryTemplate {
  id          String   @id @default(uuid())
  key         String   @unique  // "trade", "construction", "saas" etc.
  name        String            // "Торговля", "Строительство"
  description String?
  icon        String?           // emoji или icon key
  is_active   Boolean  @default(true)
  sort_order  Int      @default(0)
  
  items       IndustryTemplateItem[]
}

model IndustryTemplateItem {
  id          String          @id @default(uuid())
  template_id String
  account_id  String
  is_required Boolean         @default(false) // нельзя убрать чекбоксом
  
  template    IndustryTemplate @relation(fields: [template_id], references: [id])
  account     MasterAccount    @relation(fields: [account_id], references: [id])
  
  @@unique([template_id, account_id])
}

// 3. ОБНОВИТЬ Organization — добавить поля онбординга
model Organization {
  // ... существующие поля ...
  
  onboarding_status   OnboardingStatus  @default(PENDING)
  onboarding_step     Int               @default(1)  // 1,2,3 для resume
  template_key        String?           // выбранный шаблон
  ai_description      String?           // текст описания для AI
}

enum OnboardingStatus {
  PENDING          // создана, онбординг не завершён
  IN_PROGRESS      // пользователь на каком-то шаге
  COMPLETED        // онбординг завершён
}

// 4. ОБНОВИТЬ Account — добавить связь с мастером и флаг активности  
model Account {
  // ... существующие поля ...
  
  master_account_id  String?           // FK → MasterAccount (null = кастомный)
  is_active          Boolean           @default(true)  // чекбокс в настройках
  is_custom          Boolean           @default(false) // добавлен вручную
  
  master_account     MasterAccount?    @relation(fields: [master_account_id], references: [id])
}

// 5. ОБНОВИТЬ User — активная организация
model User {
  // ... существующие поля ...
  
  active_org_id      String?           // ID текущей активной org
}

// 6. AUDIT LOG (enterprise-обязательный)
model AuditLog {
  id              String   @id @default(uuid())
  organization_id String
  user_id         String
  action          String   // "CREATE_TRANSACTION", "TOGGLE_ACCOUNT" etc.
  entity_type     String   // "Transaction", "Account"
  entity_id       String?
  payload         Json?    // snapshot до/после
  ip_address      String?
  created_at      DateTime @default(now())
  
  @@index([organization_id])
  @@index([created_at])
}

// 7. AI CHAT HISTORY (для контекста и аналитики)
model ChatMessage {
  id              String   @id @default(uuid())
  organization_id String
  user_id         String
  role            String   // "user" | "assistant"
  content         String
  tokens_used     Int?
  created_at      DateTime @default(now())
  
  @@index([organization_id])
}
```

---

## Полная карта роутов (новые + обновлённые)

```
AUTH
├── POST /api/auth/register          ← НОВЫЙ
├── POST /api/auth/login             ← существует
├── POST /api/auth/logout            ← существует
└── POST /api/auth/switch-org        ← НОВЫЙ (смена активной org)

ONBOARDING
├── GET/POST /api/onboarding/org              ← НОВЫЙ
├── GET/POST /api/onboarding/template         ← НОВЫЙ
└── POST     /api/onboarding/ai-setup         ← НОВЫЙ (AI подбор счетов)

ORGANIZATIONS
├── GET    /api/organizations                  ← НОВЫЙ (список орг пользователя)
├── POST   /api/organizations                  ← НОВЫЙ (создать новую)
└── GET    /api/organizations/:id              ← НОВЫЙ

ACCOUNTS (обновить существующий)
├── GET    /api/accounts                       ← фильтровать is_active=true
├── GET    /api/accounts?include_inactive=true ← для настроек
└── PATCH  /api/accounts/:id/toggle            ← НОВЫЙ (чекбокс)

MASTER (глобальный COA — read-only для клиента)
└── GET    /api/master-accounts                ← НОВЫЙ

SETTINGS (НОВЫЙ раздел)
├── GET    /api/settings                       ← существующий SystemSettings +
├── PATCH  /api/settings                       ← расширить
└── GET    /api/settings/accounts              ← полный список с чекбоксами

AI
├── POST   /api/ai/chat                        ← НОВЫЙ (чат в журнале)
└── POST   /api/ai/suggest-accounts            ← НОВЫЙ (онбординг)

TEMPLATES (read-only)
└── GET    /api/templates                      ← НОВЫЙ
```

---

## Архитектура AI-модулей

### Модуль A: Чат-ассистент по проводкам

```typescript
// Контракт запроса
POST /api/ai/chat
{
  message: string,
  history: [{role, content}]  // последние 10 сообщений
}

// System prompt (формируется динамически)
`Ты бухгалтерский ассистент системы Contador. 
Работаешь по узбекскому национальному плану счетов.
Отвечай ТОЛЬКО на вопросы о проводках и бухгалтерии.

План счетов этой организации:
${accounts.map(a => `${a.code} — ${a.name} (${a.type})`).join('\n')}

Когда отвечаешь на вопрос о проводке, всегда указывай:
1. Дебет: [код] — [название]
2. Кредит: [код] — [название]  
3. Краткое объяснение почему именно эти счета`
```

**Оптимизация токенов:** передавать только `is_active = true` счета организации (не весь мастер-список).

### Модуль B: AI-подбор счетов при онбординге

```typescript
// Промпт строго структурированный — возвращает только JSON
`Ты эксперт по узбекскому бухгалтерскому учету.
Пользователь описывает свой бизнес. Твоя задача — выбрать 
подходящие счета из мастер-списка.

Описание бизнеса: "${userDescription}"

Полный список доступных счетов (JSON):
${JSON.stringify(masterAccounts)}

Верни ТОЛЬКО валидный JSON без пояснений:
{
  "selected_codes": ["1010", "5110", ...],
  "reasoning": "краткое обоснование выбора"
}`

// После получения ответа:
// 1. JSON.parse(response)
// 2. Валидация — все коды существуют в MasterAccount
// 3. Создание Account записей для организации
// 4. Показать пользователю список на подтверждение
```

---

## UI-маршруты (новые страницы)

```
/register                    ← форма регистрации
/onboarding                  ← redirect → /onboarding/step-1
/onboarding/step-1           ← название организации
/onboarding/step-2           ← выбор шаблона (карточки с иконками)
/onboarding/step-3/industry  ← выбор отрасли (если шаблон)
/onboarding/step-3/ai        ← форма описания (если AI)
/onboarding/step-3/confirm   ← подтверждение списка счетов от AI
/settings                    ← основные настройки (существующий расширить)
/settings/accounts           ← управление счетами (чекбоксы)
```

---

## Поэтапный план реализации

```
══════════════════════════════════════════════════════
ФАЗА 0 — Миграция БД (без ломающих изменений) — 1 день
══════════════════════════════════════════════════════
[ ] Добавить MasterAccount, IndustryTemplate, IndustryTemplateItem
[ ] Добавить поля в Organization (onboarding_status, template_key)
[ ] Добавить поля в Account (master_account_id, is_active, is_custom)
[ ] Добавить active_org_id в User
[ ] Добавить AuditLog, ChatMessage
[ ] Написать seed: перенести существующие Account → MasterAccount
[ ] ВАЖНО: is_active = true для всех существующих, онбординг = COMPLETED

══════════════════════════════════════════════════════
ФАЗА 1 — Управление организациями и сессией — 1 день  
══════════════════════════════════════════════════════
[ ] GET /api/organizations — список org текущего user
[ ] POST /api/organizations — создание новой org
[ ] POST /api/auth/switch-org — смена active_org_id
[ ] Хедер: дропдаун переключения организаций
[ ] Middleware: читать active_org_id из User, а не из JWT напрямую

══════════════════════════════════════════════════════
ФАЗА 2 — Регистрация — 0.5 дня
══════════════════════════════════════════════════════
[ ] POST /api/auth/register (email, password, name)
[ ] Страница /register
[ ] После регистрации → redirect на /onboarding

══════════════════════════════════════════════════════
ФАЗА 3 — Шаблоны (данные от тебя) — 1 день
══════════════════════════════════════════════════════
[ ] Получить от тебя мастер-список счетов → seed в MasterAccount
[ ] Получить от тебя 11 отраслевых наборов → seed в IndustryTemplate
[ ] GET /api/templates — публичный эндпоинт
[ ] GET /api/master-accounts — для AI онбординга

══════════════════════════════════════════════════════
ФАЗА 4 — Онбординг (без AI) — 1-2 дня
══════════════════════════════════════════════════════
[ ] Step 1: /onboarding/step-1 — название org
[ ] Step 2: /onboarding/step-2 — выбор режима
[ ] Step 3a: выбор отрасли → копирование счетов из шаблона в Account
[ ] Step 3b: полный шаблон → все MasterAccount → Account
[ ] onboarding_status = COMPLETED → redirect /journal
[ ] Resume onboarding: если статус IN_PROGRESS → вернуть на нужный шаг

══════════════════════════════════════════════════════
ФАЗА 5 — Страница настроек счетов — 1 день
══════════════════════════════════════════════════════
[ ] /settings/accounts — список всех MasterAccount с чекбоксами
[ ] Группировка по разделам (1xxx, 2xxx, 3xxx...)
[ ] PATCH /api/accounts/:id/toggle — is_active flip
[ ] Добавить счёт вручную (is_custom = true)
[ ] Блокировка снятия чекбокса если есть транзакции по счету

══════════════════════════════════════════════════════
ФАЗА 6 — AI онбординг — 1-2 дня
══════════════════════════════════════════════════════
[ ] /onboarding/step-3/ai — форма с шаблоном текста
[ ] POST /api/ai/suggest-accounts — вызов Anthropic API
[ ] Страница подтверждения с возможностью правки списка
[ ] Сохранение выбранных счетов → Account
[ ] Fallback: если AI вернул невалидный JSON → показать ошибку + 
    предложить выбрать шаблон

══════════════════════════════════════════════════════
ФАЗА 7 — AI чат в журнале — 1 день
══════════════════════════════════════════════════════
[ ] POST /api/ai/chat — с динамическим промптом
[ ] Сохранение истории в ChatMessage (для контекста)
[ ] Компонент AIChat — поле ввода + список сообщений
[ ] Rate limiting: не более 50 запросов/org/день (защита от перерасхода)
[ ] Передавать только is_active счета в промпт

══════════════════════════════════════════════════════
ФАЗА 8 — Enterprise-обязательное (не пропускать!) — 1 день
══════════════════════════════════════════════════════
[ ] AuditLog: писать при создании/удалении транзакций
[ ] AuditLog: писать при изменении настроек и счетов
[ ] Rate limiting на /api/ai/* эндпоинты
[ ] Валидация: нельзя деактивировать счёт с транзакциями
[ ] Error boundary: если AI недоступен — graceful fallback
```

---

## Что ты мог упустить (критически важно)

**1. Защита от удаления счёта с транзакциями** — перед `is_active = false` проверять `Transaction.count(debit_id | credit_id)`. Иначе сломаются все отчёты.

**2. Resume онбординга** — если закрыл браузер на шаге 2, при следующем входе видит `/onboarding/step-2`, а не `/journal`. Хранится в `onboarding_step`.

**3. Rate limiting на AI** — без лимита один пользователь может сжечь весь месячный бюджет API за день.

**4. Подтверждение AI-списка** — AI никогда не сохраняет счета автоматически. Всегда показывается экран подтверждения, где пользователь может снять ненужные.

**5. SystemSettings автосоздание** — при создании новой организации в фазе 4 обязательно создавать дефолтный `SystemSettings` в той же транзакции.

**6. Переключение орг в JWT** — не перевыпускать JWT при смене орг. Правильнее: `active_org_id` хранить в БД (`User.active_org_id`) и читать его в `getActiveOrganizationId()`.




# Enterprise-Grade Implementation Plan: Contador v2.0

## Переработанные пункты с обоснованием из индустрии

---

### Пункт 1 — Защита счёта с транзакциями

**Было:** `проверять Transaction.count() → запретить is_active = false`

**Стандарт индустрии:**
Всё, что касается финансовых транзакций, требует soft delete. Налоговые проверки не принимают во внимание факт удаления — они требуют полную историю. Soft delete сохраняет ссылочную целостность: связи не рвутся, foreign keys не ломаются, JOIN-запросы продолжают работать.

**Enterprise-решение:**

```
Уровень 1 — Блокировка деактивации
  PATCH /api/accounts/:id/toggle
  → Если count(transactions) > 0: запрет + сообщение
    "Счёт используется в N проводках. Деактивация невозможна."

Уровень 2 — Archive вместо Delete  
  Добавить status: ACTIVE | ARCHIVED (не boolean)
  ARCHIVED счета: скрыты в UI, видны в отчётах, 
  не доступны в SearchableSelect при новых проводках

Уровень 3 — Retention Policy
  AuditLog хранится минимум 7 лет (требование налогового учёта УЗ)
  Транзакции: НИКОГДА не hard delete, только is_deleted = true
```

---

### Пункт 2 — Resume онбординга

**Было:** `хранить onboarding_step в Organization`

**Стандарт индустрии — State Machine:**

```
Онбординг = конечный автомат с явными переходами

STATES:
  PENDING → ORG_CREATED → TEMPLATE_SELECTED → 
  ACCOUNTS_CONFIRMED → SETTINGS_CONFIGURED → COMPLETED

В БД: onboarding_state (enum), не просто шаг-цифра

Middleware логика:
  if (org.onboarding_state !== 'COMPLETED') {
    redirect('/onboarding/' + STATE_TO_ROUTE[org.onboarding_state])
  }

Защита: нельзя перепрыгнуть шаг — каждый переход 
валидируется на сервере
```

---

### Пункт 3 — Rate Limiting на AI (самое важное)

**Было:** `не более 50 запросов/org/день`

**Стандарт индустрии 2025:**

В LLM-системах не все запросы одинаковы по стоимости. Короткий промпт к небольшой модели потребляет минимум ресурсов, а длинный запрос к большой модели может потребить значительное время GPU. Из-за этой вариативности современные платформы применяют лимиты по нескольким измерениям одновременно, а не только по количеству запросов.

Два запроса к одному LLM-эндпоинту могут отличаться по потреблению ресурсов на порядки. Промпт из 50 токенов и промпт из 10 000 токенов — это одинаково «1 запрос», но compute-стоимость, задержка и расходы провайдера принципиально разные.

**Enterprise-решение — Token-Aware Rate Limiting:**

```prisma
// Добавить в схему
model AiUsage {
  id              String   @id @default(uuid())
  organization_id String
  user_id         String
  feature         String   // "chat" | "onboarding_suggest"
  tokens_input    Int
  tokens_output   Int
  cost_usd        Decimal  @db.Decimal(10, 6)
  created_at      DateTime @default(now())

  @@index([organization_id, created_at])
}
```

```
Многоуровневая система лимитов:

  Уровень 1 — Per Request:
    max_tokens input:  2000 (промпт + COA)
    max_tokens output: 500  (ответ ассистента)
  
  Уровень 2 — Per Organization/Day:
    Токенов в сутки: 50 000 input + 10 000 output
    При достижении 80%: warning в UI
    При 100%: graceful block + "лимит исчерпан"
  
  Уровень 3 — Per Organization/Month:
    Бюджет в $: задаётся в SystemSettings (ai_monthly_budget_usd)
    Записывать реальную стоимость каждого запроса в AiUsage
    
  Проверка ПЕРЕД запросом к Anthropic API:
    1. Считать today_tokens из AiUsage
    2. Если > лимита → 429 с понятным сообщением
    3. Если OK → запрос → записать usage в AiUsage
```

---

### Пункт 4 — Подтверждение AI-списка

**Было:** `показать экран подтверждения`

**Стандарт индустрии — Structured Output + Validation:**

```
Паттерн: AI предлагает → пользователь подтверждает → 
         система валидирует → только потом сохраняет

Промпт возвращает строго JSON:
{
  "selected_codes": ["1010", "1210", ...],
  "reasoning": "Обоснование на 2-3 предложения",
  "confidence": 0.92
}

Серверная валидация ОБЯЗАТЕЛЬНА:
  - Каждый код существует в MasterAccount ✓
  - Нет дублей ✓
  - Минимум счетов: 5 (иначе AI явно ошибся) ✓
  - Если confidence < 0.7 → показать warning пользователю

UI экрана подтверждения:
  - Счета сгруппированы по разделам (1xxx, 2xxx...)
  - Каждый можно снять чекбоксом
  - Кнопка "Добавить счёт вручную" (из MasterAccount)
  - Только после нажатия "Подтвердить" → INSERT в Account
```

---

### Пункт 5 — SystemSettings автосоздание

**Было:** `создавать в той же транзакции`

**Стандарт — Database Transaction + Repository Pattern:**

```typescript
// Всё создание организации — одна атомарная операция
await prisma.$transaction(async (tx) => {
  const org = await tx.organization.create({ ... })
  
  await tx.systemSettings.create({
    data: {
      organization_id: org.id,
      opening_balance_date: new Date(),
      closed_period_date: new Date(),
      is_initial_balance_fixed: false,
      ai_monthly_budget_usd: 5.00  // дефолтный бюджет
    }
  })
  
  await tx.auditLog.create({
    data: {
      organization_id: org.id,
      action: 'ORGANIZATION_CREATED',
      entity_type: 'Organization',
      entity_id: org.id
    }
  })
  
  return org
})
// Если любой из шагов упал — всё откатывается
```

---

### Пункт 6 — Переключение организаций в JWT

**Было:** `хранить active_org_id в User в БД`

**Стандарт индустрии:**

Если пользователи могут принадлежать более чем одной организации, нужен способ определить, в каком тенантном контексте они работают в данный момент. Это можно отслеживать через поле на аккаунте пользователя, хранящее активный тенант, или через выделенную mapping-таблицу. При использовании JWT-аутентификации детали активного тенанта могут храниться в claims токена.

Критическая ошибка — JWT без tenant claims: токены, содержащие user_id, но не tenant_id. Это оставляет приложение определять контекст из URL или сессии, что открывает возможность для tenant-switching атак.

**Enterprise-решение — гибридная схема:**

```
Не выбирать между "JWT" и "БД" — правильно использовать оба:

JWT (короткоживущий, 15 минут):
  { userId, active_org_id, org_ids[], role, exp }
  Содержит active_org_id → не нужен DB lookup на каждый запрос

Refresh Token (долгоживущий, 7 дней, в httpOnly cookie):
  Хранится хеш в БД в таблице RefreshToken
  При смене org: 
    1. PATCH /api/auth/switch-org { org_id }
    2. Сервер проверяет: org_id входит в org_ids пользователя
    3. Обновляет User.active_org_id в БД
    4. Выпускает новый JWT с новым active_org_id
    5. Старый JWT истекает через 15 минут сам

Это стандарт от Clerk, WorkOS, Auth0 для multi-org SaaS
```

---

## Добавленные пункты — что было пропущено

### Пункт 7 — Tenant Isolation на уровне Middleware (КРИТИЧНО)

Система является по-настоящему мультитенантной только если невозможно случайно проигнорировать tenant-границы. Каждый кусок данных должен принадлежать ровно одному тенанту. Каждый запрос выполняется в tenant-контексте. Каждый путь чтения/записи принудительно применяет этот контекст.

```typescript
// src/lib/prisma-tenant.ts — обёртка над Prisma
// ВЕСЬ доступ к данным только через неё

class TenantPrismaClient {
  constructor(private orgId: string) {}
  
  // Автоматически добавляет WHERE organization_id = orgId
  // к КАЖДОМУ запросу
  get transactions() {
    return {
      findMany: (args) => prisma.transaction.findMany({
        ...args,
        where: { ...args?.where, organization_id: this.orgId }
      })
      // ... и т.д. для всех методов
    }
  }
}
```

### Пункт 8 — Onboarding Completion Guard

```
Бизнес-правило: пользователь без завершённого онбординга
НЕ ДОЛЖЕН видеть /journal, /osv, /pnl

В middleware.ts добавить:
  if (path не начинается с /onboarding && 
      path не начинается с /login &&
      org.onboarding_state !== 'COMPLETED') {
    redirect('/onboarding')
  }
```

### Пункт 9 — AI Prompt Caching (экономия до 90% стоимости)

Prompt caching может снизить затраты на повторяющиеся входные данные и задержку у поддерживаемых провайдеров. Проектируйте промпты со стабильными префиксами для получения максимальной выгоды.

```
Для чата в журнале system prompt почти всегда одинаков:
  - Инструкции ассистента (статичны)
  - COA организации (меняется редко)

Использовать Anthropic Prompt Caching:
  system: [{ type: "text", text: systemPrompt, 
             cache_control: { type: "ephemeral" } }]

Экономия: ~90% стоимости input-токенов для повторных запросов
COA кэшируется на 5 минут автоматически
```

---

## Финальный обновлённый план фаз

```
ФАЗА 0 — Миграция БД (атомарная, без breaking changes)
  MasterAccount, IndustryTemplate, IndustryTemplateItem
  Account: + master_account_id, is_active, status (enum)
  Organization: + onboarding_state (State Machine enum)
  User: + active_org_id
  AiUsage (rate limiting + аналитика)
  RefreshToken (для безопасной смены org)
  AuditLog (уже был в плане)

ФАЗА 1 — Tenant-Safe Middleware + Auth переработка
  TenantPrismaClient обёртка
  JWT: userId + active_org_id + org_ids[]
  Refresh token в httpOnly cookie
  POST /api/auth/switch-org

ФАЗА 2 — Регистрация + State Machine онбординга
  /register
  Onboarding State Machine (6 состояний)
  Middleware guard: незавершённый онбординг → redirect

ФАЗА 3 — Шаблоны (данные от тебя)
  Seed MasterAccount
  Seed IndustryTemplate × 22 отрасли
  GET /api/templates

ФАЗА 4 — Онбординг UI (все 3 пути)
  Путь A: полный шаблон
  Путь B: отраслевой шаблон
  Путь C: подготовка к AI (UI без логики)
  $transaction при создании org + SystemSettings

ФАЗА 5 — AI онбординг
  POST /api/ai/suggest-accounts
  Structured output + серверная валидация
  Экран подтверждения с чекбоксами

ФАЗА 6 — Настройки счетов
  /settings/accounts — чекбоксы + группировка
  ARCHIVED статус вместо удаления
  Блокировка если есть транзакции

ФАЗА 7 — AI чат с Rate Limiting
  Token-aware лимиты (AiUsage таблица)
  Prompt Caching для COA
  POST /api/ai/chat
  Graceful degradation при исчерпании лимита

ФАЗА 8 — Audit & Observability
  AuditLog на все мутации
  Дашборд AI-использования в /settings
```

---
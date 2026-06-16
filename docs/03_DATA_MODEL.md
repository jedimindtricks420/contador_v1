# 03 — Модель данных

**Документ:** Data Model Reference  
**Версия:** 2.0  
**Дата:** 2026-06-16  
**БД:** PostgreSQL 16, база `contador_v2`

---

## 1. Схема зависимостей (ERD — текстовый)

```
User ──────────────── OrgMember ─────────────── Organization
                                                      │
                      ┌───────────────────────────────┤
                      │                               │
              BankAccount                           Period
                  │                                   │
         StagedTransaction ─────────────────────── Document ──── JournalEntry
                                │                     │               │
                              Rule              OpenItem          Counterparty
                                │                     │
                         DocumentType            AuditLog
                                │
                            Account
                           (global)

Organization ──── Subscription
             ──── TaxCalendarEvent
             ──── TaxDeadlineTemplate
             ──── PasswordResetToken (через User)
```

---

## 2. Модели данных

### User — Пользователь системы

```prisma
model User {
  id                  String               @id @default(uuid())
  email               String               @unique
  passwordHash        String               // bcrypt, rounds=10
  name                String?
  activeOrgId         String?              // Активная организация (из JWT)
  createdAt           DateTime             @default(now())
  memberships         OrgMember[]
  passwordResetTokens PasswordResetToken[]
}
```

| Поле | Тип | Описание |
|------|-----|---------|
| `id` | UUID | Первичный ключ |
| `email` | String UNIQUE | Логин, уникальный в системе |
| `passwordHash` | String | bcrypt hash (rounds=10) |
| `name` | String? | Отображаемое имя |
| `activeOrgId` | String? | ID текущей организации (хранится в JWT, не в БД) |

---

### Organization — Организация

```prisma
model Organization {
  id                        String    @id @default(uuid())
  name                      String
  inn                       String?              // ИНН (9 цифр)
  taxRegime                 TaxRegime @default(TURNOVER_TAX)
  isVatPayer                Boolean   @default(false)
  activityGroup             String?              // Группа вида деятельности
  activityDescription       String?              // Описание деятельности (для AI)
  activityCustom            String?              // Произвольное описание
  aiConfidenceThreshold     Int       @default(70)   // % порог AI, 0–100
  maxClarificationQuestions Int       @default(10)
  settings                  Json?                // { openItemDeadlines: {...} }
  createdAt                 DateTime  @default(now())
}
```

**settings JSON-структура:**
```json
{
  "openItemDeadlines": {
    "4310": 30,
    "6310": 30,
    "4220": 10,
    "5110_UNIDENTIFIED": 5
  }
}
```

---

### OrgMember — Участник организации

```prisma
model OrgMember {
  id     String  @id @default(uuid())
  role   OrgRole @default(OWNER)
  userId String
  orgId  String
  @@unique([userId, orgId])
}
```

Роли: `OWNER | ADMIN | ACCOUNTANT`

---

### BankAccount — Банковский счёт

```prisma
model BankAccount {
  id            String   @id @default(uuid())
  orgId         String
  name          String              // Название счёта
  currency      String   @default("UZS")  // "UZS" | "USD"
  bankName      String?
  accountNumber String?
  lastBalance   Decimal  @default(0) @db.Decimal(20, 2)
  lastSyncedAt  DateTime?
}
```

---

### Period — Учётный период

```prisma
model Period {
  id          String       @id @default(uuid())
  orgId       String
  year        Int
  month       Int          // 1–12
  mode        PeriodMode   @default(ACTIVE)    // HISTORICAL | ACTIVE
  status      PeriodStatus @default(OPEN)      // OPEN | CLOSED
  lockDate    DateTime?                         // Дата закрытия
  closingData Json?                             // ClosingData (прогресс мастера)
  @@unique([orgId, year, month])
}
```

**closingData JSON-структура:**
```json
{
  "currentStep": 4,
  "accruals": {
    "salaryAmount": 5000000,
    "depreciationAmount": 200000,
    "rentAmount": 1500000
  },
  "fxDiff": {
    "exchangeRate": 12700.5,
    "difference": 15000
  },
  "soliqMatched": {
    "matched": 45,
    "unmatched": 3
  }
}
```

---

### StagedTransaction — Банковская транзакция

```prisma
model StagedTransaction {
  id               String                  @id @default(uuid())
  orgId            String
  bankAccountId    String
  periodId         String
  date             DateTime
  amount           Decimal                 @db.Decimal(20, 2)
  direction        TransactionDirection    // CREDIT | DEBIT
  description      String                  // Назначение платежа
  counterpartyHint String?                 // Контрагент из выписки
  counterpartyInn  String?                 // ИНН из выписки
  hash             String                  // SHA-256 для дедупликации
  status           StagedTransactionStatus @default(IMPORTED)
  aiSuggestion     Json?                   // { categoryId, confidence, ... }
  documentId       String?                 // Если проведена
  importBatchId    String?                 // UUID пакета импорта
  createdAt        DateTime                @default(now())
  @@unique([orgId, hash])
  @@index([orgId, periodId])
  @@index([status])
  @@index([importBatchId])
}
```

**Жизненный цикл статуса:**
```
IMPORTED → AUTO_MATCHED → POSTED
         → NEEDS_CLARIFICATION → CONFIRMED → POSTED
         → SKIPPED
```

**aiSuggestion JSON:**
```json
{
  "categoryId": "uuid-of-document-type",
  "documentTypeCode": "SUPPLIER_PAYMENT",
  "confidence": 85,
  "reason": "Платёж поставщику ООО AGROSERVIS",
  "extractedCounterparty": "ООО AGROSERVIS",
  "extractedInn": "1234567890",
  "vatApplicable": false
}
```

---

### Rule — Правило классификации

```prisma
model Rule {
  id          String        @id @default(uuid())
  orgId       String
  matchType   RuleMatchType  // INN | KEYWORD | AMOUNT_RANGE | TREASURY_ACCOUNT
  matchValue  String
  categoryId  String         // → DocumentType.id
  createdFrom RuleSource     // USER_ANSWER | MANUAL
  order       Int @default(0)
  createdAt   DateTime @default(now())
}
```

**Примеры matchValue:**
- INN: `"301846873"` (9 цифр)
- KEYWORD: `"аренда офис"` (подстрока в description, регистронезависимо)
- AMOUNT_RANGE: `"500000:2000000"` (min:max в сумах)
- TREASURY_ACCOUNT: `"00304272346"` (код казначейства)

---

### Account — Счёт плана счетов (ГЛОБАЛЬНЫЙ)

```prisma
model Account {
  id           String       @id @default(uuid())
  code         String       @unique     // "5110", "9030" и т.д.
  name         String
  type         AccountType  // ASSET | CONTRA_ASSET | LIABILITY | CONTRA_LIABILITY | ACTIVE_PASSIVE | TRANSIT | OFF_BALANCE
  parentId     String?
  isSystem     Boolean @default(true)
  group        String?                  // Раздел НСБУ
  isDeprecated Boolean @default(false)
  layer        AccountLayer @default(CORE)  // CORE | EXTENSION | INDUSTRY
}
```

> **Важно:** Таблица `Account` не имеет `orgId` — счета глобальны для всех организаций. Upsert по `code`.

---

### DocumentType — Тип документа

```prisma
model DocumentType {
  id              String @id @default(uuid())
  code            String @unique    // "REVENUE_VAT", "SUPPLIER_PAYMENT" и т.д.
  name            String
  postingTemplate Json              // PostingTemplate JSON
}
```

**PostingTemplate JSON:**
```json
{
  "lines": [
    {
      "accountCode": "5110",
      "side": "debit",
      "expression": "amount",
      "subcontoType": "counterparty"
    },
    {
      "accountCode": "9030",
      "side": "credit",
      "expression": "amount / (1 + vatRate / 100)"
    },
    {
      "accountCode": "6410",
      "side": "credit",
      "expression": "amount - amount / (1 + vatRate / 100)",
      "condition": "isVatPayer"
    }
  ],
  "opensItem": false,
  "itemAccountCode": null
}
```

---

### Document — Хозяйственный документ

```prisma
model Document {
  id                    String         @id @default(uuid())
  orgId                 String
  periodId              String
  typeId                String          // → DocumentType.id
  date                  DateTime
  status                DocumentStatus  // POSTED | VOIDED
  payload               Json            // Параметры для шаблона
  sourceTransactionId   String?         // Если из StagedTransaction
  correctionForPeriodId String?         // Для корректировочных документов
}
```

**payload JSON (пример для REVENUE_VAT):**
```json
{
  "amount": 1200000,
  "counterpartyInn": "123456789",
  "counterpartyHint": "ООО ROMASHKA",
  "description": "Оплата за услуги"
}
```

---

### JournalEntry — Бухгалтерская проводка

```prisma
model JournalEntry {
  id             String   @id @default(uuid())
  documentId     String   // → Document.id (cascade delete)
  accountId      String   // → Account.id
  debit          Decimal  @db.Decimal(20, 2)
  credit         Decimal  @db.Decimal(20, 2)
  date           DateTime
  counterpartyId String?  // → Counterparty.id (субконто)
  contractId     String?
  @@index([documentId])
  @@index([accountId, date])
}
```

> Правило: для каждой строки либо `debit > 0, credit = 0`, либо `debit = 0, credit > 0`.

---

### OpenItem — Открытая позиция

```prisma
model OpenItem {
  id                String        @id @default(uuid())
  orgId             String
  accountId         String        // Буферный счёт (4220, 4310, 6310, ...)
  counterpartyId    String?
  openingDocumentId String        // Документ-основание
  closingDocumentId String?
  amount            Decimal       @db.Decimal(20, 2)
  dateOpened        DateTime
  dateClosed        DateTime?
  status            OpenItemStatus @default(OPEN)  // OPEN | CLOSED | RISK
  riskDeadline      DateTime?     // Дедлайн → RISK
  affectedPeriodId  String?
  @@index([orgId, status])
}
```

---

### TaxCalendarEvent — Налоговый календарь

```prisma
model TaxCalendarEvent {
  id              String         @id @default(uuid())
  orgId           String
  periodId        String?
  type            TaxEventType   // VAT | PERSONAL_INCOME_TAX | TURNOVER_TAX | PROFIT_TAX | STATISTICS | SOCIAL_TAX
  dueDate         DateTime
  status          TaxEventStatus @default(PENDING)  // PENDING | DONE
  estimatedAmount Decimal?       @db.Decimal(20, 2)
  note            String?
  @@index([orgId, dueDate])
}
```

---

### Subscription — Подписка организации

```prisma
model Subscription {
  id           String   @id @default(uuid())
  orgId        String   @unique
  plan         PlanType @default(FREE)  // FREE | PRO
  validUntil   DateTime?
  customApiKey String?    // Кастомный OpenAI API ключ организации
  updatedAt    DateTime @updatedAt
}
```

---

### AuditLog — Журнал действий

```prisma
model AuditLog {
  id         String   @id @default(uuid())
  orgId      String
  userId     String
  action     String   // "POST_DOCUMENT", "VOID_DOCUMENT", "CLOSE_PERIOD"
  entityType String?  // "Document", "Period" и т.д.
  entityId   String?
  oldValue   Json?
  newValue   Json?
  createdAt  DateTime @default(now())
  @@index([orgId, createdAt])
}
```

---

### PasswordResetToken

```prisma
model PasswordResetToken {
  id        String    @id @default(uuid())
  userId    String
  token     String    @unique
  expiresAt DateTime              // +1 час от создания
  usedAt    DateTime?
  createdAt DateTime  @default(now())
  @@index([token])
}
```

---

## 3. Перечисления (Enums)

| Enum | Значения |
|------|---------|
| `TaxRegime` | `VAT`, `TURNOVER_TAX` |
| `OrgRole` | `OWNER`, `ADMIN`, `ACCOUNTANT` |
| `PeriodMode` | `HISTORICAL`, `ACTIVE` |
| `PeriodStatus` | `OPEN`, `CLOSED` |
| `TransactionDirection` | `CREDIT`, `DEBIT` |
| `StagedTransactionStatus` | `IMPORTED`, `AUTO_MATCHED`, `NEEDS_CLARIFICATION`, `CONFIRMED`, `POSTED`, `SKIPPED` |
| `RuleMatchType` | `INN`, `KEYWORD`, `AMOUNT_RANGE`, `TREASURY_ACCOUNT` |
| `RuleSource` | `USER_ANSWER`, `MANUAL` |
| `AccountType` | `ASSET`, `CONTRA_ASSET`, `LIABILITY`, `CONTRA_LIABILITY`, `ACTIVE_PASSIVE`, `TRANSIT`, `OFF_BALANCE` |
| `AccountLayer` | `CORE`, `EXTENSION`, `INDUSTRY` |
| `DocumentStatus` | `POSTED`, `VOIDED` |
| `OpenItemStatus` | `OPEN`, `CLOSED`, `RISK` |
| `TaxEventType` | `VAT`, `PERSONAL_INCOME_TAX`, `TURNOVER_TAX`, `PROFIT_TAX`, `STATISTICS`, `SOCIAL_TAX` |
| `TaxEventStatus` | `PENDING`, `DONE` |
| `PlanType` | `FREE`, `PRO` |
| `Frequency` | `MONTHLY`, `QUARTERLY`, `ANNUALLY` |

---

## 4. Индексы производительности

| Таблица | Индекс | Назначение |
|---------|--------|-----------|
| `StagedTransaction` | `(orgId, periodId)` | Выборка транзакций периода |
| `StagedTransaction` | `(status)` | Фильтр по статусу |
| `StagedTransaction` | `(importBatchId)` | Откат пакета импорта |
| `StagedTransaction` | `UNIQUE(orgId, hash)` | Дедупликация |
| `Document` | `(orgId, periodId)` | Документы периода |
| `Document` | `(orgId, date)` | Документы по дате |
| `JournalEntry` | `(documentId)` | Проводки документа |
| `JournalEntry` | `(accountId, date)` | ОСВ по счёту |
| `JournalEntry` | `(counterpartyId)` | Субконто |
| `OpenItem` | `(orgId, status)` | Открытые позиции |
| `TaxCalendarEvent` | `(orgId, dueDate)` | Ближайшие сроки |
| `Period` | `UNIQUE(orgId, year, month)` | Уникальность периода |
| `Account` | `UNIQUE(code)` | Уникальность кода счёта |

---

## 5. Управление схемой БД

```bash
# Создать новую миграцию
cd /home/admin1/contador/v2
npx prisma migrate dev --name <migration_name>

# Применить миграции на production
npx prisma migrate deploy

# Просмотр схемы в браузере
npx prisma studio

# Синхронизация клиента после изменений схемы
npx prisma generate
```

---

*Дата: 2026-06-16*

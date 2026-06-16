# contador — Описание проекта

**Версия:** 2.0 (v2 активна)
**Дата обновления:** 2026-06-16
**URL (локальный):** http://localhost:3032 (v2) / http://localhost:3030 (v1 legacy)

---

## Что это

**contador** (исп. «бухгалтер») — SaaS-система двойной записи для малого и среднего бизнеса Узбекистана. Реализует полный цикл ежемесячного бухгалтерского учёта: импорт банковских выписок → AI-классификация → проводки → закрытие месяца → отчётность — всё в браузере.

Соответствует **НСБУ №21** (Национальные стандарты бухгалтерского учёта Республики Узбекистан).

---

## Технологический стек (v2 — основная)

| Слой | Технология |
|------|-----------|
| Фреймворк | Next.js 16.2.1 (App Router, basePath: /v2) |
| UI | React 19 + Tailwind CSS 4 |
| Язык | TypeScript 5 |
| ORM / БД | Prisma 6 + PostgreSQL 16 |
| Аутентификация | JWT (jose) + bcryptjs, HTTP-only cookies, 7 дней |
| AI | OpenAI GPT-4o-mini (`openai` SDK v4) |
| Графики | Recharts |
| Арифметика | Decimal.js (финансовая точность) |
| Тесты | Vitest |
| Деплой | PM2 (process: `contador-v2`, port 3032) |

---

## Приложения в составе проекта

### v2 — Основное приложение (порт 3032)

Документоцентричный рабочий процесс: каждая банковская транзакция превращается в Документ, Документ проводится по шаблону и создаёт проводки (JournalEntry).

**Ключевой цикл:**
```
Банковская выписка → StagedTransaction → Document → JournalEntry → Отчёты
                             ↑                 ↑
                    Правила + AI          Шаблон проводки
```

### v1 — Legacy (порт 3030)

AI-чат ассистент: пользователь описывает операцию текстом, GPT-4o создаёт проводку. Работает параллельно с v2. Не развивается.

### Admin-панель (порт 3031)

Express.js приложение для управления платёжными интеграциями (Payme, Click), подписками, организациями. Доступна по паролю из `.env`.

---

## Модель данных (v2, БД: contador_v2)

### Основные модели

| Модель | Назначение |
|--------|-----------|
| `User` | Пользователь (email, passwordHash, activeOrgId) |
| `Organization` | Компания/ИП (ИНН, налоговый режим, VAT-флаг, порог AI) |
| `OrgMember` | Членство (роли: OWNER / ACCOUNTANT / ADMIN) |
| `Period` | Учётный период (год + месяц, статус OPEN / CLOSED, closingData JSON) |
| `BankAccount` | Банковский счёт (UZS / USD, lastBalance) |
| `StagedTransaction` | Импортированная транзакция (статусный конвейер) |
| `Account` | Глобальный план счетов НСБУ (код уникален, 7 типов) |
| `Document` | Документ (тип + период + дата + payload JSON + статус) |
| `DocumentType` | Тип документа + шаблон проводки (postingTemplate JSON) |
| `JournalEntry` | Проводка (accountId, debit, credit, date, counterpartyId) |
| `Rule` | Правило классификации (matchType, matchValue, categoryId, priority) |
| `OpenItem` | Открытая позиция (аванс / подотчёт / депозит; статус OPEN/CLOSED/RISK) |
| `Counterparty` | Контрагент (name, inn) |
| `TaxCalendarEvent` | Событие налогового календаря (тип, срок, статус, сумма) |
| `TaxDeadlineTemplate` | Шаблон сроков уплаты (настраивается на уровне организации) |
| `AuditLog` | Аудит действий (action, oldValue, newValue) |
| `Subscription` | Подписка (FREE / PRO, validUntil, customApiKey) |
| `PasswordResetToken` | Токен сброса пароля (UUID, expiresAt) |

### Конвейер статусов StagedTransaction

```
IMPORTED → AUTO_MATCHED ──────────────────► POSTED
         → NEEDS_CLARIFICATION → CONFIRMED → POSTED
         → SKIPPED
```

### Типы счетов (AccountType)

| Тип | Описание | Нормальное сальдо |
|-----|----------|------------------|
| `ASSET` | Активный | Дебетовое |
| `CONTRA_ASSET` | Контр-активный (износ, резервы) | Кредитовое |
| `LIABILITY` | Пассивный / доходный / капитал | Кредитовое |
| `CONTRA_LIABILITY` | Контр-пассивный | Дебетовое |
| `ACTIVE_PASSIVE` | Активно-пассивный | Любое |
| `TRANSIT` | Транзитный (закрывается в конце периода) | Нулевое |
| `OFF_BALANCE` | Забалансовый | Только обороты |

---

## Функциональность (v2)

### 1. Мультиорганизационность
Один пользователь — несколько организаций. Переключение через cookie `activeOrgId`. Полная изоляция данных на уровне приложения (все запросы фильтруются по `orgId`).

### 2. Импорт банковских выписок
- Форматы: 1CClientBankExchange (.txt), Excel (Asaka, Kapital, Ipak Yoli)
- Дедупликация по SHA-256 (поле `hash`): повторный импорт безопасен
- Группировка по `importBatchId` — возможность отката всего пакета
- Preview-режим: первые 5 строк без записи в БД

### 3. AI-классификация (движок правил + GPT-4o-mini)

**Движок правил** (`src/lib/classification/rulesEngine.ts`):
- In-memory кэш (30 сек TTL)
- Приоритет: INN → KEYWORD → AMOUNT_RANGE → TREASURY_ACCOUNT
- Точное совпадение → DocumentType ID

**AI-классификатор** (`src/lib/classification/aiClassifier.ts`):
- Модель: gpt-4o-mini, батчи до 20 транзакций
- Входные данные: описание операции, контрагент, ИНН, сумма, налоговый режим
- Порог уверенности: `org.aiConfidenceThreshold` (по умолчанию 70%)
- ≥70% → AUTO_MATCHED; <70% → NEEDS_CLARIFICATION

**Очередь уточнений** (`ClarificationQueue.tsx`):
- Группировка по контрагенту
- Пользователь выбирает DocumentType
- Опция «запомнить выбор» создаёт новое правило (createdFrom: USER_ANSWER)

### 4. Движок проводок

Единственная точка создания JournalEntry в системе (`src/lib/posting/postingEngine.ts`):
1. Разбор шаблона `DocumentType.postingTemplate`
2. Вычисление сумм через expression evaluator (Decimal.js)
3. Создание JournalEntry[] в одной транзакции БД
4. Проверка баланса Σ Дт = Σ Кт
5. Создание OpenItem для буферных типов (если `opensItem: true`)
6. Запись в AuditLog

### 5. Мастер закрытия месяца (7 шагов)

| Шаг | Компонент | Действие |
|-----|-----------|---------|
| 1 | Step1Import | Загрузка банковской выписки |
| 2 | ClarificationQueue | AI-классификация + ответы на вопросы |
| 3 | Step3Registry | Проверка реестра документов |
| 4 | Step4Accruals | Начисления: ФОТ, амортизация, аренда |
| 5 | Step5FxDiff | Курсовые разницы (USD ↔ UZS) |
| 6 | Step6Soliq | Сверка с реестром Soliq (ЭСФ) |
| 7 | Step7Summary | Финализация: расчёт налогов, закрытие периода |

Состояние мастера сохраняется в `Period.closingData` (JSON) — при возврате прогресс сохранён.

### 6. Отчёты

| Отчёт | Маршрут | Источник данных |
|-------|---------|----------------|
| Дашборд (KPI) | `/api/dashboard` | JournalEntry, Period, OpenItem |
| P&L | `/api/pnl` | JournalEntry по счетам 90xx/91xx/94xx/98xx |
| Cashflow | `/api/cashflow` | JournalEntry по счетам 5110/5210 |
| ОСВ | `/api/reports/osv` | JournalEntry, Account, Period |
| Журнал | `/api/reports/journal` | JournalEntry, Document, Account |
| Карточка счёта | `/api/reports/account-card` | JournalEntry по счёту |
| Субконто | `/api/reports/subconto` | JournalEntry, Counterparty |
| Баланс | `/api/reports/balance` | JournalEntry, Account |

### 7. Открытые позиции

- Авансы полученные / выданные, подотчёт, депозиты
- Автоматическая установка статуса RISK по истечении дедлайна
- Дедлайны: 10 дней (подотчёт 4220), 30 дней (авансы 4310/6310/6990), 365 дней (депозиты 5830/6820)
- Ручное закрытие и повторное открытие

### 8. Налоговый календарь

- Шаблоны сроков уплаты налогов (ежемесячно / ежеквартально / ежегодно)
- Автоматическое создание TaxCalendarEvent при закрытии периода
- Отображение на дашборде: ближайшие 5 сроков

### 9. Безопасность

- JWT в HTTP-only cookie (`v2_session`), срок 7 дней
- bcryptjs — хеширование паролей
- Middleware — защита всех маршрутов кроме `/v2/login`, `/v2/register`, `/v2/forgot-password`, `/v2/reset-password`
- Изоляция тенантов на уровне приложения (каждый запрос фильтруется по `orgId`)
- Роли: OWNER (полный доступ), ADMIN (управление орг.), ACCOUNTANT (только данные)

---

## Известные ограничения

- Парсеры Excel (Asaka, Kapital, Ipak Yoli) частично реализованы — протестированы на реальных файлах
- SMTP не активирован на продакшн-сервере (email-уведомления не работают)
- Биллинг (Payme, Click) доступен только через Admin-панель, UI для самообслуживания не реализован
- Баланс-отчёт (форма 1) — заглушка, полная реализация в разработке

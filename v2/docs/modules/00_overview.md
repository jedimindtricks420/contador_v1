# Contador v2 — Обзор модулей

**Статус приложения:** ✅ Реализован (продакшн на порту 3032)  
**Принцип работы:** Документоцентричная модель — банковская выписка → классификация → Документы → Проводки → Отчёты  
**Главный цикл:** Закрыть месяц: загрузить выписку → ответить на вопросы AI → финализировать  
**Последнее обновление:** 2026-07-01

---

## Инфраструктура

- **Фреймворк:** Next.js App Router, `basePath = /v2`
- **Навигация:** `router.push("/dashboard")` → браузер открывает `/v2/dashboard` (basePath добавляется автоматически)
- **API-запросы:** `fetch()` **не** добавляет basePath автоматически — все вызовы в коде явно используют `/v2/api/...`
- **Продакшн:** порт 3032, nginx `location /v2/` → `proxy_pass` к Next.js
- **База данных:** PostgreSQL 16 через Prisma ORM

---

## Статус модулей

| Модуль | Файл | Статус |
|--------|------|--------|
| A. Импорт данных | [module_A_import.md](module_A_import.md) | ✅ Реализован |
| B. Классификация операций | [module_B_classification.md](module_B_classification.md) | ✅ Реализован |
| C. Реестр и документы | [module_C_registry.md](module_C_registry.md) | ✅ Реализован |
| D. Открытые позиции | [module_D_open_items.md](module_D_open_items.md) | ✅ Реализован |
| E. Закрытие месяца | [module_E_closing.md](module_E_closing.md) | ✅ Реализован |
| F. Дашборды | [module_F_dashboards.md](module_F_dashboards.md) | ✅ Реализован |
| G. Бухгалтерские отчёты | [module_G_reports.md](module_G_reports.md) | ✅ Реализован |
| K. Профиль и биллинг | [module_K_billing.md](module_K_billing.md) | ✅ Реализован |
| H. Движок проводок | [module_H_posting_engine.md](module_H_posting_engine.md) | ✅ Реализован |
| L. Справочник категорий (DocumentType) | [module_DOCUMENT_TYPES.md](module_DOCUMENT_TYPES.md) | ✅ Реализован |
| I. Авторизация и организации | [module_I_auth.md](module_I_auth.md) | ✅ Реализован |
| J. Настройки и справочники | [module_J_settings.md](module_J_settings.md) | ✅ Реализован |

---

## Конвейер данных

```
[.txt / .xlsx файл] (банковская выписка)
       │
       ▼
  Парсер (A) — 1C / Excel банков
       │
       ▼
  StagedTransaction (status=IMPORTED, hash=SHA-256)
       │
       ├──► Движок правил (B) → AUTO_MATCHED
       │        │ нет совпадения
       │        ▼
       │    AI-классификатор GPT-4o-mini (B)
       │        │ confidence ≥ порог → AUTO_MATCHED
       │        │ confidence < порог → NEEDS_CLARIFICATION
       │        ▼
       │    Очередь уточнений (B) → пользователь выбирает тип
       │                          → опционально создаётся Rule
       │
       ▼
  Document (typeId + payload JSON + status=POSTED)
       │
       ▼
  [Движок проводок (H)] — шаблон postingTemplate
       │
       ├──► JournalEntry[] (Дт / Кт / сумма)
       └──► OpenItem (если template.opensItem=true — аванс, подотчёт)
               │
               ▼
       Отчёты (G): ОСВ, Форма №2 (P&L), Форма №1 (Баланс), Журнал...
```

---

## Схема маршрутов (URL)

Все пути с префиксом `/v2/`:

| Путь | Модуль | Компонент |
|------|--------|-----------|
| `/dashboard` | F | DashboardClient.tsx |
| `/transactions` | C | TransactionsClient.tsx |
| `/cashflow` | F | CashFlowClient.tsx |
| `/pnl` | G | PnLClient.tsx (Форма №2) |
| `/accounts` | F | AccountsClient.tsx (банк. счета) |
| `/open-positions` | D | OpenPositionsClient.tsx |
| `/closing` | E | ClosingWizard.tsx (7 шагов) |
| `/reports/balance` | G | page.tsx (Форма №1) |
| `/reports/osv` | G | OSVClient.tsx |
| `/reports/journal` | G | JournalClient.tsx |
| `/reports/account-card` | G | AccountCardClient.tsx |
| `/reports/account-analysis` | G | AccountAnalysisClient.tsx |
| `/reports/subconto` | G | SubcontoClient.tsx |
| `/settings` | J | Настройки организации |
| `/settings/rules` | J | Правила классификации |
| `/settings/accounts` | J | Видимость счетов |
| `/settings/tax-calendar` | J | Налоговый календарь |
| `/settings/members` | I | Участники организации |
| `/settings/open-items-deadlines` | D | Сроки риска позиций |
| `/profile` | K | Профиль, тариф, биллинг |
| `/login` | I | Авторизация |
| `/register` | I | Регистрация |
| `/forgot-password` | I | Сброс пароля |

---

## Иерархия зависимостей

```
I (Auth) ←── все модули (аутентификация)
H (Posting) ←── B, C, E (создание проводок)
A (Import) ←── B (классификация получает транзакции)
B (Classification) ←── C, E (реестр и закрытие)
H (Posting) → D (открытые позиции)
H (Posting) → G (отчёты читают JournalEntry)
E (Closing) → F (дашборд показывает статус)
J (Settings) ← B (правила), E (налоговый календарь)
K (Billing) ← B, AI reconcile (PRO-гейт через getUserActivePro)
```

---

## Ключевые константы (`src/lib/constants.ts`)

| Константа | Значение | Описание |
|-----------|---------|---------|
| `ACCOUNTS.RETAINED_EARNINGS` | `"8710"` | Нераспределённая прибыль |
| `ACCOUNTS.FINAL_RESULT` | `"9910"` | Финансовый результат |
| `ACCOUNTS.FX_INCOME` | `"9540"` | Доход от курсовой разницы |
| `ACCOUNTS.FX_EXPENSE` | `"9620"` | Расход от курсовой разницы |
| `ACCOUNTS.PAYROLL` | `"6710"` | Расчёты по зарплате |
| `ACCOUNTS.PAYABLES` | `"6010"` | Кредиторы — поставщики |
| `ACCOUNTS.ADVANCE_RECEIVED` | `"6310"` | Авансы полученные |
| `ACCOUNTS.ADVANCE_PAID_GOODS` | `"4310"` | Авансы выданные поставщикам |
| `MARKETPLACE_INNS` | `["302179836", ...]` | ИНН маркетплейсов |
| `TRANSIT_INNS` | `Set<string>` | Транзитные ИНН (казначейство и др.) |

---

## Полная функциональность

| Функция | Статус |
|---------|--------|
| Парсер 1C банковской выписки | ✅ |
| Excel-парсеры (Asaka, Kapital, Ipak Yoli) | ✅ |
| Soliq Excel импорт | ✅ |
| Движок правил (INN/KEYWORD/AMOUNT/TREASURY) | ✅ |
| AI-классификатор (GPT-4o-mini) | ✅ |
| Очередь уточнений с созданием правил | ✅ |
| Движок проводок (post/void/repost) | ✅ |
| OpenItem для буферных счетов | ✅ |
| Мастер закрытия (7 шагов, только ACTIVE-режим) | ✅ |
| TURNOVER_TAX_ACCRUAL (Дт 9810 → Кт 6410) | ✅ |
| Годовое закрытие (YEAR_END_CLOSE, 9910→8710) | ✅ |
| Форма №1 — Баланс (строки 010–780) | ✅ |
| Форма №2 — P&L (строки 010–270) | ✅ |
| ОСВ с субаналитикой | ✅ |
| Журнал, Карточка счёта, Субконто, Анализ | ✅ |
| Налоговый календарь | ✅ |
| Открытые позиции + статус RISK | ✅ |
| Мультитенантность + роли (OWNER/ADMIN/ACCOUNTANT/VIEWER) | ✅ |
| Email-уведомления | ⚠️ SMTP требует настройки |
| Биллинг (Payme, Click) | ⚠️ Только через Admin-панель |
| Профиль пользователя | ✅ |

---

---

## Изменения 2026-07-01

### AI-классификатор (модуль B)
- **Исправлен баг кросс-тенантной коллизии** в `ClassificationJob`: job ID для "ALL"-периодов теперь `${orgId}_ALL`, а не `"ALL"` — несколько организаций больше не перезаписывают одну строку
- **Исправлен баг MANUAL_ONLY типов**: `codeToId` строится только из типов документов переданных AI (без PERIOD_CLOSING, YEAR_END_CLOSE)
- **Улучшен промпт**: добавлена явная шкала `confidence` (0–100) с указанием порога авто-проводки
- **Создание правил изолировано в try-catch**: сбой при создании Rule не прерывает классификацию
- **Правило дедупликации исправлено**: `findFirst` без фильтра direction (схема `@@unique([orgId, matchType, matchValue])` не включает direction)

### Реестр транзакций — страница `/transactions` (модуль C)
- Колонка «Счет»: показывает пользовательское название, не номер счёта. Умный fallback: если `name === accountNumber` → показывает `bankName`
- API `/api/transactions` возвращает `bankAccount.bankName` и `bankAccount.accountNumber`
- Компонент `CategoryCombobox` (compact): режим отображения — `<div>` (текст переносится), режим поиска — `<input>`. Длинные названия категорий отображаются полностью

### Шаг 3 — Реестр в Мастере закрытия (модуль E)
- Теперь загружает **все** транзакции (IMPORTED + NEEDS_CLARIFICATION + AUTO_MATCHED), а не только нераспознанные
- Добавлены фильтр-вкладки: «Все» / «Без категории» / «Распознано ИИ»
- AI-категории редактируются прямо в таблице (иконка карандаша при наведении)

### Шаг 6 — Сверка Soliq (модуль E)
- **Pass 3** (расходные ЭСФ): поиск DEBIT-транзакций теперь без фильтра `periodId` → кросс-периодное сопоставление
- `bankOnly` содержит авансы из всех периодов (без изменений в логике) + новое поле `date`
- В UI отображается дата банкового платежа — видно что аванс из прошлого месяца
- **Ручное сопоставление**: дропдауны в обе стороны (bank→esf, esf→bank) для позиций которые AI не распознал

### Удалён режим HISTORICAL (модуль E)
- Опция «Архивный (только импорт + закрытие)» удалена из формы создания периода
- Банковский импорт больше не создаёт периоды с `mode=HISTORICAL`
- Все периоды (включая прошлые месяцы) открываются в полном 7-шаговом wizard'е

*Последнее обновление: 2026-07-01*

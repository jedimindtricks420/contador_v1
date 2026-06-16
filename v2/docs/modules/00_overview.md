# Contador v2 — Обзор модулей

**Статус приложения:** ✅ Реализовано (MVP работает на порту 3032)
**Принцип работы:** Документоцентричная модель — банковская выписка → классификация → Документы → Проводки → Отчёты
**Главный цикл:** Закрыть месяц за 30 минут: загрузить выписку → ответить на вопросы → нажать «Закрыть»

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
| H. Движок проводок | [module_H_posting_engine.md](module_H_posting_engine.md) | ✅ Реализован |
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
       │        │ confidence ≥ 70% → AUTO_MATCHED
       │        │ confidence < 70% → NEEDS_CLARIFICATION
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
       └──► OpenItem (если буферный тип — аванс, подотчёт)
               │
               ▼
       Отчёты (F, G): ОСВ, P&L, Cashflow, Журнал
```

---

## Схема маршрутов (URL)

Все пути с префиксом `/v2/`:

| Путь | Модуль | Компонент |
|------|--------|-----------|
| `/dashboard` | F | DashboardClient.tsx |
| `/transactions` | C | TransactionsClient.tsx |
| `/cashflow` | F | CashFlowClient.tsx |
| `/pnl` | F | PnLClient.tsx |
| `/accounts` | F | AccountsClient.tsx (банк. счета) |
| `/open-positions` | D | OpenPositionsClient.tsx |
| `/closing` | E | ClosingWizard.tsx (7 шагов) |
| `/reports/osv` | G | OSVClient.tsx |
| `/reports/journal` | G | JournalClient.tsx |
| `/reports/account-card` | G | AccountCardClient.tsx |
| `/reports/account-analysis` | G | AccountAnalysisClient.tsx |
| `/reports/subconto` | G | SubcontoClient.tsx |
| `/reports/balance` | G | page.tsx |
| `/settings` | J | Настройки организации |
| `/settings/rules` | J | Правила классификации |
| `/settings/accounts` | J | Видимость счетов |
| `/settings/tax-calendar` | J | Налоговый календарь |
| `/settings/members` | I | Участники организации |
| `/settings/open-items-deadlines` | D | Сроки риска позиций |
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
```

---

## Что реализовано vs. что ожидается

| Функция | Статус |
|---------|--------|
| 1C банковский парсер | ✅ |
| Excel парсеры (Asaka, Kapital, Ipak Yoli) | ✅ (частично тестированы на реальных файлах) |
| Soliq Excel импорт | ✅ |
| Движок правил (INN/KEYWORD/AMOUNT/TREASURY) | ✅ |
| AI-классификатор (GPT-4o-mini) | ✅ |
| Очередь уточнений с созданием правил | ✅ |
| Движок проводок (post/void/repost) | ✅ |
| OpenItem для буферных счетов | ✅ |
| Мастер закрытия (7 шагов) | ✅ |
| Закрытие года (реформация баланса) | ✅ (базовая) |
| ОСВ с типами счетов | ✅ |
| P&L, Cashflow, Журнал, Карточка счёта | ✅ |
| Баланс (Форма 1) | ⚠️ Частично |
| Налоговый календарь | ✅ |
| Открытые позиции + риск | ✅ |
| Мультитенантность + роли | ✅ |
| Email уведомления | ⚠️ SMTP требует настройки |
| Биллинг (Payme, Click) | ⚠️ Только через Admin-панель |

---

*Последнее обновление: 2026-06-16*

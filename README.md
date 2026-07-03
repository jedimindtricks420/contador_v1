# Contador — Бухгалтерская система для Узбекистана

Мультитенантная SaaS-система двойной записи по **НСБУ №21** с AI-классификатором банковских операций.

**Стек:** Next.js · TypeScript · Prisma 6 · PostgreSQL 16 · OpenAI GPT-4o-mini · Tailwind CSS 4 · Decimal.js  
**Нормативная база:** НСБУ №1 (рег. МЮ №3544, с 01.01.2025), НСБУ №21 (рег. МЮ №3593, с 01.01.2025)  
**Последнее обновление:** 2026-07-02

---

## Приложения

| Приложение | Порт | Статус | Описание |
|-----------|------|--------|----------|
| **v2** (основная) | 3032 | ✅ Активна | Документоцентричный учёт, импорт выписок, AI-классификация, закрытие месяца, Форма №1 + Форма №2 |
| **v1** (legacy) | 3030 | 🔒 Legacy | AI-чат ввода проводок, базовые отчёты. Не развивается |
| **Admin** | 3031 | ✅ Активна | Express — Payme/Click, подписки, организации |

---

## Быстрый старт (v2)

### Разработка

```bash
cd /home/admin1/contador/v2
npm install
npx prisma generate
npx prisma migrate deploy
npm run dev        # http://localhost:3032/v2
```

### Продакшн (PM2)

```bash
cd /home/admin1/contador/v2
npm run build
pm2 restart contador-v2
# или первый запуск:
pm2 start "npm run start" --name contador-v2
```

Статус: `pm2 status` → процесс `contador-v2`.

### База данных

```bash
# Миграции
npx prisma migrate deploy

# Prisma Studio
cd v2 && npx prisma studio

# Прямой доступ
psql postgresql://user:password@172.26.0.2:5432/contador_v2
```

---

## Структура проекта

```
contador/
├── v2/                          # ✅ ОСНОВНОЕ приложение (Next.js, порт 3032, basePath: /v2)
│   ├── prisma/schema.prisma     # Схема v2 (БД: contador_v2)
│   ├── src/
│   │   ├── app/
│   │   │   ├── api/             # REST API (60+ endpoint-ов)
│   │   │   │   ├── pnl/         # Форма №2 — Отчёт о финансовых результатах
│   │   │   │   ├── reports/balance/  # Форма №1 — Бухгалтерский баланс
│   │   │   │   ├── closing/     # Мастер закрытия + год-энд
│   │   │   │   ├── classification/  # AI + правила
│   │   │   │   ├── import/      # Банковские выписки, Soliq
│   │   │   │   └── ...
│   │   │   ├── closing/         # Мастер закрытия месяца (7 шагов)
│   │   │   ├── pnl/             # Страница Формы №2
│   │   │   ├── reports/balance/ # Страница Формы №1
│   │   │   ├── dashboard/       # Дашборд с KPI
│   │   │   ├── transactions/    # Реестр транзакций
│   │   │   ├── reports/         # ОСВ, журнал, карточка счёта, субконто
│   │   │   ├── settings/        # Настройки: налоговый режим, ставка, участники
│   │   │   └── ...
│   │   └── lib/
│   │       ├── posting/         # Движок проводок (postingEngine.ts)
│   │       ├── classification/  # Движок правил + AI-классификатор
│   │       ├── reports/         # OSV, journal, account-card, subconto
│   │       ├── closing.ts       # finalizePeriod() — закрытие месяца
│   │       ├── constants.ts     # Коды счетов НСБУ, налоговые ставки
│   │       ├── seed-coa.ts      # 214 счетов НСБУ №21 (план счетов)
│   │       └── ensureBaseData.ts  # Создание типов документов при старте
│   └── docs/modules/            # Техническая документация по модулям
│
├── src/                         # 🔒 Приложение v1 (legacy, порт 3030)
├── prisma/                      # Схема v1 (БД: contador)
├── admin/                       # Admin-панель (Express, порт 3031)
├── ai/                          # AI knowledge-base, промпты
└── docs/                        # Общая документация проекта
```

---

## Ключевые возможности (v2)

### Форма №1 — Бухгалтерский баланс
- Полная реализация строк 010–780 по НСБУ №21 и §2 спецификации
- Прямые SQL-агрегаты по `JournalEntry` — без ORM-цепочек
- Контрарные счета (0200, 4910, 2980, 8610/8620) обрабатываются корректно
- Незакрытый финансовый результат текущего года (`transitNet`) включается в строку 450
- Балансовый контроль: стр.400 = стр.780 (допуск ≤ 1 сум)

### Форма №2 — Отчёт о финансовых результатах
- Полная реализация строк 010–270 по НСБУ №21 и §3 спецификации
- Источник: дебетовые/кредитовые обороты по счетам 9xxx (исключая PERIOD_CLOSING)
- Строка 250: берётся из оборота 9810; если 0 — фолбэк на `TaxCalendarEvent`
- Помесячный разрез для графиков дашборда
- Корректная подпись ставки: `Налог на прибыль (15%)` или `Налог с оборота (N%)`

### Два режима налогообложения
| Параметр | НДС + налог на прибыль | Налог с оборота |
|----------|----------------------|-----------------|
| `taxRegime` | `VAT` | `TURNOVER_TAX` |
| `isVatPayer` | `true` | `false` |
| Ставка | НДС 12%, прибыль 15% | `turnoverTaxRate` (1–4%, настраивается) |
| Начисление | Дт 9810 → Кт 6410 | Дт 9810 → Кт 6410 (документ TURNOVER_TAX_ACCRUAL) |
| Форма №2 стр.250 | Дебет 9810 | Дебет 9810 |

### Импорт банковских выписок
- Форматы: 1CClientBankExchange (.txt), Excel (Asaka, Kapital, Ipak Yoli)
- SHA-256 дедупликация — повторный импорт безопасен
- Откат импорта по `importBatchId`

### AI-классификация операций
- Движок правил: INN → KEYWORD → AMOUNT_RANGE → TREASURY_ACCOUNT
- GPT-4o-mini, батчи до 20 транзакций, порог уверенности 70%
- Очередь уточнений с автосозданием правил из ответов пользователя

### Мастер закрытия месяца (7 шагов)
1. Импорт выписки
2. Классификация (AI + правила + уточнения)
3. Реестр и проверка документов
4. Начисления (ФОТ, амортизация, аренда)
5. Курсовые разницы (USD ↔ UZS, курс ЦБ)
6. Сверка с Soliq (ЭСФ)
7. Финализация: расчёт налогов → PERIOD_CLOSING (9xxx→9910) → блокировка периода

### Годовое закрытие
```
POST /api/closing/year-end
```
Переносит чистую прибыль/убыток 9910 → 8710 (документ `YEAR_END_CLOSE`).  
Доступно только для декабря с уже закрытым периодом.

### Открытые позиции
- Авансы полученные/выданные, подотчёт (командировочные и общехозяйственные), депозиты, дивиденды к оплате
- Автоматический статус RISK по истечении дедлайна
- Дедлайны по умолчанию: 10 дн. (подотчёт), 30 дн. (авансы и прочие буферные счета), 365 дн. (депозиты, займы учредителей, дивиденды) — настраиваются на уровне организации в `/v2/settings/open-items-deadlines`

---

## Переменные окружения

### v2 (`/home/admin1/contador/v2/.env`)
```env
DATABASE_URL=postgresql://user:password@172.26.0.2:5432/contador_v2
JWT_SECRET=<секрет>
OPENAI_API_KEY=sk-proj-...
PORT=3032
NEXT_PUBLIC_APP_URL=https://contador.uz
SMTP_HOST=...
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...
SMTP_FROM=...
```

### Root / Admin (`/home/admin1/contador/.env`)
```env
DATABASE_URL=postgresql://user:password@172.26.0.2:5432/contador
V2_DATABASE_URL=postgresql://user:password@172.26.0.2:5432/contador_v2
JWT_SECRET=<секрет>
OPENAI_API_KEY=sk-proj-...
ADMIN_PORT=3031
ADMIN_PASSWORD=<пароль>
PAYME_MERCHANT_ID=...
CLICK_SERVICE_ID=...
```

---

## Тесты

```bash
cd /home/admin1/contador/v2
npm run test        # Vitest
```

Покрытие: импорт, periods, dashboard API, P&L, cashflow, year-end, step4 validation.

---

## Документация

| Файл | Содержимое |
|------|-----------|
| [docs/01_PROJECT_OVERVIEW.md](docs/01_PROJECT_OVERVIEW.md) | Функциональный обзор проекта |
| [docs/02_ARCHITECTURE.md](docs/02_ARCHITECTURE.md) | Архитектура, стек, деплой |
| [docs/03_DATA_MODEL.md](docs/03_DATA_MODEL.md) | Схема данных v2 |
| [docs/04_API_REFERENCE.md](docs/04_API_REFERENCE.md) | Справочник REST API |
| [docs/05_BUSINESS_LOGIC.md](docs/05_BUSINESS_LOGIC.md) | Движок проводок, закрытие периода |
| [docs/06_SECURITY.md](docs/06_SECURITY.md) | Аутентификация, авторизация |
| [docs/07_OPERATIONS.md](docs/07_OPERATIONS.md) | PM2, бэкапы, мониторинг |
| [docs/08_AI_INTEGRATION.md](docs/08_AI_INTEGRATION.md) | AI-классификатор |
| [docs/09_ACCOUNTING_REFERENCE.md](docs/09_ACCOUNTING_REFERENCE.md) | Счета, ставки, проводки |
| [docs/10_USER_GUIDE.md](docs/10_USER_GUIDE.md) | Руководство пользователя |
| [docs/DOCUMENT_TYPES.md](docs/DOCUMENT_TYPES.md) | Указатель на актуальный каталог типов документов |
| [docs/contador_accounting_engine_spec.md](docs/contador_accounting_engine_spec.md) | Спецификация движка учёта |
| [v2/docs/modules/](v2/docs/modules/) | Техническая документация по модулям |

---

*НСБУ №21 · Узбекистан · contador.uz*

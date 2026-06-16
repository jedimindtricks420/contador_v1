# Contador — Бухгалтерская система для Узбекистана

Мультитенантная SaaS-система двойной записи по **НСБУ №21** с AI-классификатором банковских операций на базе GPT-4o-mini.

**Стек:** Next.js 16.2.1 · Prisma 6 · PostgreSQL 16 · OpenAI GPT-4o-mini · Tailwind CSS 4 · Decimal.js · TypeScript 5

---

## Архитектура

Проект состоит из двух приложений, работающих одновременно:

| Приложение | Порт | Статус | Описание |
|-----------|------|--------|----------|
| **v2** (основная) | 3032 | ✅ Активна | Документоцентричный учёт, импорт выписок, AI-классификация, мастер закрытия месяца |
| **v1** (legacy) | 3030 | 🔒 Legacy | AI-чат для ввода проводок вручную, базовые отчёты |

**Основная точка входа** — v2 на порту 3032. v1 оставлена для обратной совместимости.

**Admin-панель** (Express, порт 3031) — управление платёжными интеграциями (Payme, Click), подписками, организациями.

---

## Быстрый старт (v2 — основное приложение)

### Разработка

```bash
cd /home/admin1/contador/v2
npm install
npx prisma generate
npx prisma migrate deploy
npm run dev        # http://localhost:3032
```

### Продакшн (PM2)

```bash
cd /home/admin1/contador/v2
npm run build
pm2 start "npm run start" --name contador-v2

# Перезапуск после обновления
npm run build && pm2 restart contador-v2
```

Статус: `pm2 status` — процесс `contador-v2` (pid ~2654692).

### База данных

```bash
# Применить миграции
npx prisma migrate deploy

# Prisma Studio
npx prisma studio

# Прямой доступ к PostgreSQL
psql postgresql://user:password@172.26.0.2:5432/contador_v2
```

---

## Структура проекта

```
contador/
├── v2/                        # ✅ ОСНОВНОЕ приложение (Next.js, порт 3032)
│   ├── src/
│   │   ├── app/
│   │   │   ├── api/           # REST API (50+ endpoints)
│   │   │   ├── closing/       # Мастер закрытия месяца (7 шагов)
│   │   │   ├── dashboard/     # Главный дашборд с KPI
│   │   │   ├── transactions/  # Реестр транзакций
│   │   │   ├── reports/       # ОСВ, журнал, карточка счёта
│   │   │   └── ...
│   │   └── lib/
│   │       ├── posting/       # Движок проводок (postingEngine.ts)
│   │       ├── classification/ # Движок правил + AI-классификатор
│   │       ├── reports/       # OSV, P&L, Cashflow
│   │       ├── constants.ts   # Коды счетов НСБУ, налоговые ставки
│   │       └── ensureBaseData.ts  # Seed документ-типов при старте
│   ├── prisma/
│   │   └── schema.prisma      # Схема v2 (БД: contador_v2)
│   └── docs/modules/          # Техническая документация по модулям
│
├── src/                       # 🔒 Приложение v1 (legacy, порт 3030)
├── prisma/                    # Схема v1 (БД: contador)
├── admin/                     # Admin-панель (Express, порт 3031)
├── ai/                        # AI модуль: knowledge-base.ts, prompts.ts
└── docs/                      # Общая документация проекта
```

---

## Ключевые возможности v2

### Импорт банковских выписок
- Форматы: 1CClientBankExchange (.txt), Excel (Asaka, Kapital, Ipak Yoli)
- Дедупликация по SHA-256 хэшу — повторный импорт безопасен
- Откат импорта по `importBatchId`

### AI-классификация операций
- Движок правил (INN → KEYWORD → AMOUNT_RANGE → TREASURY_ACCOUNT)
- GPT-4o-mini с 70% порогом уверенности (настраивается на уровне организации)
- Очередь уточнений — пользователь отвечает на вопросы, создаются новые правила

### Документоцентричный движок проводок
- Шаблоны проводок в JSON (expression-based, с условиями)
- Автоматическое создание OpenItem для буферных счетов (авансы, подотчёт)
- Проверка баланса Σ Дт = Σ Кт на уровне движка

### Мастер закрытия месяца (7 шагов)
1. Импорт выписки
2. Классификация (AI + правила + очередь уточнений)
3. Реестр и проверка документов
4. Начисления (ФОТ, амортизация, аренда)
5. Курсовые разницы (USD ↔ UZS)
6. Сверка с Soliq (ЭСФ)
7. Финализация и закрытие периода

### Отчёты
- ОСВ (оборотно-сальдовая ведомость)
- P&L (доходы / расходы / прибыль)
- Cashflow (движение по счетам)
- Журнал проводок
- Карточка счёта
- Анализ субконто

### Открытые позиции
- Авансы полученные / выданные, подотчёт, депозиты
- Автоматический расчёт риска по дедлайнам
- Флаг RISK на дашборде

---

## Переменные окружения

### v2 (`/home/admin1/contador/v2/.env`)

```env
DATABASE_URL=postgresql://user:password@172.26.0.2:5432/contador_v2
JWT_SECRET=<секрет>
OPENAI_API_KEY=sk-proj-...
PORT=3032
NEXT_PUBLIC_APP_URL=https://contador.uz
# SMTP (опционально — для email-уведомлений)
SMTP_HOST=...
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...
SMTP_FROM=...
```

### Root / admin (`/home/admin1/contador/.env`)

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
npm run test        # Vitest (src/__tests__/)
```

8 тест-файлов покрывают: импорт, periods, dashboard API, P&L, cashflow, year-end, step4 validation.

---

## Docker (v1 + Admin)

```bash
# Сборка v1
rsync -av --exclude=postgres_data --exclude=.next --exclude=node_modules \
  /home/admin1/contador/ /tmp/contador-build/
docker build -t contador-app -f /tmp/contador-build/Dockerfile /tmp/contador-build/

docker stop contador-app 2>/dev/null; docker rm contador-app 2>/dev/null
docker run -d --name contador-app --network contador_contador-net \
  -p 3030:3030 --env-file /home/admin1/contador/.env contador-app
```

---

## Документация

| Файл | Содержимое |
|------|-----------|
| [docs/USER_GUIDE.md](docs/USER_GUIDE.md) | Руководство пользователя v2 |
| [docs/TECHNICAL.md](docs/TECHNICAL.md) | Архитектура, схема данных v2 |
| [docs/OPERATIONS.md](docs/OPERATIONS.md) | Деплой, PM2, бэкапы, мониторинг |
| [docs/API_REFERENCE.md](docs/API_REFERENCE.md) | Полный справочник REST API v2 |
| [docs/AI_DEVELOPMENT_REFERENCE.md](docs/AI_DEVELOPMENT_REFERENCE.md) | AI-классификатор: промпты, правила |
| [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md) | UI-компоненты и паттерны |
| [docs/MULTI_ORG_SPEC.md](docs/MULTI_ORG_SPEC.md) | Мультитенантность |
| [v2/docs/modules/00_overview.md](v2/docs/modules/00_overview.md) | Обзор модулей v2 |
| [docs/full-chart-of-accounts.md](docs/full-chart-of-accounts.md) | Полный план счетов НСБУ №21 |

---

*НСБУ №21 · Узбекистан · contador.uz*

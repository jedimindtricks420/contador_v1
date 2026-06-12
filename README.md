# Contador — Бухгалтерская система для Узбекистана

Мультитенантная SaaS-система для бухгалтерского учёта по **НСБУ №21** с ИИ-помощником на базе GPT-4o.

**Стек:** Next.js 16.2.1 · Prisma 6 · PostgreSQL 16 · OpenAI GPT-4o · Tailwind CSS 4 · Decimal.js

---

## Быстрый старт

Приложение работает в Docker. Из-за особенностей окружения (legacy Docker Compose) используйте прямые команды:

```bash
# Сборка образа (из временной директории без postgres_data)
rsync -av --exclude=postgres_data /home/admin1/contador/ /tmp/contador-build/
docker build -t contador-app -f /tmp/contador-build/Dockerfile /tmp/contador-build/

# Запуск контейнера
docker stop contador-app 2>/dev/null; docker rm contador-app 2>/dev/null
docker run -d \
  --name contador-app \
  --network contador_contador-net \
  -p 3030:3030 \
  --env-file /home/admin1/contador/.env \
  contador-app
```

Приложение доступно на `http://localhost:3030` (через nginx: `https://contador.uz`).

### Разработка (без Docker)

```bash
npm install
npx prisma generate
npm run dev        # http://localhost:3030
```

---

## Структура проекта

```
contador/
├── src/
│   ├── app/               # Next.js App Router (страницы и API routes)
│   │   ├── api/           # REST API endpoints
│   │   │   ├── ai/        # AI чат и выполнение проводок
│   │   │   ├── reports/   # ОСВ, баланс, ОФР, дашборд
│   │   │   └── ...
│   │   ├── dashboard/     # Дашборд
│   │   ├── journal/       # Журнал операций
│   │   ├── osv/           # ОСВ
│   │   └── ...
│   ├── components/        # UI компоненты (AIChat, таблицы, формы)
│   └── lib/               # Утилиты (context, prisma, accounting-logic)
├── ai/
│   ├── knowledge-base.ts  # MASTER_COA_COMPACT — 266 счетов НСБУ + 22 отраслевых шаблона
│   └── prompts.ts         # Системный промпт AI с правилами бухгалтерии
├── prisma/
│   ├── schema.prisma      # Схема БД
│   └── seed.ts            # Сидинг мастер-данных (340 счетов, 22 шаблона)
├── scripts/               # Утилиты миграции и обслуживания
└── docs/                  # Документация
```

---

## Ключевые возможности

- **Multi-tenancy** — неограниченное число организаций на один аккаунт, полная изоляция данных
- **AI-помощник** — GPT-4o с базой знаний НСБУ, автоматически создаёт корректные проводки по текстовому описанию
- **340 счетов НСБУ** — полный план счетов, 22 отраслевых шаблона для быстрого старта
- **9 типов счетов** — ACTIVE, PASSIVE, CONTRA_ACTIVE, CONTRA_PASSIVE, ACTIVE_PASSIVE, INCOME, EXPENSE, CONTRA_INCOME, OFF_BALANCE
- **Отчёты в реальном времени** — ОСВ, Баланс (Форма 1), ОФР (Форма 2), Дашборд с KPI и графиками
- **Контроль периодов** — закрытый период блокирует редактирование; счёт 0000 для начальных остатков
- **Подписки** — FREE (10 req/мес), PRO (300 req/мес), MYAPI (свой ключ OpenAI)

---

## База данных

```bash
# Применить миграции
npx prisma migrate deploy

# Сидинг (340 мастер-счетов + 22 шаблона)
npx prisma db seed

# Prisma Studio (UI для БД)
npx prisma studio
```

Прямой доступ к PostgreSQL:
```bash
docker exec -it 319b5e2913a4_contador-db psql -U user -d contador
```

---

## Документация

| Файл | Содержимое |
|---|---|
| [docs/USER_GUIDE.md](docs/USER_GUIDE.md) | Руководство пользователя (с нуля) |
| [docs/TECHNICAL.md](docs/TECHNICAL.md) | Архитектура и технические детали |
| [docs/OPERATIONS.md](docs/OPERATIONS.md) | Docker, бэкапы, обслуживание |
| [docs/ONBOARDING.md](docs/ONBOARDING.md) | Онбординг и отраслевые шаблоны |
| [docs/AI_DEVELOPMENT_REFERENCE.md](docs/AI_DEVELOPMENT_REFERENCE.md) | Справочник для разработки AI-модуля |
| [docs/API_REFERENCE.md](docs/API_REFERENCE.md) | REST API endpoints |
| [docs/MULTI_ORG_SPEC.md](docs/MULTI_ORG_SPEC.md) | Мультиорганизационная архитектура |
| [docs/full-chart-of-accounts.md](docs/full-chart-of-accounts.md) | Полный план счетов (340 позиций) |

---

*НСБУ №21 · Узбекистан · contador.uz*

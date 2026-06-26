# 02 — Архитектура системы

**Документ:** System Architecture  
**Версия:** 2.0  
**Дата:** 2026-06-26

---

## 1. Обзор архитектуры

Contador v2 построен на **трёхзвенной архитектуре** с разделением presentation, business logic и data:

```
┌─────────────────────────────────────────────────────────────────┐
│                        ИНТЕРНЕТ / NGINX                          │
│                   https://contador.uz                            │
└───────────────┬─────────────────────────┬───────────────────────┘
                │ /v2/*                   │ /admin/*
                ▼                         ▼
┌──────────────────────┐     ┌─────────────────────────┐
│   Contador v2        │     │   Admin Panel            │
│   Next.js 16.2       │     │   Express.js             │
│   Port 3032          │     │   Port 3031              │
│   PM2 (Node.js)      │     │   Docker container       │
│   basePath: /v2      │     │                          │
└──────────┬───────────┘     └───────────┬─────────────┘
           │                             │
           └──────────┬──────────────────┘
                      ▼
           ┌──────────────────────┐
           │   PostgreSQL 16      │
           │   Port 5432          │
           │   Docker container   │
           ├──────────────────────┤
           │ DB: contador_v2      │  ← v2 app
           │ DB: contador         │  ← admin (legacy data)
           └──────────────────────┘
                      │
           ┌──────────▼──────────┐
           │   OpenAI API         │
           │   GPT-4o-mini        │
           │   External service   │
           └─────────────────────┘
```

---

## 2. Технический стек

### Frontend
| Компонент | Технология | Версия |
|-----------|-----------|--------|
| Framework | Next.js (App Router) | 16.2.1 |
| Language | TypeScript | 5.x |
| Styling | Tailwind CSS | 4.x |
| Icons | lucide-react | 1.7.x |
| Charts | recharts | 3.8.x |
| HTTP | fetch (native) | — |

### Backend
| Компонент | Технология | Версия |
|-----------|-----------|--------|
| Runtime | Node.js | 20.x |
| API | Next.js Route Handlers | 16.2.1 |
| ORM | Prisma | 6.x |
| Auth | jose (JWT HS256) | 6.x |
| Password | bcryptjs | 3.x |
| Decimals | decimal.js | 10.x |
| AI | openai SDK | 6.x |
| Excel parsing | xlsx | — |

### Infrastructure
| Компонент | Технология |
|-----------|-----------|
| Database | PostgreSQL 16-alpine (Docker) |
| Process manager | PM2 (v2 app) |
| Container runtime | Docker (admin panel) |
| Reverse proxy | nginx |
| OS | Ubuntu Server (Azure VM) |

---

## 3. Структура каталогов

```
/home/admin1/contador/
├── v2/                            # Основное приложение
│   ├── src/
│   │   ├── app/                   # Next.js App Router pages
│   │   │   ├── api/               # Route Handlers (REST API)
│   │   │   │   ├── auth/          # login, register, logout, forgot/reset-password
│   │   │   │   ├── dashboard/     # KPI, summary
│   │   │   │   ├── transactions/  # StagedTransaction CRUD
│   │   │   │   ├── import/        # Bank statement import
│   │   │   │   ├── classification/ # run-rules, run-ai, status
│   │   │   │   ├── clarification/ # queue, answer
│   │   │   │   ├── posting/       # post, void, repost
│   │   │   │   ├── closing/       # [periodId]/step, finalize, year-end
│   │   │   │   ├── reports/       # osv, journal, account-card, balance, subconto
│   │   │   │   ├── open-items/    # CRUD, close, reopen
│   │   │   │   ├── pnl/           # P&L calculation
│   │   │   │   ├── cashflow/      # Cashflow calculation
│   │   │   │   ├── rules/         # Classification rules CRUD
│   │   │   │   ├── bank-accounts/ # CRUD
│   │   │   │   ├── periods/       # CRUD
│   │   │   │   ├── org/           # switch, members
│   │   │   │   ├── settings/      # org, tax-deadlines, open-item-deadlines
│   │   │   │   ├── document-types/ # catalog
│   │   │   │   └── cbu-rate/      # ЦБ РУз exchange rate
│   │   │   ├── dashboard/         # Dashboard page
│   │   │   ├── transactions/      # Transactions page
│   │   │   ├── closing/           # 7-step closing wizard
│   │   │   ├── reports/           # OSV, journal, account-card, balance
│   │   │   ├── open-positions/    # Open items page
│   │   │   ├── accounts/          # Bank accounts page
│   │   │   ├── pnl/               # P&L page
│   │   │   ├── cashflow/          # Cashflow page
│   │   │   ├── settings/          # Settings pages
│   │   │   ├── login/             # Auth pages
│   │   │   ├── register/
│   │   │   ├── forgot-password/
│   │   │   ├── reset-password/
│   │   │   └── layout.tsx         # Root layout
│   │   ├── lib/
│   │   │   ├── auth.ts            # JWT creation (Node.js)
│   │   │   ├── auth-edge.ts       # JWT verification (Edge Runtime)
│   │   │   ├── context.ts         # getSession, getActiveOrgId, getActiveMembership
│   │   │   ├── prisma.ts          # Prisma client + prismaWithOrg helper
│   │   │   ├── constants.ts       # TAX_RATES, ACCOUNTS, AI, CLOSING, RISK_DAYS
│   │   │   ├── ensureBaseData.ts  # Seed DocumentTypes on startup
│   │   │   ├── closing.ts         # Closing wizard logic
│   │   │   ├── openItems.ts       # OpenItem risk deadline logic
│   │   │   ├── mailer.ts          # SMTP email sender
│   │   │   ├── classification/
│   │   │   │   ├── rulesEngine.ts # In-memory rules with 30s cache
│   │   │   │   └── aiClassifier.ts # GPT-4o-mini batch classifier
│   │   │   ├── posting/
│   │   │   │   ├── postingEngine.ts # post/void/repost
│   │   │   │   └── expressionEval.ts # Math expression evaluator
│   │   │   ├── reports/
│   │   │   │   ├── osv.ts         # Trial balance calculation
│   │   │   │   ├── journal.ts     # Journal entries report
│   │   │   │   ├── accountCard.ts # Account card with running balance
│   │   │   │   └── subconto.ts    # Subconto analytics
│   │   │   ├── parsers/
│   │   │   │   ├── parse1C.ts     # 1C XML bank statement parser
│   │   │   │   └── parseExcel.ts  # Excel bank statement parser
│   │   │   └── seed-coa.ts        # Chart of accounts seed data
│   │   └── components/
│   │       └── Layout/
│   │           └── Sidebar.tsx    # Navigation sidebar
│   ├── prisma/
│   │   └── schema.prisma          # Database schema
│   ├── public/
│   │   ├── contador icon.svg
│   │   └── contador text logo.svg
│   ├── next.config.ts             # basePath: "/v2", assetPrefix: "/v2"
│   ├── .env                       # Environment variables
│   └── docs/
│       └── modules/               # Module-level documentation (A–J)
├── admin/                         # Admin panel (Express.js)
│   ├── server.ts                  # Express server
│   └── public/
│       └── index.html             # Admin UI (single-page)
├── ai/
│   ├── knowledge-base.ts          # MASTER_COA_COMPACT + PostingTemplates
│   └── prompts.ts                 # System prompts for AI classifier
├── docs/                          # ← Эта документация
├── Dockerfile.admin               # Admin Docker image build
├── docker-compose.yml             # Admin + DB orchestration
└── .env                           # Root env (admin credentials, legacy)
```

---

## 4. Next.js конфигурация

```typescript
// v2/next.config.ts
const nextConfig: NextConfig = {
  basePath: "/v2",        // Все маршруты доступны под /v2/...
  assetPrefix: "/v2",    // Статика также под /v2/...
};
```

**Важно:** `basePath` автоматически добавляется к путям в `router.push()`, `redirect()` и `<Link>`. Все внутренние пути должны быть **без** `/v2/` префикса (например, `/dashboard`, не `/v2/dashboard`).

### Паттерн async params (Next.js 16+)

```typescript
// В Next.js 16 params — это Promise
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
}
```

---

## 5. Многотенантность (Multi-tenancy)

**Модель:** Shared Database, Shared Schema с row-level изоляцией по `orgId`.

```
Каждый запрос:
  1. Middleware верифицирует JWT → session.userId, session.activeOrgId
  2. API handler вызывает getActiveOrgId() → orgId
  3. Все запросы к БД включают WHERE orgId = ?
```

### Хелпер prismaWithOrg

```typescript
// v2/src/lib/prisma.ts
export function prismaWithOrg(orgId: string) {
  return prisma;  // базовый клиент — orgId используется явно в запросах
}
```

Все модели кроме `Account` (глобальный план счетов) содержат поле `orgId` и изолируются на уровне запросов.

---

## 6. Поток обработки транзакции

```
Загрузка выписки (Excel/1C XML)
         │
         ▼
   parseExcel / parse1C
         │ StagedTransaction[]
         ▼
   SHA-256 hash → unique(orgId, hash)
         │
         ▼
   Status: IMPORTED
         │
    ┌────┴────┐
    │ Rules   │ → AUTO_MATCHED (documentTypeId = rule.categoryId)
    │ Engine  │
    └────┬────┘
         │ remaining IMPORTED
    ┌────▼────┐
    │   AI    │ → AUTO_MATCHED (confidence ≥ threshold)
    │ GPT-4o  │ → NEEDS_CLARIFICATION (confidence < threshold)
    └────┬────┘
         │
    ┌────▼────────────┐
    │ Clarification   │ → CONFIRMED (пользователь ответил)
    │ Queue           │
    └────┬────────────┘
         │
    ┌────▼────┐
    │ Posting │ → Document + JournalEntry[]
    │ Engine  │ → Status: POSTED
    └─────────┘
```

---

## 7. Nginx конфигурация

```nginx
# /etc/nginx/sites-available/contador.uz

server {
    server_name contador.uz www.contador.uz;

    # v2 — основное приложение
    location /v2/ {
        proxy_pass http://127.0.0.1:3032/v2/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Admin panel
    location /admin {
        proxy_pass http://127.0.0.1:3031;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        auth_basic "Contador Admin";
    }

    # Редирект корня на v2
    location / {
        return 301 /v2/dashboard;
    }

    listen 443 ssl;
    # SSL конфигурация...
}
```

---

## 8. Принципы проектирования

1. **Server Components by default** — клиентские компоненты только там, где нужна интерактивность
2. **API Routes — тонкий слой** — бизнес-логика вынесена в `src/lib/`
3. **Атомарность** — все операции с несколькими записями в `prisma.$transaction()`
4. **Inline errors** — ошибки показываются в UI рядом с формой, не через `alert()`
5. **Graceful degradation** — каждый UI-блок имеет состояния: loading / error+retry / empty / data

---

*Дата: 2026-06-16*

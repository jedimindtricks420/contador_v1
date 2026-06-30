# Модуль K — Профиль, подписка и биллинг

**Статус:** ✅ Реализован  
**Файлы:** `src/app/api/user/`, `src/app/api/payments/`, `src/lib/billing.ts`  
**Последнее обновление:** 2026-06-30

---

## Назначение

Управление профилем пользователя, переключение активной организации, тарифный план PRO (проверка, оплата через Payme/Click, активация ваучера, история платежей).

---

## Профиль пользователя

### GET /api/user/me

Возвращает текущего пользователя со всеми организациями.

```
→ {
    user: { id, email, name },
    organization: { id, name, inn, ... } | null,  // активная организация из сессии
    role: "OWNER" | "ADMIN" | "ACCOUNTANT" | "VIEWER" | null,
    memberships: [{ orgId, orgName, role }]
  }
```

Находит `activeMembership` по `session.activeOrgId` — если токен устарел и activeOrgId больше не совпадает ни с одним членством, `organization` и `role` будут `null`.

---

### PATCH /api/user/active-org

Переключить активную организацию (перевыпускает JWT).

```
Body: { orgId: string }
→ { activeOrgId: string }
```

**Логика:**
1. Проверяет членство: `OrgMember.findUnique({ where: { userId_orgId: { userId, orgId } } })`
2. Обновляет `User.activeOrgId` в БД
3. Перевыпускает JWT с новым `activeOrgId`
4. Устанавливает cookie `v2_session` (httpOnly, 7 дней)

> **Примечание:** Старый эндпоинт `POST /api/org/switch` является алиасом — реализован через тот же механизм.

---

## Биллинг и подписка

### Модель данных

```
Subscription { orgId, plan: "FREE"|"PRO", validUntil: DateTime }
Payment { orgId, provider: "PAYME"|"CLICK", amount, status, daysGranted, createdAt, completedAt }
```

### Проверка PRO-статуса (`src/lib/billing.ts`)

```typescript
async function getUserActivePro(userId: string): Promise<{ isPro: boolean; validUntil: Date | null }>
```

Алгоритм:
1. Находит все `orgId` из `OrgMember` для данного `userId`
2. Ищет `Subscription` с `plan="PRO"` и `validUntil > now` среди всех организаций пользователя
3. Берёт подписку с максимальным `validUntil`

Используется в:
- `api/classification/run-ai` — AI-классификация только для PRO
- `api/classification/ai-reconcile` — ИИ-сверка Soliq только для PRO

---

### GET /api/payments/subscription

Текущий статус тарифа и цена PRO.

```
→ {
    plan: "FREE" | "PRO",
    validUntil: string | null,     // ISO 8601
    daysLeft: number | null,
    proPrice: number               // в UZS, по умолчанию 299 000
  }
```

`proPrice` запрашивается у Admin API (`ADMIN_API_URL/admin/api/payment-info`); при ошибке — fallback 299 000.

---

### POST /api/payments/initiate

Инициировать платёж через Payme или Click.

```
Body: { provider: "PAYME" | "CLICK" }
→ { url: string, paymentId: string }
```

Проксирует запрос на Admin API (`ADMIN_API_URL/admin/api/v2/payments/initiate`). Admin API создаёт платёж и возвращает URL для перехода на страницу оплаты.

**Переменная среды:** `ADMIN_API_URL` (по умолчанию `http://localhost:3031`)

---

### POST /api/payments/voucher

Активировать ваучер (промокод).

```
Body: { code: string }
→ { success: true, validUntil: string, ... }  // ответ Admin API
```

Код нормализуется через `.trim().toUpperCase()`. Проксируется на `ADMIN_API_URL/admin/api/v2/vouchers/redeem`.

При ошибке аутентификации — редирект на `/v2/login` (307).

---

### GET /api/payments/history

История платежей за все организации пользователя.

```
→ Payment[]  // последние 50, отсортированы по createdAt DESC
  {
    id, orgId, provider, amount: string,  // Decimal → string
    status, daysGranted, createdAt, completedAt
  }
```

Запрашивает все `OrgMember.orgId` пользователя и затем делает `Payment.findMany({ where: { orgId: { in: orgIds } } })`.

---

## Архитектура Admin API

Биллинг реализован через отдельный **Admin API** (порт 3031, проект `mibt-2` или аналогичный). Contador v2 является клиентом Admin API по следующим эндпоинтам:

| Эндпоинт Admin API | Назначение |
|-------------------|------------|
| `POST /admin/api/v2/payments/initiate` | Создать платёж Payme/Click |
| `POST /admin/api/v2/vouchers/redeem` | Активировать ваучер |
| `GET /admin/api/payment-info` | Текущая цена PRO |

**Переменные окружения:**
```
ADMIN_API_URL=http://localhost:3031   # URL Admin API
```

---

## Переменные окружения модуля

| Переменная | Назначение | По умолчанию |
|-----------|-----------|-------------|
| `ADMIN_API_URL` | URL Admin API для биллинга | `http://localhost:3031` |
| `NEXT_PUBLIC_APP_URL` | Базовый URL приложения | `https://contador.uz` |

---

## Защиты

- Все эндпоинты требуют валидной сессии — `UNAUTHORIZED` → 401
- `PATCH /api/user/active-org`: проверяет членство через `userId_orgId` уникальный индекс — нельзя переключиться в чужую организацию
- `POST /api/payments/voucher`: при auth-ошибке redirect 307 → `/v2/login` (не 401, т.к. вызывается из form submit)
- Статус PRO проверяется индивидуально каждым защищённым эндпоинтом через `getUserActivePro()`

---

*Последнее обновление: 2026-06-30*

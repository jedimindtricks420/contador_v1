# Модуль I — Авторизация и сессии

**Статус:** ✅ Реализован  
**Файлы:** `src/lib/auth.ts`, `src/lib/auth-edge.ts`, `src/lib/context.ts`, `src/app/api/auth/`, `src/app/api/org/`  
**Последнее обновление:** 2026-06-30

---

## Стек

- **JWT:** библиотека `jose` (Edge Runtime совместима)
- **Алгоритм:** HS256
- **Срок действия:** 7 дней
- **Хранение:** HTTP-only cookie `v2_session` (константа `COOKIE_NAME`)
- **Секрет:** `process.env.JWT_SECRET` (fallback: `"fallback-secret-change-in-prod"`)

---

## Структура сессии (SessionPayload)

```typescript
interface SessionPayload {
  userId: string
  email: string
  activeOrgId: string | null
}
```

`activeOrgId` устанавливается при логине (первая доступная организация) или при переключении через `POST /api/org/switch`.

---

## Разделение auth / auth-edge

| Файл | Runtime | Назначение |
|------|---------|-----------|
| `auth-edge.ts` | Edge | `verifySession()`, `COOKIE_NAME` — используется в `middleware.ts` |
| `auth.ts` | Node.js | `createSession()`, `getSessionFromCookie()` — используется в API-роутах |
| `context.ts` | Node.js | Хелперы для API: `getSession()`, `getUser()`, `getActiveOrgId()`, `getActiveMembership()` |

---

## Хелперы контекста (context.ts)

```typescript
// Бросает "UNAUTHORIZED" если нет куки или она невалидна
async function getSession(): Promise<SessionPayload>

// Загружает User из БД по session.userId; бросает "UNAUTHORIZED" если не найден
async function getUser(): Promise<User>

// Возвращает session.activeOrgId; бросает "NO_ACTIVE_ORG" если null
// НИКОГДА не возвращает null — всегда либо string, либо throw
async function getActiveOrgId(): Promise<string>

// Возвращает OrgMember с include: { org }
// Бросает "NO_ACTIVE_ORG" если activeOrgId = null
// Бросает "FORBIDDEN" если пользователь не состоит в activeOrg
async function getActiveMembership(): Promise<OrgMember & { org: Organization }>
```

**Важно:** `getActiveOrgId()` всегда **бросает** при null. Паттерн `if (!orgId)` после вызова — мёртвый код.

### Вспомогательные ответы

```typescript
unauthorized(message?) → Response 401
forbidden(message?)    → Response 403
badRequest(message)    → Response 400
notFound(message?)     → Response 404
```

---

## Ошибки авторизации

| Ошибка | Условие |
|--------|---------|
| `"UNAUTHORIZED"` | Нет cookie или невалидный JWT |
| `"NO_ACTIVE_ORG"` | `session.activeOrgId === null` |
| `"FORBIDDEN"` | Пользователь не состоит в activeOrg |

---

## API-маршруты авторизации

### Регистрация

```
POST /api/auth/register
Body: { email, password, name?, orgName, inn? }
→ { ok: true }   (201, cookie установлен)
```

- Email нормализуется: `rawEmail.toLowerCase().trim()`
- Формат email валидируется regex: `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`
- Пароль: минимум 8 символов
- Хеширование: `bcryptjs`, rounds = 12
- В `prisma.$transaction()`: создаёт User + Organization + OrgMember (роль **OWNER**) + Period (текущий месяц) + Subscription (plan: FREE)
- Cookie `v2_session` устанавливается сразу

### Логин

```
POST /api/auth/login
Body: { email, password }
→ { user, activeOrgId }
```

- Проверка пароля через `bcrypt.compare`
- JWT содержит `userId`, `email`, `activeOrgId`
- Устанавливает HTTP-only cookie `v2_session`

### Выход

```
POST /api/auth/logout   (также GET)
→ redirect 302 → /v2/login
```

Удаляет cookie `v2_session`. Редирект на `${NEXT_PUBLIC_APP_URL}/v2/login` (полный URL с basePath).

### Сброс пароля — запрос

```
POST /api/auth/forgot-password
Body: { email }
→ { success: true }   (всегда, даже если email не найден — защита от перебора)
```

- Email ищется в нижнем регистре + trim
- Инвалидирует предыдущие неиспользованные токены (`usedAt = now()`)
- Создаёт запись **`PasswordResetToken`** (отдельная модель, не поле User)
- TTL: 1 час (`expiresAt = now() + 1h`)
- Ссылка в письме: `${NEXT_PUBLIC_APP_URL}/v2/reset-password?token=...`
- Если SMTP не настроен — URL логируется только на сервере, **не возвращается** клиенту

### Сброс пароля — применение

```
POST /api/auth/reset-password
Body: { token, password }
→ { success: true }

GET /api/auth/reset-password?token=...
→ { valid: true|false }   (проверка без сжигания токена)
```

- Ищет `PasswordResetToken` по `token`
- Проверяет: `record.usedAt === null` и `record.expiresAt > now()`
- В `prisma.$transaction([...])`: обновляет `User.passwordHash`, помечает токен как использованный

---

## Middleware (Edge)

**Файл:** `src/middleware.ts`

Защищает все маршруты `/v2/api/**` и `/v2/**` (кроме `/v2/api/auth/**`).  
Использует `auth-edge.ts` → `verifySession()` — читает cookie, верифицирует JWT без обращения к БД.  
При невалидном токене: 401 для API, redirect на `/v2/login` для страниц.

---

## Роли пользователей (OrgMember.role)

| Роль | Уровень доступа |
|------|----------------|
| `OWNER` | Полный доступ; единственный, кто может удалять других OWNER; принудительное закрытие периода |
| `ADMIN` | Полный доступ к данным; управление участниками и настройками; не может удалять OWNER |
| `ACCOUNTANT` | Работа с транзакциями, документами, отчётами |
| `VIEWER` | Только просмотр |

---

## Управление участниками

```
GET /api/org/members
→ список участников (один вызов getActiveMembership(), orgId из membership.orgId)

POST /api/org/members/invite
Body: { email, role }
→ { member, mockInvitePassword: string|null }
```

**Приглашение:**
- Допустимые роли для приглашения: `ACCOUNTANT`, `ADMIN`
- Новый пользователь: создаётся с временным паролем (crypto.randomBytes(8))
- Email приглашения отправляется если SMTP настроен
- `mockInvitePassword` возвращается **только** при `NODE_ENV !== "production"` И SMTP не настроен. В продакшне всегда `null`.

```
DELETE /api/org/members/[userId]
→ { ok: true }
```

**Защиты DELETE:**
- Нельзя удалить себя → 400
- ADMIN не может удалить OWNER → 403 (только OWNER может удалить другого OWNER)
- Нельзя удалить последнего OWNER → 400

---

## Переключение организации

```
POST /api/org/switch
Body: { orgId }
→ { ok: true }
```

Перевыпускает JWT с новым `activeOrgId`. Пользователь должен быть участником указанной организации.

---

*Последнее обновление: 2026-06-30*

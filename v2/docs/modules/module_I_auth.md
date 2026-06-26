# Модуль I — Авторизация и сессии

**Статус:** ✅ Реализован  
**Файлы:** `src/lib/auth.ts`, `src/lib/auth-edge.ts`, `src/lib/context.ts`, `src/app/api/auth/`

---

## Стек

- **JWT:** библиотека `jose` (Edge Runtime совместима)
- **Алгоритм:** HS256
- **Срок действия:** 7 дней
- **Хранение:** HTTP-only cookie `v2_session`
- **Секрет:** `process.env.JWT_SECRET` (fallback: `"fallback-secret-change-in-prod"`)

---

## Структура сессии (SessionPayload)

```typescript
interface SessionPayload {
  userId: string
  email: string
  activeOrgId: string | null   // ID активной организации
}
```

`activeOrgId` устанавливается при логине (первая доступная организация пользователя) или при переключении организации через `POST /api/org/switch`.

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
// Бросает UNAUTHORIZED если нет куки или она невалидна
async function getSession(): Promise<SessionPayload>

// Загружает User из БД по session.userId
async function getUser(): Promise<User>

// Возвращает session.activeOrgId, бросает NO_ACTIVE_ORG если null
async function getActiveOrgId(): Promise<string>

// Возвращает OrgMember с include: { org }, бросает FORBIDDEN если пользователь не состоит в activeOrg
async function getActiveMembership(): Promise<OrgMember & { org: Organization }>

// Служебные helpers для ответов
function unauthorized(message?): Response  → 401
function forbidden(message?): Response    → 403
function badRequest(message): Response    → 400
function notFound(message?): Response     → 404
```

---

## API-маршруты авторизации

### Регистрация

```
POST /api/auth/register
Body: { name: string; email: string; password: string; orgName?: string }
→ { user: User }
```

- Пароль хешируется через `bcrypt` (rounds: 10)
- Если `orgName` указан — автоматически создаётся организация и OrgMember с ролью `ADMIN`
- Cookie `v2_session` устанавливается сразу

### Логин

```
POST /api/auth/login
Body: { email: string; password: string }
→ { user: User; activeOrgId: string | null }
```

- Проверка пароля через `bcrypt.compare`
- JWT содержит `userId`, `email`, `activeOrgId` (первая организация пользователя)
- Устанавливает HTTP-only cookie `v2_session`

### Выход

```
POST /api/auth/logout
→ { ok: true }
```

Удаляет cookie `v2_session` (max-age: 0).

### Сброс пароля — запрос

```
POST /api/auth/forgot-password
Body: { email: string }
→ { ok: true }
```

Генерирует токен сброса (UUID), сохраняет его в `User.resetToken` + `User.resetTokenExpiry` (1 час). Отправляет письмо через `mailer.ts`.

### Сброс пароля — применение

```
POST /api/auth/reset-password
Body: { token: string; password: string }
→ { ok: true }
```

Проверяет токен + `resetTokenExpiry > now()`, обновляет `User.passwordHash`, очищает токен.

---

## Middleware (Edge)

```typescript
// src/middleware.ts (или в next.config — matcher)
```

Защищает все маршруты `/v2/api/**` и `/v2/**` (кроме `/v2/api/auth/**`).  
Использует `auth-edge.ts` → `verifySession()` — читает cookie, верифицирует JWT без обращения к БД.  
При невалидном токене → 401 для API, redirect на `/v2/login` для страниц.

---

## Роли пользователей (OrgMember.role)

| Роль | Уровень доступа |
|------|----------------|
| `ADMIN` | Полный доступ, управление участниками и настройками |
| `ACCOUNTANT` | Работа с транзакциями, документами, отчётами |
| `VIEWER` | Только просмотр (только чтение) |

Роли проверяются в API-роутах через `getActiveMembership()` → `membership.role`.

---

## Управление участниками

```
GET  /api/org/members              → список участников с ролями
POST /api/org/members/invite       Body: { email, role }  → приглашение (200 или 201)
DELETE /api/org/members/[userId]   → удалить участника
```

**Защиты:**
- Нельзя удалить себя (последнего ADMIN) — 400
- Только ADMIN может приглашать и удалять
- `DELETE` идентифицирует участника по `user.id` (не по `member.id`)

---

## Переключение организации

```
POST /api/org/switch
Body: { orgId: string }
→ { ok: true }
```

Перевыпускает JWT с новым `activeOrgId`. Пользователь должен быть участником указанной организации.

---

*Последнее обновление: 2026-06-26*

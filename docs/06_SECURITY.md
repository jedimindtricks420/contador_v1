# 06 — Безопасность

**Документ:** Security Reference  
**Версия:** 2.0  
**Дата:** 2026-06-26

---

## 1. Аутентификация

### JWT (JSON Web Token)

| Параметр | Значение |
|---------|---------|
| Библиотека | `jose` v6 (Edge Runtime compatible) |
| Алгоритм | HS256 |
| Секрет | `process.env.JWT_SECRET` (64+ символов) |
| Срок действия | 7 дней |
| Хранение | HTTP-only cookie `v2_session` |
| Флаги cookie | `httpOnly: true`, `secure: true` (HTTPS), `sameSite: "lax"` |

### Структура токена (payload)

```json
{
  "userId": "uuid",
  "email": "user@company.uz",
  "activeOrgId": "org-uuid",
  "iat": 1718500000,
  "exp": 1719104800
}
```

### Разделение auth по Runtime

| Файл | Runtime | Использование |
|------|---------|-------------|
| `auth-edge.ts` | Edge | Middleware — верификация без Node.js API |
| `auth.ts` | Node.js | API Route Handlers — создание сессии |
| `context.ts` | Node.js | Хелперы для API: getSession, getUser, getActiveOrgId |

### Хэширование паролей

```typescript
bcrypt.hash(password, 10)   // rounds = 10
bcrypt.compare(plain, hash)
```

---

## 2. Middleware (Edge Runtime)

Защищает все маршруты приложения. Работает перед рендерингом страниц.

```typescript
// Защищённые пути:
/v2/api/**           (кроме /v2/api/auth/**)
/v2/dashboard
/v2/transactions
// ... все пути кроме /v2/login, /v2/register, /v2/forgot-password, /v2/reset-password

// Логика:
1. Читает cookie v2_session
2. verifySession(token) → SessionPayload | null
3. null → 401 для API, redirect /v2/login для страниц
4. Пропускает запрос если токен валиден
```

---

## 3. Контроль доступа (RBAC)

### Роли

| Роль | Описание | Кто назначает |
|------|---------|-------------|
| `OWNER` | Владелец, создаётся при регистрации | Система |
| `ADMIN` | Полный доступ + управление участниками | OWNER / ADMIN |
| `ACCOUNTANT` | Работа с данными, нет доступа к настройкам участников | OWNER / ADMIN |

### Матрица доступа

| Действие | OWNER | ADMIN | ACCOUNTANT |
|---------|-------|-------|-----------|
| Просмотр данных | ✅ | ✅ | ✅ |
| Импорт транзакций | ✅ | ✅ | ✅ |
| Классификация | ✅ | ✅ | ✅ |
| Закрытие периода | ✅ | ✅ | ✅ |
| Настройки организации | ✅ | ✅ | ❌ |
| Управление правилами | ✅ | ✅ | ✅ |
| Приглашение участников | ✅ | ✅ | ❌ |
| Удаление участников | ✅ | ✅ | ❌ |

### Реализация проверки ролей

```typescript
// В API Route Handler:
const membership = await getActiveMembership();
if (membership.role === "ACCOUNTANT") {
  return forbidden("Недостаточно прав");
}
```

---

## 4. Многотенантная изоляция данных

**Принцип:** Shared Database, row-level isolation по `orgId`.

```typescript
// Каждый API-запрос к данным:
const orgId = await getActiveOrgId(); // из JWT
const data = await prisma.document.findMany({
  where: { orgId }   // ОБЯЗАТЕЛЬНО — без этого утечка между организациями
});
```

**Хелпер `prismaWithOrg`:** Обёртка над Prisma, не позволяет запросы без `orgId`.

### Что изолировано по orgId

- Все финансовые данные: `Document`, `JournalEntry`, `StagedTransaction`
- Справочники: `BankAccount`, `Counterparty`, `Rule`
- Периоды: `Period`
- Открытые позиции: `OpenItem`
- Налоговый календарь: `TaxCalendarEvent`
- Аудит: `AuditLog`

### Что глобальное (без orgId)

- `Account` — план счетов НСБУ (один для всех)
- `DocumentType` — типы документов (один для всех)

---

## 5. Управление участниками — защиты

```typescript
// Нельзя удалить себя:
if (targetUser.id === currentUser.id) {
  return badRequest("Нельзя удалить себя из организации");
}

// Нельзя удалить последнего ADMIN/OWNER:
const admins = await prisma.orgMember.count({
  where: { orgId, role: { in: ["OWNER", "ADMIN"] } }
});
if (admins <= 1 && ["OWNER", "ADMIN"].includes(targetMember.role)) {
  return badRequest("Нельзя удалить последнего администратора");
}
```

---

## 6. Защита API

### Input Validation

Все обязательные поля проверяются перед обработкой:

```typescript
// Пример:
if (!matchType || !matchValue || !categoryId) {
  return NextResponse.json({ error: "matchType, matchValue, categoryId обязательны" }, { status: 400 });
}
```

### Защита от IDOR

Все запросы по ID включают `orgId` в условие выборки:

```typescript
const period = await prisma.period.findFirst({
  where: { id: periodId, orgId }  // orgId обязателен
});
if (!period) return notFound();
```

### Защита закрытых периодов

```typescript
if (period.status === "CLOSED" || period.lockDate) {
  return Response.json({ error: "Период закрыт" }, { status: 423 });
}
```

---

## 7. Сброс пароля

1. `POST /auth/forgot-password { email }` → генерация UUID-токена, запись в `PasswordResetToken` (срок 1 час)
2. Отправка письма со ссылкой вида: `https://contador.uz/v2/reset-password?token=UUID`
3. `POST /auth/reset-password { token, password }` → проверка `expiresAt > now() && usedAt == null`
4. Обновление `User.passwordHash`, запись `usedAt = now()` (токен одноразовый)

---

## 8. Admin Panel

Панель администратора (порт 3031) защищена дополнительным слоем:

- **Basic Auth** через nginx или встроенная в Express
- `ADMIN_PASSWORD` в переменных окружения
- Доступ только с доверенных IP (настраивается в nginx)
- Rate limiting: `express-rate-limit`
- HTTP security headers: `helmet`

---

## 9. Переменные окружения (секреты)

| Переменная | Описание | Где хранится |
|-----------|---------|------------|
| `JWT_SECRET` | Подпись JWT-токенов | `/home/admin1/contador/v2/.env` |
| `OPENAI_API_KEY` | Ключ OpenAI API | `/home/admin1/contador/v2/.env` |
| `DATABASE_URL` | Строка подключения к PostgreSQL | `/home/admin1/contador/v2/.env` |
| `SMTP_*` | Настройки email для сброса пароля | `/home/admin1/contador/v2/.env` |
| `ADMIN_PASSWORD` | Пароль от панели администратора | `/home/admin1/contador/.env` |

**Требования к `JWT_SECRET`:** минимум 32 случайных байта (64+ hex символов).  
Генерация: `openssl rand -hex 32`

---

## 10. Журнал аудита (AuditLog)

Все критические действия записываются в таблицу `AuditLog`:

| Action | Когда |
|--------|-------|
| `POST_DOCUMENT` | Проведение документа |
| `VOID_DOCUMENT` | Аннулирование документа |
| `CLOSE_PERIOD` | Закрытие учётного периода |
| `REPOST_DOCUMENT` | Перепроведение документа |

**Структура записи:** `{ orgId, userId, action, entityType, entityId, oldValue, newValue, createdAt }`

---

*Дата: 2026-06-16*

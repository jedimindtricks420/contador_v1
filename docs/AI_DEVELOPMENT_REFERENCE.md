# Справочник разработчика: AI-модуль

Ключевые детали реализации для работы с эндпоинтами `src/app/api/ai/`.

---

## Файлы модуля

| Файл | Назначение |
|---|---|
| `ai/knowledge-base.ts` | `MASTER_COA_COMPACT` (266 счетов) + `INDUSTRY_TEMPLATES_COMPACT` (22 шаблона) |
| `ai/prompts.ts` | Системный промпт: правила НСБУ, зарплатный цикл, НДС, займы |
| `src/app/api/ai/chat/route.ts` | POST — приём сообщения, вызов GPT-4o, сохранение истории |
| `src/app/api/ai/execute/route.ts` | POST — создание проводок из JSON-ответа AI |

---

## 1. Авторизация и контекст

**Файл:** `src/lib/context.ts`

```typescript
export async function getActiveOrganizationId(): Promise<string> {
  const sessionToken = (await cookies()).get("session")?.value;
  if (!sessionToken) throw new Error("Unauthorized");
  const payload = await decrypt(sessionToken);
  const user = await prisma.user.findUnique({
    where: { id: payload.user?.id },
    select: { active_org_id: true }
  });
  if (!user?.active_org_id) throw new Error("No active organization");
  return user.active_org_id;
}
```

---

## 2. Chat endpoint (`/api/ai/chat`)

**Модель:** `gpt-4o`
**Формат ответа:** `{ type: "json_object" }` — AI всегда возвращает валидный JSON.

**Тарификация:**
- FREE: 10 запросов/месяц
- PRO: 300 запросов/месяц
- MYAPI: пользовательский ключ OpenAI, без ограничений

**Что сохраняется в БД:**
- `ChatMessage` — история сообщений пользователя и AI
- `AiUsage` — количество токенов, стоимость запроса

**Стоимость токенов (GPT-4o):**
- Input: $2.50 / 1M токенов
- Output: $10.00 / 1M токенов

---

## 3. Execute endpoint (`/api/ai/execute`)

Принимает JSON с транзакциями от AI и создаёт их в БД.

**Формат запроса:**
```json
{
  "transactions": [
    {
      "step": 1,
      "step_label": "Начисление налога",
      "description": "Налог с оборота январь",
      "amount": 500000,
      "date": "2026-01-31",
      "period": "01.2026",
      "debit":  { "code": "9430", "name": "Прочие опер. расходы", "is_missing": false },
      "credit": { "code": "6410", "name": "Задолженность по налогам", "is_missing": false }
    }
  ]
}
```

**Поддерживается также одиночный формат:**
```json
{ "data": { ...одна транзакция... } }
```

**Валидация на execute:**
- Сумма > 0
- Дебет ≠ Кредит
- Забалансовые счета (OFF_BALANCE) — ошибка
- `validateTransaction()` — проверка закрытого периода и правил 0000

**Если `is_missing: true`:**
Счёт автоматически создаётся через `upsert` из `MasterAccount`. Забалансовые счета — ошибка, не создаются.

**Audit log:** каждая AI-транзакция пишется в `AuditLog` с `action: "AI_TRANSACTION_AUTO_CREATE"`.

---

## 4. Системный промпт

**Файл:** `ai/prompts.ts` → функция `getJournalSystemPrompt(activeAccounts, closedDate)`

Промпт включает:
1. `MASTER_COA_COMPACT` — 266 проводимых счетов в pipe-формате `код|название|тип|группа|`
2. Список активных счетов текущей организации
3. Правила двойной записи (налог с оборота, зарплата, предоплата, НДС)
4. Классификацию расходов (9420/9430/9410)
5. Правила по займам, ОС, забалансовым счетам
6. JSON-схему ответа

**Зарплатный цикл (5 шагов обязательно):**
```
Д 9420 — К 6710  (начисление ЗП brutto)
Д 9420 — К 6520  (соцналог 12%)
Д 6710 — К 6410  (удержание НДФЛ)
Д 6710 — К 6530  (удержание ИНПС 0.1%)
Д 6710 — К 5110  (выплата на руки)
```

---

## 5. Активация счетов через AI

При `is_missing: true` в ответе AI — счёт создаётся автоматически:

```typescript
const master = await tx.masterAccount.findFirst({ where: { code: accInfo.code } });
await tx.account.upsert({
  where: { code_organization_id: { code: master.code, organization_id } },
  create: { code: master.code, name: master.name, type: master.type, organization_id, master_account_id: master.id, is_active: true },
  update: { is_active: true }
});
```

---

## 6. Получение счетов для промпта

```typescript
// В chat/route.ts — передаётся в getJournalSystemPrompt()
const activeAccounts = await prisma.account.findMany({
  where: { organization_id: orgId, is_active: true },
  select: { code: true, name: true }
});
```

---

*Contador v2.0 — AI Development Reference*

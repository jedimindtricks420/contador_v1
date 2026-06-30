# Модуль D — Открытые позиции (Open Items)

**Статус:** ✅ Реализован  
**Файлы:** `src/app/open-positions/OpenPositionsClient.tsx`, `src/app/api/open-items/route.ts`, `src/app/api/open-items/[id]/close/`, `src/app/api/open-items/[id]/reopen/`  
**Последнее обновление:** 2026-06-30

---

## Назначение

Отслеживание буферных счетов: авансы, подотчётные суммы, депозиты. Автоматически помечает позиции как «риск» при истечении дедлайна.

---

## Модель OpenItem

```typescript
interface OpenItem {
  id: string
  orgId: string
  accountId: string           // Буферный счёт (4220, 4310, 6310, ...)
  counterpartyId?: string
  openingDocumentId: string   // Документ, создавший позицию
  closingDocumentId?: string  // Документ, закрывший позицию
  amount: Decimal
  dateOpened: Date
  dateClosed?: Date
  riskDeadline?: Date
  status: "OPEN" | "CLOSED" | "RISK"
  affectedPeriodId?: string
}
```

---

## Статусы

| Статус | Описание |
|--------|---------|
| `OPEN` | Аванс выдан/получен, ещё не закрыт |
| `CLOSED` | Позиция закрыта (зачтена) |
| `RISK` | Истёк дедлайн — требует внимания |

---

## Автоматические дедлайны риска (из `constants.ts`)

| Счёт | Описание | Дедлайн (RISK_DAYS) |
|------|---------|---------------------|
| 4220 | Подотчётные суммы (командировки) | 10 дней (`ACCOUNTABLE`) |
| 4310, 6310, 6990 | Авансы выданные/полученные, невыясненные | 30 дней (`DEFAULT`) |
| 5830, 6820 | Краткосрочные депозиты, займы учредителей | 365 дней (`LONG_TERM`) |

При `openItem.riskDeadline < now()` — функция `markRiskyItems(orgId)` обновляет статус на `RISK`. Вызывается автоматически при каждом GET /api/open-items.

---

## API

### GET /api/open-items

```
GET /api/open-items?status=OPEN|CLOSED|RISK|UNRESOLVED|ALL&accountCode=&periodId=&search=
```

**Фильтр `status`:**
- `OPEN`, `RISK`, `CLOSED` — по конкретному статусу
- `UNRESOLVED` — `status IN ("OPEN", "RISK")`
- `ALL` (по умолчанию) — без фильтра

**Поиск `search`:** транслируется в Prisma OR на стороне БД:
```typescript
where.OR = [
  { counterparty: { name: { contains: search, mode: "insensitive" } } },
  { counterparty: { inn: { contains: search } } },
]
```

**Важно:** без ограничения `take` — возвращаются **все** отфильтрованные позиции.

**Итоги (`summary`):** вычисляются через `prisma.openItem.aggregate()` без сканирования всех строк:
```typescript
prisma.openItem.aggregate({
  where: { orgId, status: "OPEN" },
  _count: true,
  _sum: { amount: true }
})
```

**Ответ:**
```typescript
{
  items: OpenItem[],
  summary: {
    totalOpen: number,
    totalRisk: number,
    amountOpen: number,
    amountRisk: number,
    byAccount: [{ accountCode, name, count, amount }]
  }
}
```

### PATCH /api/open-items/[id]/close

Ручное закрытие позиции (через кнопку «Закрыть» в UI).

```
PATCH /api/open-items/[id]/close
Body: { reason?: string }
→ { item: OpenItem }
```

Используется `where: { id, orgId }` — изоляция по организации.  
Ошибка 500 возвращает **универсальное** сообщение (не `err.message`).

### POST /api/open-items/[id]/reopen

Повторное открытие вручную закрытой позиции.

```
POST /api/open-items/[id]/reopen
→ { item: OpenItem }
```

Используется `where: { id, orgId }` — изоляция по организации.

---

## Создание OpenItem

Создаётся движком проводок (Модуль H) при проведении документа с `opensItem: true` в шаблоне:

```json
{
  "lines": [...],
  "opensItem": true,
  "itemAccountCode": "6310"
}
```

**Автозакрытие** происходит при проведении документов с полем шаблона `closesOpenItemByAccount`:
- `SUPPLIER_REFUND` — закрывает позицию на счёте 4310
- `ADVANCE_RETURN_SENT` — закрывает позицию на счёте 6310

Подробнее — в Модуле H.

---

## UI особенности (OpenPositionsClient.tsx)

- Группировка: RISK → OPEN → CLOSED
- Фильтры: статус, счёт, период, поиск
- Empty state: два варианта — «нет позиций» vs «нет результатов по фильтру»
- Ошибки: инлайн в модалах (не через `alert()`)
- Load error: кнопка «Повторить»

---

## Настройка дедлайнов

`GET/PATCH /api/settings/open-item-deadlines` — переопределение дедлайнов риска на уровне организации (хранится в `Organization.settings`).

---

*Последнее обновление: 2026-06-30*

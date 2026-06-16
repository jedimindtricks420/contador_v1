# Модуль D — Открытые позиции (Open Items)

**Статус:** ✅ Реализован  
**Файлы:** `src/app/open-positions/OpenPositionsClient.tsx`, `src/app/api/open-items/`

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
  status: "OPEN" | "CLOSED" | "RISK"
  riskDeadline?: Date
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

## Автоматические дедлайны риска

| Счёт | Описание | Дедлайн |
|------|---------|---------|
| 4220 | Подотчётные суммы (командировки) | 10 дней |
| 4310 | Авансы выданные поставщикам | 30 дней |
| 6310 | Авансы полученные от покупателей | 30 дней |
| 6990 | Неидентифицированные поступления | 30 дней |
| 5830 | Краткосрочные депозиты | 365 дней |
| 6820 | Займы от учредителей | 365 дней |

При `openItem.riskDeadline < now()` → статус автоматически меняется на `RISK`.

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

---

## API

```
GET /api/open-items?status=OPEN|CLOSED|RISK|UNRESOLVED&accountId=&periodId=&search=
→ { items: OpenItem[], total: number }

PATCH /api/open-items/[id]/close
Body: { reason?: string }
→ { item: OpenItem }

POST /api/open-items/[id]/reopen
→ { item: OpenItem }
```

### Ручное закрытие

Нажатие «Закрыть» в UI → модальное подтверждение → `PATCH /api/open-items/[id]/close`.  
Нажатие «Открыть повторно» → `POST /api/open-items/[id]/reopen` (только для позиций со статусом `CLOSED`, закрытых вручную).

---

## UI особенности (OpenPositionsClient.tsx)

- Группировка: RISK → OPEN → CLOSED
- Фильтры: статус, счёт, период, поиск
- Empty state: два варианта — «нет позиций» vs «нет результатов по фильтру»
- Ошибки: инлайн в модалах (не через `alert()`)
- Load error: кнопка «Повторить»

---

## Настройка дедлайнов

`GET/POST /api/settings/open-item-deadlines` — переопределение дедлайнов риска на уровне организации.

---

*Последнее обновление: 2026-06-16*

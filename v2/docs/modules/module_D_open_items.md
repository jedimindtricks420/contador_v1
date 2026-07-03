# Модуль D — Открытые позиции (Open Items)

**Статус:** ✅ Реализован  
**Файлы:** `src/app/open-positions/OpenPositionsClient.tsx`, `src/app/api/open-items/route.ts`, `src/app/api/open-items/[id]/close/`, `src/app/api/open-items/[id]/reopen/`  
**Последнее обновление:** 2026-07-02

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

`getRiskDeadline(accountCode, dateOpened, orgSettings)` в `src/lib/openItems.ts` считает дедлайн по приоритету:
1. `orgSettings.openItemDeadlines[accountCode]` — переопределение конкретной организации (см. «Настройка дедлайнов» ниже) — **реально применяется** при создании OpenItem в `postDocument()`, а не только хранится.
2. `RISK_DAYS_BY_ACCOUNT[accountCode]` — встроенное значение по умолчанию для конкретного счёта.
3. `RISK_DAYS_DEFAULT` (30 дней) — общий fallback для любого другого буферного счёта.

| Счёт | Описание | Дедлайн по умолчанию |
|------|---------|---------------------|
| 4220 | Подотчётные суммы (командировки) | 10 дней |
| 4230 | Подотчётные суммы (общехозяйственные) | 10 дней |
| 4890 | Депозиты, расчёты с агрегаторами | 365 дней |
| 6820 | Займы от учредителей | 365 дней |
| 6610 | Дивиденды к оплате | 365 дней |
| 4310, 6310, 6810, 6010, 4010, 4720 и любой другой буферный счёт | Авансы, кредиторка/дебиторка, займы сотрудникам и т.д. | 30 дней (`RISK_DAYS_DEFAULT`) |

Список буферных счетов не хардкодится отдельно — `getOpenItemBufferAccountCodes()` в `ensureBaseData.ts` вычисляет его из `baseDocumentTypes` (все типы с `opensItem: true`), поэтому появление нового типа документа с открытием OpenItem автоматически подхватывается настройками дедлайнов без правки этого списка вручную.

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

**Автозакрытие** происходит при проведении документов с полем шаблона `closesOpenItemByAccount`.
Требует `counterpartyId` на закрывающем документе — без него шаг закрытия молча пропускается
(см. Модуль H). Полный список на сегодня:

| Тип документа | Закрывает счёт |
|----------------|---------------|
| `REVENUE_COLLECTION` | 4010 |
| `SUPPLIER_PAYMENT` / `_GOODS` / `_SERVICES` / `_OTHER` / `_VAT` | 6010 |
| `GOODS_RECEIVED_PREPAID`, `SERVICE_RECEIVED_PREPAID` | 4310 |
| `SUPPLIER_REFUND` | 4310 |
| `ADVANCE_RETURN_SENT` | 6310 |
| `BANK_LOAN_REPAYMENT` | 6810 |
| `FOUNDER_LOAN_REPAYMENT` | 6820 |
| `DIVIDEND_PAYMENT` | 6610 |
| `ACCOUNTABLE_WRITEOFF`, `ACCOUNTABLE_RETURN` | 4220 |
| `ACCOUNTABLE_GENERAL_WRITEOFF`, `ACCOUNTABLE_GENERAL_RETURN` | 4230 |
| `DEPOSIT_RETURN` | 4890 |

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

`GET/PATCH /api/settings/open-item-deadlines` — переопределение дедлайнов риска на уровне
организации (хранится в `Organization.settings.openItemDeadlines`), реально учитывается
в `getRiskDeadline()` при создании OpenItem.

- **GET** возвращает `{ accounts: [{ code, name, days }] }` — счета и их `name` берутся из
  `getOpenItemBufferAccountCodes()` + join с таблицей `Account` (не хардкодятся в UI); `days` —
  override организации, иначе встроенный дефолт (`RISK_DAYS_BY_ACCOUNT`/`RISK_DAYS_DEFAULT`).
- **PATCH** принимает `{ [код_счёта]: дни }`, валидирует, что код входит в
  `getOpenItemBufferAccountCodes()` и что `дни` — положительное число, иначе 400.
- UI (`settings/open-items-deadlines/page.tsx`) рендерит список полностью по ответу GET —
  никаких захардкоженных счетов в компоненте.

---

*Последнее обновление: 2026-07-02*

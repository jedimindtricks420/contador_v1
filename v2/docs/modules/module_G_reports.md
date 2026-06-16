# Модуль G — Отчёты

**Статус:** ✅ Реализован  
**Файлы:** `src/app/api/reports/`, `src/lib/reports/`, `src/app/reports/` (pages)

---

## Обзор

| Отчёт | Маршрут | API | Описание |
|-------|---------|-----|---------|
| ОСВ | `/v2/reports/osv` | `GET /api/reports/osv` | Оборотно-сальдовая ведомость |
| Журнал | `/v2/reports/journal` | `GET /api/reports/journal` | Журнал проводок |
| Карточка счёта | `/v2/reports/account-card` | `GET /api/reports/account-card` | Обороты по одному счёту |
| Субконто | `/v2/reports/subconto` | `GET /api/reports/subconto` | Анализ по контрагентам |
| Баланс | `/v2/reports/balance` | `GET /api/reports/balance` | Бухгалтерский баланс |
| Анализ счёта | `/v2/reports/account-analysis` | `GET /api/reports/account-analysis` | Детальный анализ счёта |

---

## G1. ОСВ (Оборотно-сальдовая ведомость)

**Файл:** `src/lib/reports/osv.ts` → `calculateOSV()`  
**API:** `GET /api/reports/osv?orgId=&from=&to=&expandSubconto=true|false`

### Структура строки

```typescript
interface OSVRow {
  accountId: string
  accountCode: string
  accountName: string
  accountType: string
  openingDebit: number
  openingCredit: number
  debitTurnover: number
  creditTurnover: number
  closingDebit: number
  closingCredit: number
  subconto?: OSVSubcontoRow[]   // если expandSubconto=true
}
```

### Алгоритм

1. Загрузить все счета (`Account`, сортировка по `code ASC`)
2. Выполнить два агрегирующих SQL-запроса к `JournalEntry`:
   - **Начальное сальдо** — суммы Дт/Кт по дате `< from`
   - **Обороты** — суммы Дт/Кт по дате `>= from AND <= to`
3. Рассчитать сальдо через `calcBalance()` на основе типа счёта
4. Строки с нулями во всех колонках — пропускаются (не включаются в результат)
5. При `expandSubconto=true` — аналогичные запросы с разбивкой по `counterpartyId`

### Логика сальдо (calcBalance)

```typescript
function calcBalance(type: AccountType, rawDebit: Decimal, rawCredit: Decimal)
  → { d: Decimal; c: Decimal }
```

| Тип счёта | Нормальное сальдо | Логика |
|-----------|------------------|--------|
| `ASSET`, `CONTRA_LIABILITY` | Дебетовое | net = Дт − Кт; если ≥ 0 → в Дт, иначе → в Кт |
| `LIABILITY`, `CONTRA_ASSET` | Кредитовое | net = Кт − Дт; если ≥ 0 → в Кт, иначе → в Дт |
| `ACTIVE_PASSIVE`, `TRANSIT` | Двустороннее | net = Дт − Кт; если ≥ 0 → в Дт, иначе → в Кт |
| `OFF_BALANCE` | Дебетовое (забалансовый) | Всегда в колонке Дт |

### Итого

Ответ содержит `{ rows, totals }`. `totals` — суммарная строка по всем счётам (используется для проверки баланса: суммарное сальдо Дт = суммарное сальдо Кт).

---

## G2. Журнал проводок

**Файл:** `src/lib/reports/journal.ts`  
**API:** `GET /api/reports/journal?orgId=&from=&to=&accountCode=`

Список всех `JournalEntry` за период, отфильтрованных по организации и дате. Опциональный фильтр по коду счёта.

Возвращает:
```typescript
{
  date: Date
  documentId: string
  documentType: string
  accountCode: string
  accountName: string
  counterpartyName: string | null
  debit: number
  credit: number
}[]
```

---

## G3. Карточка счёта

**Файл:** `src/lib/reports/accountCard.ts`  
**API:** `GET /api/reports/account-card?orgId=&from=&to=&accountCode=`

Обороты по одному конкретному счёту с хронологией:

```typescript
{
  openingBalance: { debit: number; credit: number }
  entries: {
    date: Date
    document: string
    description: string
    debit: number
    credit: number
    balance: number   // нарастающее сальдо
  }[]
  closingBalance: { debit: number; credit: number }
}
```

---

## G4. Субконто

**Файл:** `src/lib/reports/subconto.ts`  
**API:** `GET /api/reports/subconto?orgId=&from=&to=&accountCode=&counterpartyId=`

Разбивка оборотов по субаналитике (контрагент). Используется для детализации расчётов с конкретным поставщиком или покупателем.

---

## G5. Баланс

**API:** `GET /api/reports/balance?orgId=&periodId=`

Статические разделы из ПБУ РУ. Формируется из ОСВ путём группировки счетов по разделам плана счетов НСБУ №21:

- **Раздел I** — Долгосрочные активы (01xx, 02xx, 04xx, 05xx, 07xx, 08xx)
- **Раздел II** — Текущие активы (10xx, 11xx, 21xx, 26xx, 27xx, 40xx, 41xx, 51xx, 52xx)
- **Раздел III** — Собственный капитал (81xx, 82xx, 83xx, 84xx, 85xx)
- **Раздел IV** — Долгосрочные обязательства (70xx, 73xx)
- **Раздел V** — Текущие обязательства (60xx, 61xx, 62xx, 63xx, 64xx, 65xx, 68xx, 69xx)

Итог: Актив = Пассив.

---

## G6. Анализ счёта

**API:** `GET /api/reports/account-analysis?orgId=&from=&to=&accountCode=`

Корреспонденция выбранного счёта с другими счётами. Показывает какие счета дебетовались/кредитовались в паре с выбранным за период.

---

## Общие параметры API отчётов

| Параметр | Тип | Описание |
|---------|-----|---------|
| `orgId` | string | ID организации |
| `from` | ISO date | Начало периода |
| `to` | ISO date | Конец периода |
| `periodId` | string | Альтернатива `from`/`to` |
| `accountCode` | string | Фильтр по счёту |

---

*Последнее обновление: 2026-06-16*

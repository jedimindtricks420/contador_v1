# Модуль E — Закрытие месяца

**Статус:** ✅ Реализован  
**Файлы:** `src/app/closing/`, `src/app/api/closing/`, `src/lib/closing.ts`  
**Последнее обновление:** 2026-06-30

---

## Назначение

7-шаговый мастер для полного закрытия учётного периода: импорт выписки → классификация → реестр → начисления → курсовые разницы → Soliq → финализация.

---

## Архитектура мастера

**Компонент:** `ClosingWizard.tsx` — контейнер, управляет состоянием шагов.  
**Состояние:** сохраняется в `Period.closingData` (JSON) через `saveClosingState()` — прогресс не теряется при перезагрузке.

### saveClosingState

```typescript
async function saveClosingState(periodId: string, patch: any, orgId?: string): Promise<void>
```

- Выполняет **мелкое слияние** (shallow merge) `patch` в текущий `closingData`
- Если `orgId` передан — предварительно проверяет принадлежность периода организации через `prisma.period.findFirst({ where: { id: periodId, orgId } })`
- Обновляет in-memory кэш + запись в БД (`period.update`)

### Структура closingData

```typescript
interface ClosingData {
  currentStep: number
  accruals: {
    salaryAmount: number
    depreciationAmount: number
    rentAmount: number
  }
  fxDiff: {
    exchangeRate: number
    difference: number
  }
  soliqMatched: {
    matched: number
    unmatched: number
  }
}
```

---

## Шаги мастера (7 шагов)

### Шаг 1 — Импорт выписки (`Step1Import.tsx`)

- Выбор банковского счёта + загрузка файла
- Форматы: 1CClientBankExchange (.txt), Excel (Asaka, Kapital, Ipak Yoli)
- Preview первых строк перед импортом
- Импорт → `StagedTransaction[]` со статусом `IMPORTED`
- Кнопка «Откатить» — удаляет весь пакет по `importBatchId`

### Шаг 2 — Классификация (`Step2Clarification.tsx`)

- Запускает движок правил → AI-классификатор (GPT-4o-mini)
- Показывает очередь NEEDS_CLARIFICATION групп
- При ответе на все → переход к шагу 3
- Опция «запомнить» — создаёт новое правило

### Шаг 3 — Реестр документов (`Step3Registry.tsx`)

Список всех некатегоризированных транзакций с типами документов.  
Запрашивает: `GET /v2/api/transactions?periodId=...&status=uncategorized&limit=2000`  
(`status=uncategorized` → Prisma `{ in: ["IMPORTED", "NEEDS_CLARIFICATION"] }`)

### Шаг 4 — Начисления (`Step4Accruals.tsx`)

Ввод сумм, отсутствующих в выписке. Данные сохраняются в `closingData.accruals`.

| Поле | Тип документа | Проводка |
|------|-------------|---------|
| ФОТ | SALARY_ACCRUAL | Дт 9420 → Кт 6710 (брутто) |
| | | Дт 6710 → Кт 6530 (ИНПС 0.1%) |
| | | Дт 6710 → Кт 6410 (НДФЛ в бюджет 11.9%) |
| | | Дт 9420 → Кт 6520 (соцналог 12%) |
| Амортизация | DEPRECIATION_ACCRUAL | Дт 9430 → Кт 0200 |
| Аренда | RENT_ACCRUAL | Дт 9420 → Кт 6010 |

**API:**
```
POST /api/closing/[periodId]/step/4/complete
Body: { salaryAmount, depreciationAmount, rentAmount }

DELETE /api/closing/[periodId]/accruals
→ { reset: true }
```

### Шаг 5 — Курсовые разницы (`Step5FxDiff.tsx`)

- Ввод официального курса ЦБ на конец периода (или `GET /api/cbu-rate`)
- Расчёт: (текущий курс − предыдущий) × остаток счёта 5210
- Если разница ≠ 0 → документ `FX_DIFFERENCE`:
  - Доход: Дт 5210 → **Кт 9540** (FX_INCOME)
  - Расход: Дт **9620** → Кт 5210 (FX_EXPENSE)

Счета 9540 и 9620 (не 9030/9430) — из констант `ACCOUNTS.FX_INCOME` / `ACCOUNTS.FX_EXPENSE`.

### Шаг 6 — Soliq (`Step6Soliq.tsx`)

- Загрузка Excel-выгрузки my.soliq.uz
- Отправка на `/v2/api/import/soliq` → автоматическое сопоставление ЭСФ с транзакциями
- Статистика: N сопоставлено / M не сопоставлено
- Кнопка «AI-сверка» — дополнительный проход через GPT (тариф PRO)
- Шаг можно пропустить

**Сохранение результата Soliq:**  
`POST /api/closing/[periodId]/step/6/complete` оборачивает все вызовы `postDocument` в единую транзакцию БД:
```typescript
await prisma.$transaction(async (tx) => { ... }, {
  maxWait: 5000,
  timeout: 120000   // 120 секунд (поднято с 20с для больших пакетов ЭСФ)
});
```

### Шаг 7 — Финализация (`Step7Summary.tsx`)

**Вызов:** `POST /api/closing/[periodId]/finalize`

Вся финализация выполняется в **одном** `prisma.$transaction()`.

---

## Алгоритм finalizePeriod() (`src/lib/closing.ts`)

### Блок A — Начисление зарплаты

- Создаёт SALARY_ACCRUAL если `salaryAmount > 0` и документ ещё не существует
- Шаблон генерируется через upsert (обновляет ставки при изменении)
- Дополнительно: если у сотрудников есть займ (сальдо 4720 > 0) → создаёт SALARY_OFFSET на нетто-зарплату (коэффициент 1 − NDFL = 0.88)

### Блок B — Амортизация

- Создаёт DEPRECIATION_ACCRUAL если `depreciationAmount > 0`
- Проводка: Дт 9430 → Кт 0200

### Блок C — Аренда

- Создаёт RENT_ACCRUAL если `rentAmount > 0`
- Проводка: Дт 9420 → Кт 6010

### Блок D — Курсовые разницы

- Создаёт FX_DIFFERENCE если `fxDiff.difference ≠ 0`
- Использует условные строки (condition) в шаблоне

### Блок E — Налоги

Агрегирует JournalEntry за период для расчёта выручки и прибыли:
- `totalRevenue` = Кт(9010 + 9020 + 9030) за период
- `otherIncome` = Кт − Дт по счетам 93xx
- `netProfit` = выручка + прочие доходы + fx-доходы − все расходы − fx-расходы

**Режим VAT:**
- Если `netProfit > 0` → `PROFIT_TAX_ACCRUAL` (Дт 9810 → Кт 6410, 15%)

**Режим TURNOVER_TAX:**
- Если `totalRevenue > 0` → `TURNOVER_TAX_ACCRUAL` (Дт 9810 → Кт 6410)
- Ставка: `org.turnoverTaxRate` (дефолт 4%)

### Блок F — Налоговый календарь

Удаляет старые PENDING-события периода, затем создаёт новые `TaxCalendarEvent`:
- PERSONAL_INCOME_TAX (НДФЛ 11.9% от ФОТ)
- INPS (0.1% от ФОТ)
- SOCIAL_TAX (12% от ФОТ)
- PROFIT_TAX или TURNOVER_TAX (в зависимости от режима)

Срок: 20-е число следующего месяца (`CLOSING.TAX_DUE_DAY = 20`).

### Блок G — Динамический пересчёт налогового календаря

После создания событий вызывает `upsertTaxCalendarEventsForPeriod(periodId, orgId, tx)`:
- Для режима VAT: рассчитывает НДС = исходящий НДС (6410, кроме налоговых начислений) − входящий НДС (4410)
- Для режима TURNOVER_TAX: пересчитывает налог с оборота по актуальной выручке
- Создаёт или обновляет `TaxCalendarEvent` типа VAT / TURNOVER_TAX

Ошибки `upsertTaxCalendarEventsForPeriod` в postDocument перехватываются молча (только console.error) — не прерывают проводку.

### Блок H — Реформация баланса (PERIOD_CLOSING)

Переносит ненулевые TRANSIT-счета (9xxx) на 9910:
```
Кредитовый остаток (доходный счёт):  Дт 9xxx → Кт 9910
Дебетовый остаток (расходный счёт):  Дт 9910 → Кт 9xxx
```

Один документ `PERIOD_CLOSING` на весь период.

### H2 — Годовое закрытие при декабре

Если `period.month === 12` — автоматически выполняет перенос 9910 → 8710 внутри той же транзакции (если документ YEAR_END_CLOSE ещё не существует).

### Блок I — Блокировка

`Period.status = "CLOSED"`, `Period.lockDate = последний день месяца`.

---

## Годовое закрытие (Year-End Close)

**Файл:** `src/app/api/closing/year-end/route.ts`  
**Условия:** декабрь + период CLOSED + нет дублирующего YEAR_END_CLOSE

**Вызов:**
```
POST /api/closing/year-end
Body: { periodId }
```

**Алгоритм:**
1. Проверить: период декабря, CLOSED, без дубля
2. Вычислить `net9910 = Σ(debit − credit)` по счёту 9910 за весь год (raw SQL)
3. Если `net9910 = 0` → возвращает `{ transferred: 0 }` без создания документа
4. Создать документ `YEAR_END_CLOSE` (дата: 31 декабря)
5. Проводки в `prisma.$transaction()`:
   - Прибыль (`net9910 < 0`, кредитовый остаток): **Дт 9910 → Кт 8710**
   - Убыток (`net9910 > 0`, дебетовый остаток): **Дт 8710 → Кт 9910**
6. Записать `AuditLog` (action: `YEAR_END_CLOSE`, userId: `"system"`)

**Результат:** `9910 = 0`, `8710` = накопленная нераспределённая прибыль.

---

## Переоткрытие периода

**API:** `POST /api/periods/[id]/reopen`

Требует: период закрыт, нет документа YEAR_END_TRANSFER в следующем году.

В `prisma.$transaction()`:
1. Найти и удалить системные документы закрытия (PERIOD_CLOSING, SALARY_ACCRUAL, DEPRECIATION_ACCRUAL, RENT_ACCRUAL, FX_DIFFERENCE, PROFIT_TAX_ACCRUAL)
2. Удалить связанные OpenItem
3. Удалить PENDING TaxCalendarEvent периода
4. Разблокировать: `status = "OPEN"`, `lockDate = null`, `closingData = DbNull`

Затем сбрасывает in-memory кэш: `clearClosingState(id)`.

---

## Принудительное закрытие

**API:** `POST /api/periods/[id]/close`

- По умолчанию: проверяет, что начисления были сделаны (документы SALARY_ACCRUAL / DEPRECIATION_ACCRUAL / FX_DIFFERENCE). Если нет → 400 с `requiresForce: true`
- С `{ force: true }`: пропускает проверку; требует роль **OWNER** или **ADMIN**
- Использует `prisma.period.updateMany({ where: { id, orgId } })` — изоляция по организации

---

## API закрытия

```
GET  /api/closing/[periodId]/state              # Состояние мастера
POST /api/closing/[periodId]/step/[N]/complete  # Завершить шаг N (1–7)
POST /api/closing/[periodId]/finalize           # Финализировать период
DELETE /api/closing/[periodId]/accruals         # Сбросить начисления

POST /api/closing/year-end                      # Годовое закрытие (декабрь)
GET  /api/closing/year-end/status               # Статус годового закрытия

POST /api/periods/[id]/close                    # Принудительное закрытие (OWNER/ADMIN)
POST /api/periods/[id]/reopen                   # Переоткрыть закрытый период
```

---

## Защиты и ограничения

- Период нельзя закрыть повторно (`Period.status === "CLOSED"` → 409)
- Проводки в закрытом периоде запрещены (`lockDate ≠ null` → ошибка)
- Закрытие года только в декабре (период.month ≠ 12) → 400
- Step/6/complete: одиночная транзакция с `timeout: 120000` мс для большого числа ЭСФ
- Вся финализация в одном `prisma.$transaction()`

---

*Последнее обновление: 2026-06-30*

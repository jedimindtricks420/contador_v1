# Модуль E — Закрытие месяца

**Статус:** ✅ Реализован  
**Файлы:** `src/app/closing/`, `src/app/api/closing/`, `src/lib/closing.ts`  
**Последнее обновление:** 2026-06-26

---

## Назначение

7-шаговый мастер для полного закрытия учётного периода: импорт выписки → классификация → начисления → курсовые разницы → Soliq → финализация → блокировка.

---

## Архитектура мастера

**Компонент:** `ClosingWizard.tsx` — контейнер, управляет состоянием шагов.  
**Состояние:** сохраняется в `Period.closingData` (JSON) после каждого шага — прогресс не теряется при перезагрузке.

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

## Шаги мастера

### Шаг 1 — Импорт выписки (`Step1Import.tsx`)

- Выбор банковского счёта + загрузка файла
- Форматы: 1CClientBankExchange (.txt), Excel (Asaka, Kapital, Ipak Yoli)
- Preview первых 5 строк
- Импорт → `StagedTransaction[]` со статусом `IMPORTED`
- Кнопка «Откатить» — удаляет весь пакет по `importBatchId`

### Шаг 2 — Классификация (`ClarificationQueue.tsx`)

- Запускает движок правил → AI-классификатор (GPT-4o-mini)
- Показывает очередь NEEDS_CLARIFICATION групп
- При ответе на все → переход к шагу 3
- Опция «запомнить» — создаёт новое правило

### Шаг 3 — Реестр документов (`Step3Registry.tsx`)

- Список всех транзакций с типами документов
- Ручное изменение типа документа
- Опция «Пропустить» для транзакции

### Шаг 4 — Начисления (`Step4Accruals.tsx`)

Ввод сумм, отсутствующих в выписке:

| Поле | Тип документа | Проводка |
|------|-------------|---------|
| ФОТ | SALARY_ACCRUAL | Дт 9420 → Кт 6710 |
| | SALARY_OFFSET | Дт 6710 → Кт 6410 (НДФЛ 12%) + Кт 6530 (ИНПС 0.1%) |
| | | Дт 9420 → Кт 6520 (соцналог 12%) |
| Амортизация | DEPRECIATION_ACCRUAL | Дт 9430 → Кт 0200 |
| Аренда | — | Дт 9420 → Кт 6010 |

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
  - Доход: Дт 5210 → Кт 9540
  - Расход: Дт 9620 → Кт 5210

### Шаг 6 — Soliq (`Step6Soliq.tsx`)

- Загрузка Excel-выгрузки my.soliq.uz
- Автоматическое сопоставление ЭСФ с транзакциями
- Статистика: N сопоставлено / M не сопоставлено
- Шаг можно пропустить

### Шаг 7 — Финализация (`Step7Summary.tsx`)

**Вызов:** `POST /api/closing/[periodId]/finalize`

**Что происходит (`finalizePeriod()` в `closing.ts`):**

#### Блок B — Начисления
Применяет данные из `closingData.accruals`.

#### Блок C — Курсовые разницы
Применяет данные из `closingData.fxDiff`.

#### Блок D — Расчёт выручки и прибыли
Агрегирует JournalEntry по 9xxx-счетам за период:
- `totalRevenue` = Кт(9010+9020+9030) − Дт(9040+9050)
- `netProfit` = выручка + прочие доходы − все расходы

#### Блок E — Начисление налогов

**Режим VAT:**
- Если netProfit > 0 → `PROFIT_TAX_ACCRUAL` (Дт 9810 → Кт 6410, 15%)

**Режим TURNOVER_TAX:**
- Если totalRevenue > 0 → `TURNOVER_TAX_ACCRUAL`:
  - Дт 9810 → Кт 6410
  - Ставка: `org.turnoverTaxRate` (1–4%, настраивается в Settings)
  - Проводится через `postDocument()` → соблюдается Σ Дт = Σ Кт
- Создаёт TaxCalendarEvent со сроком 20-е следующего месяца

#### Блок H — Закрытие TRANSIT-счетов (PERIOD_CLOSING)

Все TRANSIT-счета (9xxx) с ненулевым сальдо переносятся в 9910:

```
Кредитовое сальдо (выручка):  Дт 9010 → Кт 9910
Дебетовое сальдо (расходы):   Дт 9910 → Кт 9410
```

Один документ `PERIOD_CLOSING` на весь период.

#### Блок I — Блокировка
`Period.status = CLOSED`, `Period.lockDate = последний день месяца`.

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
1. Вычислить `net9910 = Σ(debit − credit)` по счёту 9910 за год
2. Если `net9910 = 0` → перенос не нужен
3. Создать документ `YEAR_END_CLOSE` (31 декабря)
4. Проводки:
   - Прибыль (`net9910 < 0`, кредит. остаток): Дт 9910 → Кт 8710
   - Убыток (`net9910 > 0`, дебет. остаток): Дт 8710 → Кт 9910
5. Результат: `9910 = 0`, `8710` = накопленная нераспределённая прибыль

**Примечание:** §8 взаимоувязка (8710_конец = 8710_начало + line270 − дивиденды) проверяется вручную при составлении годовой отчётности. Системной блокировки нет.

---

## API закрытия

```
GET  /api/closing/[periodId]/state              # Состояние мастера
POST /api/closing/[periodId]/step/[N]/complete  # Завершить шаг N (1–7)
POST /api/closing/[periodId]/accruals           # Сохранить начисления
DELETE /api/closing/[periodId]/accruals         # Сбросить начисления
GET  /api/closing/[periodId]/pending-invoices   # Незакрытые счета
POST /api/closing/[periodId]/finalize           # Финализировать период
POST /api/closing/year-end                      # Годовое закрытие (декабрь)
GET  /api/closing/year-end/status               # Статус годового закрытия

POST /api/periods/[id]/reopen                   # Переоткрыть закрытый период
```

---

## Защиты и ограничения

- Период нельзя закрыть повторно (`Period.status === "CLOSED"` → 409)
- Проводки в закрытом периоде запрещены (lockDate → 423)
- Закрытие года только в декабре (период 12) → 400 иначе
- AbortController (30 сек) на загрузку статистики финализации
- Все документы финализации выполняются в одной транзакции БД

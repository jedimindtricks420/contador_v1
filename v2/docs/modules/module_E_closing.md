# Модуль E — Закрытие месяца

**Статус:** ✅ Реализован  
**Файлы:** `src/app/closing/`, `src/app/api/closing/`, `src/lib/closing.ts`  
**Последнее обновление:** 2026-07-02

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

Показывает **все** транзакции периода — и нераспознанные, и те что классифицировал AI — для проверки и ручной корректировки.

**Запрос:** `GET /v2/api/transactions?periodId=...&status=IMPORTED,NEEDS_CLARIFICATION,AUTO_MATCHED&limit=2000`

**Сортировка:** нераспознанные (`IMPORTED`, `NEEDS_CLARIFICATION`) выводятся первыми, затем AI-распознанные.

**Фильтр-вкладки (клиентская фильтрация):**

| Вкладка | Отображаемые статусы |
|---------|---------------------|
| Все (N) | IMPORTED + NEEDS_CLARIFICATION + AUTO_MATCHED |
| Без категории (N) | IMPORTED + NEEDS_CLARIFICATION |
| Распознано ИИ (N) | AUTO_MATCHED |

**Поведение колонки «Категория»:**

- `IMPORTED` / `NEEDS_CLARIFICATION`: всегда показывает `<select>` с кнопкой ✓
- `AUTO_MATCHED` / `CONFIRMED`: показывает название текущей категории; при наведении — иконка карандаша; клик → `<select>` с предвыбранной категорией + кнопки ✓ и ×

**Статусные бейджи:**

| Значение | Бейдж |
|---------|-------|
| IMPORTED | `Новый` (серый) |
| NEEDS_CLARIFICATION | `Не распознан` (красный) |
| AUTO_MATCHED | `ИИ` (синий) |
| CONFIRMED | `✓` (зелёный) |

После ручного изменения категории через `PATCH /api/transactions/[id]/category` транзакция **обновляется в месте** (не удаляется из списка) — пользователь сразу видит новое значение.

Кнопка «Продолжить» отображает счётчик оставшихся без категории: `Продолжить (5 без категории) →`.

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
- Если разница ≠ 0 → документ `FX_DIFFERENCE` с payload `{ fxDifference, fxAccountCode: "5210" }`:
  - Доход: Дт $fxAccountCode → **Кт 9540** (FX_INCOME)
  - Расход: Дт **9620** → Кт $fxAccountCode (FX_EXPENSE)

Счета 9540 и 9620 (не 9030/9430) — из констант `ACCOUNTS.FX_INCOME` / `ACCOUNTS.FX_EXPENSE`.
`$fxAccountCode` — счёт из payload, а не хардкод в шаблоне; этот автоматический шаг мастера
всегда передаёт `"5210"` (валютный банковский счёт). Переоценка других валютных статей
(4010, 4310, 6010, 6820 в валюте) через FX_DIFFERENCE выполняется отдельно, вручную, через
«Документы → Создать документ» с нужным `fxAccountCode` — движок не хранит валюту по
OpenItem/проводке, поэтому не может пересчитать их автоматически.

### Шаг 6 — Soliq (`Step6Soliq.tsx`)

- Загрузка Excel-выгрузки my.soliq.uz (файл может охватывать несколько месяцев)
- Отправка на `/v2/api/import/soliq` → автоматическое сопоставление ЭСФ с транзакциями
- Статистика: N сопоставлено / M не сопоставлено
- Кнопка «AI-сверка» — дополнительный проход через GPT (тариф PRO)
- Шаг можно пропустить

#### Алгоритм сверки (import/soliq/route.ts)

**Pass 1 — точное совпадение по ИНН:** ЭСФ ↔ OpenItem по `counterparty.inn` + сумма (±1 сум, ±15% для маркетплейсов).

**Pass 2 — нечёткое совпадение по названию:** Sørensen–Dice bigram-similarity ≥ 0.75 + сумма ≈ gross.

**Pass 3 — расходные ЭСФ (direction=EXPENSE):** поиск по DEBIT `StagedTransaction` без фильтра по периоду. Покрывает кросс-периодные ситуации — оплата в предыдущем месяце, ЭСФ в текущем.

**Банковская сторона (bankOnly):** формируется из `openItems` с `status=OPEN` **без фильтра по периоду** — авансы из прошлых периодов автоматически включаются. Каждый элемент bankOnly содержит поле `date` (дата исходного документа).

#### Ручное сопоставление

После автоматического прохода и опционального AI-прохода пользователь может вручную сопоставить оставшиеся несопоставленные позиции:

- **Строки bankOnly** (банк без ЭСФ): в правой колонке — `<select>` со списком доступных ЭСФ (soliqOnly). Формат: `Название (сумма)`
- **Строки soliqOnly** (ЭСФ без банка): в левой колонке — `<select>` со списком доступных банковских авансов (bankOnly)

При выборе — пара немедленно переносится в раздел «Сопоставлено» без обращения к серверу. Дропдауны блокируются во время работы AI (`disabled={aiMatching}`). Обновляется `parsedPayload.esfItems` (matchStatus → MATCHED) для корректного сохранения при нажатии «Продолжить».

В UI отображается дата банкового платежа под суммой — помогает идентифицировать кросс-периодные авансы.

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

### Блок H0 — Предупреждение по счетам выбытия активов

Перед реформацией проверяет чистый оборот TRANSIT-счетов 9210 (Выбытие ОС) и 9220 (Выбытие
прочих активов): если ненулевой — значит `FIXED_ASSET_DISPOSAL` был проведён, но
`FIXED_ASSET_DISPOSAL_RESULT` (признание прибыли/убытка) не создан для всех выбытий периода.
Не блокирует закрытие — добавляет текст в `warnings: string[]`, которые возвращает
`finalizePeriod()` и которые Step7Summary показывает в жёлтом блоке после закрытия.

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
2. Вычислить `net9910 = Σ(credit − debit)` по счёту 9910 за весь год (raw SQL). Знак изменён
   на интуитивный (было `Σ(debit − credit)` с прибылью при `< 0`, что уже приводило к ошибке
   реализации) — теперь прибыль соответствует `net9910 > 0`, согласовано между
   `src/lib/closing.ts` (H2, автоматически при закрытии декабря) и `src/app/api/closing/year-end/route.ts` (этот ручной запуск).
3. Если `net9910 = 0` → возвращает `{ transferred: 0 }` без создания документа
4. Создать документ `YEAR_END_CLOSE` (дата: 31 декабря)
5. Проводки в `prisma.$transaction()`:
   - Прибыль (`net9910 > 0`, кредитовый остаток): **Дт 9910 → Кт 8710**
   - Убыток (`net9910 < 0`, дебетовый остаток): **Дт 8710 → Кт 9910**
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

## Режимы периода (Period.mode)

Поле `mode` в таблице `Period` существует в схеме БД, но с 2026-07-01 **активно используется только одно значение — `ACTIVE`**.

| Значение | Статус | Описание |
|---------|--------|---------|
| `ACTIVE` | ✅ Используется | Полный 7-шаговый wizard |
| `HISTORICAL` | ❌ Удалён из UI | Упрощённый режим (только импорт + закрытие) — удалён |

**Что изменилось:**
- Форма создания периода больше не показывает выбор типа — всегда создаётся `ACTIVE`
- При автоматическом создании периода из банковского импорта (`import/bank/route.ts`) — всегда `ACTIVE`, ранее прошедшие периоды получали `HISTORICAL`
- Существующие периоды с `mode=HISTORICAL` в БД открываются в полном `ClosingWizard`
- Компонент `Step1Import` больше не рендерится в `page.tsx` напрямую — только внутри wizard'а

---

## Защиты и ограничения

- Период нельзя закрыть повторно (`Period.status === "CLOSED"` → 409)
- Проводки в закрытом периоде запрещены (`lockDate ≠ null` → ошибка)
- Закрытие года только в декабре (период.month ≠ 12) → 400
- Step/6/complete: одиночная транзакция с `timeout: 120000` мс для большого числа ЭСФ
- Вся финализация в одном `prisma.$transaction()`

---

*Последнее обновление: 2026-07-02*

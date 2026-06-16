# Модуль E — Закрытие месяца

**Статус:** ✅ Реализован  
**Файлы:** `src/app/closing/`, `src/app/api/closing/`, `src/lib/closing.ts`

---

## Назначение

7-шаговый мастер для полного закрытия учётного периода: от импорта выписки до блокировки периода.

---

## Архитектура мастера

**Компонент:** `ClosingWizard.tsx` — контейнер, управляет состоянием шагов.  
**Состояние:** сохраняется в `Period.closingData` (JSON) после каждого шага → прогресс не теряется при перезагрузке.

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
- Preview первых 5 строк
- Импорт → `StagedTransaction[]` со статусом `IMPORTED`
- Кнопка «Откатить» — удаляет весь пакет по `importBatchId`

### Шаг 2 — Классификация (`ClarificationQueue.tsx`)

- Запускает движок правил → AI-классификатор
- Показывает очередь NEEDS_CLARIFICATION групп
- При ответе на все → переход к шагу 3

### Шаг 3 — Реестр документов (`Step3Registry.tsx`)

- Список всех транзакций с типами
- Возможность вручную изменить тип (управляемый select + кнопка «✓»)
- Опция «Очистить / Пропустить» для транзакции

### Шаг 4 — Начисления (`Step4Accruals.tsx`)

Ввод сумм, отсутствующих в выписке:

| Поле | Проводка | Дополнительно |
|------|---------|--------------|
| ФОТ | Д 9420 / К 6710 | + НДФЛ 12% Д 6710 / К 6410 |
| | | + Соц. налог 12% Д 9420 / К 6520 |
| Амортизация | Д 9430 / К 0200 | |
| Аренда | Д 9420 / К 6010 | |

Кнопка «Сбросить» — модальное подтверждение, затем `DELETE /api/closing/[periodId]/accruals`.

**API:**
```
POST /api/closing/[periodId]/step/4/complete
Body: { salaryAmount, depreciationAmount, rentAmount }

DELETE /api/closing/[periodId]/accruals
→ { reset: true }
```

### Шаг 5 — Курсовые разницы (`Step5FxDiff.tsx`)

- Ввод официального курса ЦБ на конец периода
- Расчёт: (текущий курс − предыдущий) × остаток счёта 5210
- Если разница ≠ 0 → документ FX_DIFFERENCE
  - Доход: Д 5210 / К 9540
  - Расход: Д 9620 / К 5210

**API:**
```
GET /api/cbu-rate           # Текущий курс ЦБ
POST /api/closing/[periodId]/step/5/complete
Body: { exchangeRate, difference }
```

### Шаг 6 — Soliq (`Step6Soliq.tsx`)

- Загрузка Excel-выгрузки my.soliq.uz
- Автоматическое сопоставление ЭСФ с транзакциями
- Показывает статистику: N сопоставлено / M не сопоставлено
- Пропуск шага возможен

### Шаг 7 — Финализация (`Step7Summary.tsx`)

**Что происходит при нажатии «Закрыть месяц»:**

```
POST /api/closing/[periodId]/finalize
```

1. Проверить что период не CLOSED
2. Применить начисления (ФОТ, амортизация, аренда) из `closingData.accruals`
3. Применить курсовую разницу из `closingData.fxDiff`
4. Рассчитать и начислить налоги:
   - **VAT-режим:** НДС 12% от 9030 → Д 9420 / К 6410
   - **TURNOVER_TAX-режим:** 4% от выручки → Д 9430 / К 6410
   - Налог на прибыль 15% → Д 9810 / К 6410
   - Социальный налог от ФОТ → Д 9420 / К 6520
5. Провести все документы (движок H)
6. `Period.status = CLOSED`, `Period.lockDate = now()`
7. Создать TaxCalendarEvent для следующего периода

**Защиты:**
- 30-секундный AbortController на загрузку статистики
- Ошибки — инлайн (не через `alert()`)

---

## API закрытия

```
GET  /api/closing/[periodId]/state          # Состояние мастера
POST /api/closing/[periodId]/step/[N]/complete  # Завершить шаг N
POST /api/closing/[periodId]/accruals       # Сохранить начисления  
DELETE /api/closing/[periodId]/accruals     # Сбросить начисления
POST /api/closing/[periodId]/finalize       # Финализировать период
POST /api/closing/year-end                  # Закрытие года
GET  /api/closing/year-end/status           # Статус закрытия года
```

---

*Последнее обновление: 2026-06-16*

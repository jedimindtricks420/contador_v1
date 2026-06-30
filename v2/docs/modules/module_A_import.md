# Модуль A — Импорт данных

**Статус:** ✅ Реализован  
**Файлы:** `src/app/api/import/`, `src/lib/parsers/`  
**Последнее обновление:** 2026-06-30

---

## Назначение

Загрузка банковских выписок и отчётов Soliq. После парсинга — запись в `StagedTransaction` (status=IMPORTED), которые передаются в Модуль B (классификация).

---

## A1. Банковская выписка

### Форматы

| Формат | Парсер | Статус |
|--------|--------|--------|
| 1CClientBankExchange (.txt) | `src/lib/parsers/parser1c.ts` | ✅ |
| Excel банков (Asaka, Kapital, Ipak Yoli) | `src/lib/parsers/parserBankExcel.ts` | ✅ |

### Определение формата

Формат определяется автоматически по первым 64 байтам файла (ASCII-заголовок):
- Если в заголовке есть строка `1CClientBankExchange` → использует parser1c
- Иначе → использует parserBankExcel

Также принимается явный параметр формы `parserType`: `"1C"`, `"Asaka"`, `"Kapital"`, `"IpakYoli"`, `"AUTO"`.

### Парсер 1C

Разбирает блоки `СекцияДокумент...КонецДокумента`:

| Поле файла | StagedTransaction |
|-----------|------------------|
| `Дата` | `date` |
| `Сумма` | `amount` (Decimal) |
| `ВидОперации` | `direction` (CREDIT/DEBIT) |
| `НазначениеПлатежа` | `description` |
| `Плательщик`/`Получатель` | `counterpartyHint` |
| ИНН | `counterpartyInn` |

### Дедупликация

SHA-256 от `(orgId, bankAccountId, date, amount, description)` → поле `hash`.
Повторный импорт того же файла безопасен — дублирующие строки пропускаются без ошибки.

Реализация: если Prisma бросает ошибку с кодом `P2002` (нарушение уникального ограничения) — транзакция считается дубликатом (счётчик `duplicates++`), обработка продолжается.

### Периоды и заблокированные транзакции

При импорте каждая транзакция автоматически привязывается к периоду (год + месяц). Если период не существует — создаётся с `mode: "HISTORICAL"` (прошлое) или `"ACTIVE"` (текущий/будущий). Транзакции в **закрытом** периоде (`status === "CLOSED"`) не импортируются (`locked++`).

### Preview-режим

`POST /api/import/bank?preview=true` — возвращает распарсенные данные без записи в БД.

```typescript
{
  parser: string,          // "1CClientBankExchange" или "Excel Parser"
  total: number,
  openingBalance: number | null,
  closingBalance: number | null,
  transactions: Array<{ date, amount, direction, description, counterpartyHint, counterpartyInn }>
}
```

### Откат импорта

Все транзакции одного импорта имеют `importBatchId` (UUID).  
`DELETE /api/import/bank/rollback` с телом `{ batchId }` — удаляет весь пакет.  
Защита: если в пакете есть транзакции со статусом `POSTED` → 400.

### API

```
POST /api/import/bank (multipart/form-data)
  file             — файл выписки
  bankAccountId    — ID банковского счёта
  parserType?      — "1C" | "Asaka" | "Kapital" | "IpakYoli" | "AUTO"
  ?preview=true    — предпросмотр без записи

→ { imported, duplicates, locked, total, batchId, netDelta }

DELETE /api/import/bank/rollback
  Body: { batchId }
→ { deleted: N }
```

---

## A2. Soliq (ЭСФ)

Загрузка Excel-выгрузки из my.soliq.uz — реестра электронных счетов-фактур (ЭСФ). Используется на шаге 6 мастера закрытия.

**Файл:** `src/app/api/import/soliq/route.ts`  
**UI:** `src/app/closing/steps/Step6Soliq.tsx`

### Алгоритм сопоставления (3 прохода)

**Проход 1 — точное совпадение по ИНН.**  
Сопоставляет ЭСФ с открытыми позициями (`OpenItem`) по ИНН контрагента и сумме (с допуском ±1 сум). Для маркетплейсов (MARKETPLACE_INNS из `constants.ts`) допуск до 15% (комиссия платформы).

**Проход 2 — нечёткое совпадение по названию.**  
Для ЭСФ без ИНН или с несовпадающим ИНН — сопоставление по биграммному сходству названий (коэффициент Соренсена–Дайса). Порог: ≥ 50% (FUZZY_THRESHOLD=0.5). Если оба ИНН присутствуют и отличаются — порог поднимается до 0.85 (покрывает опечатки в данных банка/Soliq).

**Проход 3 — расходные ЭСФ vs транзакции DEBIT.**  
Для ЭСФ с `direction=EXPENSE`, которые не нашли совпадения в проходах 1–2, — поиск среди банковских DEBIT-транзакций периода по ИНН (точно) или по названию (нечётко ≥ 50%).

### Зависимости констант

`MARKETPLACE_INNS` импортируется из `src/lib/constants.ts` (не объявляется локально в route.ts).

### API

```
POST /api/import/soliq (multipart/form-data)
  file, periodId
→ {
    matched,       — количество сопоставленных ЭСФ
    unmatched,     — количество несопоставленных ЭСФ
    taxSummary,    — итоги налогов из файла
    matches,       — список совпадений
    bankOnly,      — открытые позиции без ЭСФ
    soliqOnly,     — ЭСФ без банковских позиций
    parsedPayload  — данные для передачи в step/6/complete
  }
```

### Предотвращение отрицательного счётчика

При снятии с учёта в проходе 3 используется: `unmatched = Math.max(0, unmatched - 1)` — счётчик не уходит в отрицательные значения.

---

*Последнее обновление: 2026-06-30*

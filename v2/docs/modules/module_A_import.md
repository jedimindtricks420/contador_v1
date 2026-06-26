# Модуль A — Импорт данных

**Статус:** ✅ Реализован  
**Файлы:** `src/app/api/import/`, `src/lib/parsers/`

---

## Назначение

Загрузка банковских выписок и отчётов Soliq. После парсинга — запись в `StagedTransaction` (status=IMPORTED), которые передаются в Модуль B (классификация).

---

## A1. Банковская выписка

### Форматы

| Формат | Парсер | Статус |
|--------|--------|--------|
| 1CClientBankExchange (.txt) | `parser1c.ts` | ✅ |
| Excel банков (Asaka, Kapital, Ipak Yoli) | `parserBankExcel.ts` | ✅ |

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

SHA-256 от `(orgId, bankAccountId, date, amount, description)` → поле `hash`. Уникально в рамках организации. Повторный импорт того же файла безопасен — дубликаты пропускаются.

### Preview-режим

`POST /api/import/bank?preview=true` — возвращает первые 5 строк без записи в БД.

### Откат импорта

Все транзакции одного импорта имеют `importBatchId` (UUID).  
`DELETE /api/import/bank/rollback` с телом `{ batchId }` — удаляет весь пакет.  
Защита: если в пакете есть транзакции со статусом `POSTED` → 400.

### API

```
POST /api/import/bank (multipart/form-data)
  file, bankAccountId, periodId, preview?
→ { imported, duplicates, total, batchId }

DELETE /api/import/bank/rollback
  { batchId }
→ { deleted: N }
```

---

## A2. Soliq (ЭСФ)

Загрузка Excel-выгрузки из my.soliq.uz — реестра электронных счетов-фактур (ЭСФ). Используется на шаге 6 мастера закрытия.

### API

```
POST /api/import/soliq (multipart/form-data)
  file, periodId
→ { matched, unmatched }
```

Файл: `src/app/api/import/soliq/route.ts`, UI: `Step6Soliq.tsx`.

---

*Последнее обновление: 2026-06-26*

# Модуль B — Классификация операций

**Статус:** ✅ Реализован  
**Файлы:** `src/lib/classification/`, `src/app/api/classification/`, `src/app/api/clarification/`, `src/app/closing/ClarificationQueue.tsx`  
**Последнее обновление:** 2026-06-30

---

## Назначение

Перевод `StagedTransaction` из статуса `IMPORTED` в `AUTO_MATCHED` или `NEEDS_CLARIFICATION` через трёхступенчатый конвейер:

```
IMPORTED → Движок правил → AUTO_MATCHED
                        → AI-классификатор → AUTO_MATCHED
                                           → NEEDS_CLARIFICATION → пользователь → CONFIRMED
```

---

## B1. Движок правил

**Файл:** `src/lib/classification/rulesEngine.ts`

### Типы совпадений (приоритет сверху вниз)

| Тип | matchValue | Пример |
|-----|-----------|--------|
| `INN` | ИНН контрагента | `"1234567890"` |
| `KEYWORD` | Слово в description | `"аренда"` |
| `AMOUNT_RANGE` | Диапазон суммы | `"1000:5000"` |
| `TREASURY_ACCOUNT` | Код казначейства | `"00304272346"` |

Правила загружаются в память и кэшируются 30 секунд (один запрос к БД на 30 сек).

При совпадении: `status = AUTO_MATCHED`, `documentTypeId = rule.categoryId`.

### API

```
POST /api/classification/run-rules
Body: { periodId }
→ { matched, remaining }
```

**Обработка ошибок:** при `UNAUTHORIZED` или `NO_ACTIVE_ORG` → 401 (не 500).

---

## B2. AI-классификатор

**Файл:** `src/lib/classification/aiClassifier.ts`  
**API:** `POST /api/classification/run-ai`  
**Модель:** `gpt-4o-mini` (переопределяется через `process.env.OPENAI_MODEL`)  
**Требование:** тариф PRO (`getUserActivePro()` проверяется в route.ts)

### Алгоритм

1. Выбрать IMPORTED транзакции (не захваченные правилами)
2. Собрать список DocumentType из БД
3. Разбить на батчи по `AI.BATCH_SIZE` (100)
4. На каждый батч — один запрос к GPT-4o-mini
5. Промпт включает: список DocumentType + `org.taxRegime` + `org.isVatPayer` + `org.activityDescription`
6. AI возвращает: `transactionId`, `documentTypeCode`, `confidence`, `reason`
7. `confidence >= org.aiConfidenceThreshold` → `AUTO_MATCHED`
8. `confidence < threshold` → `NEEDS_CLARIFICATION`, сохраняет `aiSuggestion` JSON

### Настройка порога

`Organization.aiConfidenceThreshold` — по умолчанию 70%.  
Настраивается в PATCH `/api/settings/org`.

### API

```
POST /api/classification/run-ai
Body: { periodId }
→ { jobId }   — ID фоновой задачи (queue.ts)

GET /api/classification/status/[periodId]
→ { status: "running"|"done", progress: { processed, total } }
```

**Обработка ошибок:** при `UNAUTHORIZED` → 401; остальные ошибки → 500 с универсальным сообщением (без деталей `err.message`).

---

## B3. AI-сверка (ai-reconcile)

**Файл:** `src/app/api/classification/ai-reconcile/route.ts`  
**Требование:** тариф PRO

Сопоставляет банковские авансы (открытые позиции) с ЭСФ Soliq когда автоматические алгоритмы не справились. Используется Azure OpenAI (AZURE_OPENAI_ENDPOINT + AZURE_OPENAI_API_KEY).

### Защиты

1. **Проверка владения:** переданные `bankIds` (ID открытых позиций) сверяются с `orgId` через `prisma.openItem.count({ where: { id: { in: bankIds }, orgId } })`. Если количество не совпадает → 400.
2. **Лимит размера:** `bankOnly.length > 200 || soliqOnly.length > 200` → 400 (максимум 200 элементов в каждом списке).
3. **Пустые списки:** если один из списков пустой → возвращает `{ matches: [] }` без запроса к AI.

### API

```
POST /api/classification/ai-reconcile
Body: { bankOnly: [...], soliqOnly: [...] }
→ { matches: [{ bankId, soliqId, reason }] }
```

**Ошибки:** 401 при `UNAUTHORIZED`, 500 с общим сообщением `"Ошибка ИИ-сверки"` (без `err.message`).

---

## B4. Очередь уточнений

**Компонент:** `src/app/closing/ClarificationQueue.tsx`  
**API:** `GET /api/clarification/queue`, `POST /api/clarification/answer`

### Структура группы

NEEDS_CLARIFICATION транзакции группируются по контрагенту (`counterpartyHint + counterpartyInn`):

```typescript
interface ClarificationGroup {
  groupId: string
  counterpartyHint: string
  counterpartyInn: string | null
  transactions: Transaction[]
  aiSuggestion: {
    categoryId: string
    confidence: number
    extractedCounterparty: string
    vatApplicable: boolean
  } | null
}
```

### Ответ пользователя

```
POST /api/clarification/answer
Body: {
  transactionIds: string[]
  documentTypeId: string
  createRule: boolean       // создать правило
  ruleMatchType: "INN" | "KEYWORD"
  ruleMatchValue: string
}
→ { ok: true }
```

При `createRule: true` — автоматически создаётся `Rule` с `createdFrom: "USER_ANSWER"`.

### UX особенности

- При наличии AI-предложения показывается блок «Рекомендация ИИ» с кнопкой «Это верно»
- Чекбокс «Запомнить для контрагента» — включён по умолчанию
- Кнопка «Пропустить» — транзакция остаётся `NEEDS_CLARIFICATION`
- «Пропустить всё» — модальное подтверждение, затем `onDone()`

---

## Жизненный цикл статуса

```
IMPORTED
  → AUTO_MATCHED   (правило / AI ≥ порога)
  → NEEDS_CLARIFICATION   (AI < порога / нет правила)
    → CONFIRMED   (пользователь ответил)
      → POSTED    (документ проведён движком H)
  → SKIPPED       (пользователь пропустил)
```

---

*Последнее обновление: 2026-06-30*

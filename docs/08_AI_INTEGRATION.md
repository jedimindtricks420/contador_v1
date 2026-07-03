# 08 — AI-интеграция

**Документ:** AI Integration Reference  
**Версия:** 2.0  
**Дата:** 2026-06-26

---

## 1. Обзор

Contador использует двухуровневую систему классификации банковских транзакций:

```
Транзакция (IMPORTED)
       │
  ┌────▼────────────────────────────┐
  │         УРОВЕНЬ 1               │
  │      Движок правил              │
  │  (детерминированный, быстрый)   │
  │  in-memory cache, 30 сек TTL    │
  └────┬────────────────────────────┘
       │ не совпало
  ┌────▼────────────────────────────┐
  │         УРОВЕНЬ 2               │
  │      AI-классификатор           │
  │  GPT-4o-mini, батчи по 20       │
  │  confidence threshold: 70%      │
  └────┬────────────────────────────┘
       │
  ┌────▼──────────┬─────────────────┐
  │ confidence ≥ 70%    confidence < 70%
  │ AUTO_MATCHED        NEEDS_CLARIFICATION
  └───────────────┴─────────────────┘
```

---

## 2. Движок правил (Rules Engine)

**Файл:** `v2/src/lib/classification/rulesEngine.ts`

### Типы совпадений (приоритет сверху вниз)

| Тип | matchValue | Логика |
|-----|-----------|--------|
| `INN` | `"301846873"` | Сравнение counterpartyInn с matchValue |
| `KEYWORD` | `"аренда"` | Вхождение в description (регистронезависимо) |
| `AMOUNT_RANGE` | `"1000000:5000000"` | amount в диапазоне [min, max] |
| `TREASURY_ACCOUNT` | `"00304272346"` | Код казначейского счёта в description |

### Кэширование

```typescript
// Правила загружаются из БД один раз на 30 секунд
const cache = { rules: Rule[], lastFetch: Date }
const CACHE_TTL_MS = 30_000;

if (Date.now() - cache.lastFetch > CACHE_TTL_MS) {
  cache.rules = await prisma.rule.findMany({ where: { orgId, isActive: true }, orderBy: { order: "asc" } });
  cache.lastFetch = Date.now();
}
```

### Алгоритм

```
1. Загрузить правила (из кэша или БД)
2. Для каждой IMPORTED транзакции:
   a. Перебрать правила по порядку (order ASC)
   b. Первое совпадение → status = AUTO_MATCHED, documentTypeId = rule.categoryId
   c. Нет совпадений → остаётся IMPORTED для AI
3. Вернуть: { matched, remaining }
```

---

## 3. AI-классификатор

**Файл:** `v2/src/lib/classification/aiClassifier.ts`  
**Модель:** `gpt-4o-mini` (из `constants.ts: AI.MODEL`)  
**Размер батча:** 20 транзакций (из `constants.ts: AI.BATCH_SIZE`)

### Алгоритм classifyBatchWithAI()

```
1. Определить API-ключ:
   - subscription.customApiKey (если задан для организации)
   - process.env.OPENAI_API_KEY (по умолчанию)
2. Загрузить:
   - Каталог DocumentType (code + name)
   - Настройки организации (taxRegime, isVatPayer, activityGroup)
3. Сформировать контекст организации:
   - activityLabel = getActivityLabel(activityGroup, activityDescription, activityCustom)
   - confidenceThreshold = org.aiConfidenceThreshold ?? 70
4. Разбить транзакции на батчи по AI.BATCH_SIZE (20)
5. Для каждого батча — один запрос к GPT:
   - Промпт: список DocumentType + контекст организации + транзакции
   - Ответ: JSON массив результатов
6. Для каждого результата:
   - confidence ≥ threshold → AUTO_MATCHED
   - confidence < threshold → NEEDS_CLARIFICATION + сохранить aiSuggestion
7. Вернуть { matched, needsClarification }
```

### Структура промпта

```
System:
  Ты бухгалтерский классификатор для компании из Узбекистана.
  Режим налогообложения: TURNOVER_TAX
  Плательщик НДС: нет
  Вид деятельности: Оптовая торговля продуктами питания
  
  Доступные типы документов:
  - REVENUE_NO_VAT: Поступление без НДС
  - SUPPLIER_PAYMENT_SERVICES: Оплата за услуги (погашение долга)
  - SALARY: Выплата зарплаты
  - TAX_PAYMENT: Уплата налога
  ...
  # SUPPLIER_PAYMENT (без суффикса) — устаревший тип, mode: MANUAL_ONLY,
  # каталогу AI больше не предлагается (см. aiClassifier.ts, ensureBaseData.ts)

User:
  Классифицируй следующие транзакции. Верни JSON-массив:
  [{ "transactionId": "...", "documentTypeCode": "...", "confidence": 0-100, 
     "reason": "...", "extractedCounterparty": "...", "extractedInn": "...",
     "vatApplicable": true/false }]
  
  Транзакции:
  1. ID: uuid-1, Дата: 2026-05-15, Сумма: 5000000 UZS, Направление: CREDIT
     Описание: "Поступление от ООО AGROSERVIS оплата по договору 123"
     ИНН: 301846873
  ...
```

### Формат ответа AI

```json
[
  {
    "transactionId": "uuid-1",
    "documentTypeCode": "REVENUE_NO_VAT",
    "confidence": 92,
    "reason": "Поступление от юридического лица, НДС не применяется",
    "extractedCounterparty": "ООО AGROSERVIS",
    "extractedInn": "301846873",
    "vatApplicable": false
  }
]
```

---

## 4. Очередь уточнений

**Файл:** `v2/src/app/closing/ClarificationQueue.tsx`  
**API:** `GET /api/clarification/queue`, `POST /api/clarification/answer`

### Группировка

NEEDS_CLARIFICATION транзакции группируются по `counterpartyHint + counterpartyInn` для работы с одним контрагентом за раз.

```typescript
interface ClarificationGroup {
  groupId: string
  counterpartyHint: string
  counterpartyInn: string | null
  transactions: StagedTransaction[]
  aiSuggestion: {
    categoryId: string
    confidence: number
    extractedCounterparty: string
    vatApplicable: boolean
  } | null
}
```

### UX-поведение

- Показывается блок «Рекомендация ИИ» если есть `aiSuggestion`
- Кнопка «Это верно» → подтвердить предложение AI
- Чекбокс «Запомнить для контрагента» (включён по умолчанию) → создаёт правило
- «Пропустить» → транзакция остаётся NEEDS_CLARIFICATION
- «Пропустить всё» → `onDone()` с модальным подтверждением

### Ответ пользователя

```json
POST /api/clarification/answer
{
  "transactionIds": ["uuid1", "uuid2"],
  "documentTypeId": "doc-type-uuid",
  "createRule": true,
  "ruleMatchType": "INN",
  "ruleMatchValue": "301846873"
}
```

При `createRule: true` → автоматически создаётся `Rule` с `createdFrom: "USER_ANSWER"`. При следующем импорте этот контрагент будет распознан движком правил без AI.

---

## 5. Настройки AI

### Порог уверенности

```typescript
// Organization.aiConfidenceThreshold (по умолчанию: 70)
// Диапазон: 0–100

// Настройка через API:
PATCH /api/settings/org
{ "aiConfidenceThreshold": 80 }
```

**Рекомендации:**
- 60–70% — агрессивная автоматизация, меньше уточнений, возможны ошибки
- 70–80% — баланс (рекомендуется)
- 80–90% — консервативный режим, много уточнений, высокая точность

### Кастомный API-ключ организации

```typescript
// Subscription.customApiKey
// Если задан — используется для данной организации
// Если null — используется OPENAI_API_KEY из .env
```

---

## 6. AI Knowledge Base (Admin Panel)

**Файлы:** `ai/knowledge-base.ts`, `ai/prompts.ts`

Используется admin-панелью для расширенного AI-контекста:

- `MASTER_COA_COMPACT` — сжатое представление плана счетов (код|название|тип|группа)
- `PostingTemplates` — шаблоны проводок для AI
- `prompts.ts` — system prompt с правилами:
  - 5-шаговый цикл расчёта зарплаты
  - Правила начисления НДС
  - Разбор займов от учредителей
  - Определение курсовых разниц

---

## 7. Проверка работоспособности AI

```bash
# Тест API-ключа
curl -s https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY" | \
  python3 -c "import sys,json; d=json.load(sys.stdin); print('OK:', len(d.get('data',[])), 'models')"

# Тест классификации (прямой запрос)
curl -s https://api.openai.com/v1/chat/completions \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o-mini",
    "messages": [{"role":"user","content":"Classify: AGROSERVIS 5000000 UZS. Types: REVENUE_NO_VAT, SUPPLIER_PAYMENT_SERVICES. JSON: {code, confidence}"}],
    "max_tokens": 50
  }' | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['choices'][0]['message']['content'])"
```

---

## 8. Стоимость AI-запросов (GPT-4o-mini)

| Тариф | Стоимость |
|-------|----------|
| Input tokens | $0.15 / 1M tokens |
| Output tokens | $0.60 / 1M tokens |

**Оценка для типичного месяца:**
- 100 транзакций / батч 20 = 5 запросов
- ~300 input tokens + ~100 output tokens per request
- Итого: ~2000 tokens = **<$0.01 в месяц на организацию**

---

*Дата: 2026-06-16*

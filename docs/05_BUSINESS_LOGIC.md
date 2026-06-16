# 05 — Бизнес-логика

**Документ:** Business Logic Reference  
**Версия:** 2.0  
**Дата:** 2026-06-16

---

## 1. Движок проводок (Posting Engine)

**Файл:** `v2/src/lib/posting/postingEngine.ts`

### 1.1 postDocument(documentId, tx?, userId?)

Алгоритм из 10 шагов:

1. Загрузить `Document` + `DocumentType` (с `postingTemplate`)
2. Проверить что период **не CLOSED** (lockDate = null) → 423 если закрыт
3. Загрузить `Organization` (для `isVatPayer`, `taxRegime`)
4. Найти или создать `Counterparty` по `payload.counterpartyInn` / `payload.counterpartyHint`
5. Собрать `evalPayload` = `{ ...payload, isVatPayer, vatRate: 12 }`
6. Обработать строки шаблона:
   - Вычислить `condition` (если 0 → пропустить строку)
   - Найти `Account` по `line.accountCode` (ошибка если не найден)
   - Вычислить `amount = evaluate(line.expression, evalPayload)`
   - Пропустить строки с нулевой суммой
7. Валидация: `Σ debit === Σ credit` → иначе 422
8. Массовая вставка `JournalEntry[]` в БД
9. Если `template.opensItem === true` → создать `OpenItem` с `riskDeadline`
10. Записать `AuditLog` (action: `POST_DOCUMENT`)

### 1.2 voidDocument(documentId, tx?, userId?)

1. Проверить период (не CLOSED)
2. `Document.status = VOIDED`
3. Удалить `JournalEntry` по `documentId`
4. Закрыть связанные `OpenItem` (status OPEN → CLOSED)
5. Записать `AuditLog` (action: `VOID_DOCUMENT`)

### 1.3 repostDocument(documentId, newTypeId)

`voidDocument()` → обновить `Document.typeId` → `postDocument()`

---

## 2. Шаблоны проводок (PostingTemplate)

### Формат

```typescript
interface PostingLine {
  accountCode: string          // Код счёта НСБУ
  side: "debit" | "credit"
  expression: string           // Математическое выражение
  condition?: string           // Условие (0 = пропустить строку)
  subcontoType?: "counterparty" | "contract"
}

interface PostingTemplate {
  lines: PostingLine[]
  opensItem?: boolean          // Создавать ли OpenItem
  itemAccountCode?: string     // Счёт для OpenItem
}
```

### Вычислитель выражений (expressionEval.ts)

Поддерживаемые операции: `+`, `-`, `*`, `/`, скобки.  
Переменные подставляются из `evalPayload`.

**Доступные переменные в выражениях:**
- `amount` — сумма транзакции
- `vatRate` — ставка НДС (12)
- `isVatPayer` — 1 или 0
- `salaryAmount`, `depreciationAmount`, `rentAmount` — для начислений
- `exchangeRate`, `difference` — для курсовых разниц

---

## 3. Типы документов и проводки

| Код | Название | Проводка |
|-----|---------|---------|
| `REVENUE_NO_VAT` | Поступление без НДС | Д 5110 / К 9010 |
| `REVENUE_VAT` | Поступление с НДС | Д 5110 / К 9030 + К 6410 (НДС) |
| `SUPPLIER_PAYMENT` | Оплата поставщику | Д 6010 / К 5110 |
| `SALARY` | Выплата зарплаты | Д 6710 / К 5110 |
| `TAX_PAYMENT` | Уплата налога | Д 6410 / К 5110 |
| `RENT` | Оплата аренды | Д 6010 / К 5110 |
| `SALARY_ACCRUAL` | Начисление ФОТ | Д 9420 / К 6710; Д 6710 / К 6410 (НДФЛ 12%); Д 9420 / К 6520 (соцналог 12%) |
| `DEPRECIATION_ACCRUAL` | Начисление амортизации | Д 9430 / К 0200 |
| `RENT_ACCRUAL` | Начисление аренды | Д 9420 / К 6010 |
| `FX_DIFFERENCE` | Курсовая разница (доход) | Д 5210 / К 9540 |
| `FX_DIFFERENCE` | Курсовая разница (расход) | Д 9620 / К 5210 |

---

## 4. Налоговые ставки (`constants.ts: TAX_RATES`)

| Налог | Ставка | Счёт |
|-------|--------|------|
| НДС (VAT) | 12% | Кт 6410 |
| НДФЛ (Personal Income Tax) | 12% | Кт 6410 |
| Социальный налог | 12% | Кт 6520 |
| Налог с оборота (Turnover Tax) | 4% | Кт 6410 |
| Налог на прибыль (Profit Tax) | 15% | Кт 6410 |

---

## 5. Формулы финансовых отчётов

### P&L (Отчёт о прибылях и убытках)

Источник данных: `JournalEntry` за период, счета 9xxx + 6410 (для НДС).

```
Выручка         = Кт(9010) + Кт(9020) + Кт(9030)
COGS            = Дт(9110) + Дт(9120) + Дт(9130)
Валовая прибыль = Выручка − COGS

Расходы по реализации = Дт(9410)
Управленческие расходы = Дт(9420)
Прочие расходы          = Дт(9430)

Прочие доходы   = Кт(9390) + Кт(9540) + другие Кт(93xx)
Налог прибыли   = Дт(9810)

Чистая прибыль  = Выручка − COGS
                  − Расходы по реализации
                  − Управленческие расходы
                  − Прочие расходы
                  + Прочие доходы
                  − Налог прибыли
```

### Cashflow (Движение денежных средств)

Источник: `JournalEntry` по банковским счетам (5110, 5210, 5710).

```
Поступления (incoming) = Кт по счёту 5110/5210
Выбытия    (outgoing)  = Дт по счёту 5110/5210
Нетто      (net)       = incoming − outgoing
Нач. остаток (opening) = сальдо на начало периода
Кон. остаток (closing) = opening + net
```

### ОСВ — логика сальдо (calcBalance)

```typescript
function calcBalance(type, rawDebit, rawCredit) → { d, c }
```

| Тип счёта | Логика |
|-----------|--------|
| `ASSET`, `CONTRA_LIABILITY`, `ACTIVE_PASSIVE`, `TRANSIT` | net = Дт − Кт; ≥ 0 → в Дт, < 0 → в Кт |
| `LIABILITY`, `CONTRA_ASSET` | net = Кт − Дт; ≥ 0 → в Кт, < 0 → в Дт |
| `OFF_BALANCE` | Всегда в Дт (только обороты) |

---

## 6. Закрытие периода (7 шагов)

**Файл:** `v2/src/lib/closing.ts`, функция `finalizePeriod()`

### Шаги мастера

| Шаг | Название | Действие |
|-----|---------|---------|
| 1 | Импорт выписки | Загрузка файла, создание StagedTransaction |
| 2 | Классификация | Движок правил → AI → очередь уточнений |
| 3 | Реестр документов | Ручная корректировка типов |
| 4 | Начисления | ФОТ, амортизация, аренда |
| 5 | Курсовые разницы | Ввод курса ЦБ, расчёт разницы |
| 6 | Soliq | Загрузка выгрузки my.soliq.uz, сверка ЭСФ |
| 7 | Финализация | Применение всех начислений, блокировка |

### finalizePeriod() — алгоритм

```
1. Проверить период ≠ CLOSED
2. Применить начисления из closingData.accruals:
   - salaryAmount  → SALARY_ACCRUAL документ
   - depreciationAmount → DEPRECIATION_ACCRUAL документ
   - rentAmount    → RENT_ACCRUAL документ
3. Применить курсовую разницу из closingData.fxDiff:
   - difference > 0 → FX_DIFFERENCE (доход: Д 5210 / К 9540)
   - difference < 0 → FX_DIFFERENCE (расход: Д 9620 / К 5210)
4. Рассчитать и начислить налоги:
   - VAT-режим: НДС 12% от Кт(9030) → Д 9420 / К 6410
   - TURNOVER_TAX-режим: 4% от выручки → Д 9430 / К 6410
   - Налог на прибыль 15% от прибыли → Д 9810 / К 6410
   - Соц. налог 12% от ФОТ → Д 9420 / К 6520
5. Провести все созданные документы (postingEngine)
6. Period.status = CLOSED, Period.lockDate = now()
7. Создать TaxCalendarEvent[] на основе TaxDeadlineTemplate
```

### Курсовые разницы (Шаг 5)

```
Формула:
difference = (newRate − prevRate) × balance_5210_in_USD

prevRate = курс на конец предыдущего периода (или 0)
newRate  = ввод пользователя (ЦБ РУз на последний день периода)
```

---

## 7. Открытые позиции (OpenItem)

**Файл:** `v2/src/lib/openItems.ts`

Создаются движком проводок при документах с `opensItem: true` в шаблоне.

### Автоматические дедлайны риска (`RISK_DAYS`)

| Счёт | Описание | Дедлайн |
|------|---------|---------|
| 4220 | Подотчётные суммы (командировки) | 10 дней |
| 4310 | Авансы выданные поставщикам | 30 дней |
| 6310 | Авансы полученные | 30 дней |
| 6990 | Неидентифицированные поступления | 30 дней |
| 5830 | Краткосрочные депозиты | 365 дней |
| 6820 | Займы от учредителей | 365 дней |

Если `openItem.riskDeadline < now()` → статус автоматически `RISK` при следующем запросе.

Дедлайны могут быть переопределены в `Organization.settings.openItemDeadlines`.

---

## 8. Добавление нового типа документа

1. Добавить запись в `ensureBaseData.ts` (upsert по `code`):
```typescript
await prisma.documentType.upsert({
  where: { code: "NEW_DOC_TYPE" },
  update: { name, postingTemplate },
  create: { code: "NEW_DOC_TYPE", name: "Новый документ", postingTemplate: {
    lines: [
      { accountCode: "5110", side: "debit", expression: "amount" },
      { accountCode: "XXXX", side: "credit", expression: "amount" }
    ]
  }}
});
```

2. Перезапустить приложение → `pm2 restart contador-v2`
3. При необходимости добавить в AI Knowledge Base (`ai/knowledge-base.ts`)

---

## 9. Дедупликация транзакций

SHA-256 хэш вычисляется из:
```
hash = SHA256(orgId + date + amount + direction + description + counterpartyInn)
```

Уникальный индекс `@@unique([orgId, hash])` на таблице `StagedTransaction` гарантирует что повторная загрузка той же выписки не создаст дублей.

---

*Дата: 2026-06-16*

# Модуль H — Движок проводок (Posting Engine)

**Статус:** Частичная локальная защита G0; бухгалтерская приёмка и выпуск не выполнены
**Файлы:** `src/lib/posting/postingEngine.ts`, `src/lib/posting/expressionEval.ts`, `src/app/api/posting/`  
**Последнее обновление:** 2026-09-10

---

## Назначение

Атомарное преобразование `Document` в `JournalEntry`. Три операции: проведение, аннулирование, перепроведение.

---

## postDocument(documentId, tx?, userId?)

Алгоритм:

1. Открыть транзакцию при корневом PrismaClient (maxWait 5 с, timeout 30 с), иначе использовать переданную. Заблокировать Document (`FOR UPDATE`), загрузить тип; VOIDED и существующие JournalEntry вызывают ошибку.
2. Заблокировать Period (`FOR NO KEY UPDATE`); проверить orgId, не CLOSED, `lockDate === null`, год/месяц даты в Asia/Tashkent.
3. Загрузить организацию (isVatPayer, vatRate).
4. Прочитать payload. Идентификатор, ИНН и имя контрагента должны быть строками. Непустой contractId и шаблоны с договорной аналитикой запрещены до появления проверяемого реестра договоров. Поиск/создание контрагента выполняется только после проверки всех строк и баланса.
5. Собрать `evalPayload` = payload + isVatPayer + vatRate.
6. Обработать строки шаблона:
   - Если есть `condition` — вычислить; 0 → пропустить строку
   - Код счёта может быть динамическим (`"$fieldName"`) — берётся из payload
   - Найти Account по `code`; не найден → ошибка с кодом счёта
   - Вычислить сумму через `evaluate(expression, evalPayload)`; 0 → пропустить
  - Ненулевая запись по раскрытому счёту 4410 (дебет или кредит) требует `org.isVatPayer === true`; payload не может подменить статус организации. Отказ `PostingValidationError` происходит до записей, завершение Soliq возвращает 400 и откатывает пакет
  - Неизвестные переменные, неконечные/отрицательные суммы, более 2 дробных знаков, суммы от `10^18` и неверная сторона строки запрещены
7. Отклонить пустые проводки; проверить Σ Дт == Σ Кт через BigInt в сотых. При открытии долга или погашении с контрагентом независимо проверить amount: конечное положительное Decimal(20,2), без округления. Проверить `requiresCounterparty`. Явный counterpartyId искать только по id + orgId, при переданном ИНН требовать его совпадения; не подменять отсутствующий выбор созданием новой записи. Без id найти/создать контрагента по ИНН/имени. Подготовить погашение по правилам 9b до записи проводок.
8. Записать JournalEntry[] в БД.
9a. Если `template.opensItem === true` → создать OpenItem. Динамические `line.accountCode`, `itemAccountCode`, `closesOpenItemByAccount` раскрываются одним resolver; значение должно быть собственной строковой переменной payload. Дедлайн вычисляется по раскрытому счёту через `getRiskDeadline(accountCode, date, org.settings)`.
9b. Если `template.closesOpenItemByAccount` задан **и** определён `counterpartyId` → заблокировать OPEN/RISK позиции по orgId/счёту/контрагенту с `dateOpened <= doc.date` в порядке dateOpened/id. Разрешено только точное совпадение суммы; при наличии долга без совпадения отказать. При отсутствии долга отказать, если `requireCloseMatch` или это погашение долгосрочного займа. Обновление проверяет OPEN/RISK и число изменённых строк.
  - Если передан `payload.openItemId`, счёт погашения и контрагент обязательны; блокируется только выбранная позиция. Несовпадение суммы/реквизитов или отсутствие доступного долга вызывает отказ без подмены другим долгом той же суммы.
  - Для `LONG_TERM_LOAN_RECEIVED/REPAYMENT` обязательны контрагент и `loanAccountCode` из списка 7810/7820, включая старые шаблоны с `requiresCounterparty=false`. Другие динамические параметры пока не имеют полной матрицы разрешённых счетов.
  - Для остальных типов без обязательного контрагента шаг закрытия по-прежнему пропускается при отсутствии `counterpartyId`; это незакрытый риск.
    - Полный список типов с `closesOpenItemByAccount` — Модуль D.
10. Записать AuditLog (action: `POST_DOCUMENT`).

**После записи:**  
Вызывает `upsertTaxCalendarEventsForPeriod(periodId, orgId, tx)` и устанавливает
`taxCalendarSyncStatus=OK`. Ошибка откатывает записи транзакции. Вызывающий код
не должен перехватывать её с последующим commit. Отдельно созданный ранее
Document не входит в эту гарантию; жизненный цикл POSTED остаётся незавершённым.

**Автозакрытие налоговых событий:**
Массовая установка DONE для `TAX_PAYMENT`, `SOCIAL_TAX_PAYMENT`, `INPS_PAYMENT`
удалена. Регистр распределения оплаты по обязательствам ещё не реализован.
Частичные оплаты также пока отклоняются, а не уменьшают остаток OpenItem.

**Ограничение ACC-012:** защита 4410 использует текущий флаг организации,
не историю статуса и не проверенный регистр права на зачёт. Для неплательщика
НДС не переносится автоматически в стоимость/расход: операция отклоняется
до появления подтверждённого правила. Нулевой НДС не блокирует остальные
проводки. Налоговые даты, смешанные операции и согласованность taxRegime
с isVatPayer остаются незавершёнными; прежние проводки не переписываются.

Прямые API `open-items/[id]/close` и `reopen` больше не изменяют статус:
после проверки членства, роли и принадлежности позиции возвращают 409.
В интерфейсе удалены соответствующие кнопки и формы; старые CLOSED без документа
расчёта помечены «Требует сверки». Исправление таких исторических позиций и регистр
распределений не реализованы. Это защитный отказ, не новая модель расчётов.

---

## voidDocument(documentId, tx?, userId?)

1. В транзакции заблокировать документ/период, проверить orgId и открытость периода. Заблокировать связанные OpenItem; если долг исходного документа уже имеет closingDocumentId, отказать до записей. Сначала необходимо отменить документ расчёта. Правило действует также для repost.
2. Document.status = VOIDED
3. JournalEntry.deleteMany({ documentId })
4. Закрыть связанные OpenItem по orgId/openingDocumentId со статусом OPEN или RISK → CLOSED
5. Открыть погашенные этим документом позиции, отсоединить банковские строки, записать AuditLog (action: `VOID_DOCUMENT`) и синхронизировать календарь; ошибка откатывает всё

Неизменяемое сторно не реализовано: удаление JournalEntry пока сохранено.
Отмена источника ещё использует CLOSED без отдельного признака отмены; при
восстановлении расчёта исходный RISK не восстанавливается. Историческая сверка нужна.

---

## repostDocument(documentId, newTypeId, tx?, userId?)

1. voidDocument() — аннулировать текущие проводки
2. Document.typeId = newTypeId, status = POSTED
3. postDocument() — новые проводки по новому шаблону
4. Восстановить связи банковских строк. Все шаги в одной транзакции; ошибка сохраняет исходные данные.

---

## PostingTemplate

```typescript
interface PostingTemplate {
  lines: PostingLine[]
  opensItem?: boolean
  itemAccountCode?: string
  closesOpenItemByAccount?: string   // авто-закрыть открытую позицию на этом счёте
}

interface PostingLine {
  accountCode: string         // код счёта или "$fieldName"
  side: "debit" | "credit"
  expression: string          // математическое выражение
  condition?: string          // 0 = пропустить строку
  subcontoType?: "counterparty" | "contract"
}
```

### Пример: REVENUE_VAT

```json
{
  "lines": [
    { "accountCode": "5110", "side": "debit",  "expression": "amount" },
    { "accountCode": "9030", "side": "credit", "expression": "amount / (1 + vatRate / 100)" },
    { "accountCode": "6410", "side": "credit", "expression": "amount - amount / (1 + vatRate / 100)" }
  ]
}
```

### Пример: SALARY_ACCRUAL

Брутто ФОТ: Дт 9420 → Кт 6710  
ИНПС 0.1%: Дт 6710 → Кт 6530  
НДФЛ в бюджет 11.9%: Дт 6710 → Кт 6410  
Соцналог 12%: Дт 9420 → Кт 6520

---

## Вычислитель выражений (expressionEval.ts)

```typescript
evaluate(expression: string, payload: Record<string, any>): Decimal
```

Операции: `+`, `-`, `*`, `/`, `(`, `)`. Переменные из evalPayload.

Строки сохраняют исходный тип: код `0010` не превращается в `10`, две строки
сравниваются буквально. В числовом контексте допускается только десятичная запись
(включая экспоненту), не hex/binary, пустая строка или разделители разрядов.
Числовое сравнение строки с числом использует Decimal. Неизвестные переменные,
неконечный результат и деление на ноль отклоняются. Промежуточная точность Decimal
и политика округления всё ещё требуют отдельного решения.

---

## API проводок

```
POST /api/posting/post
Body: { documentId }
→ { journalEntries, openItem? }

POST /api/posting/void
Body: { documentId }
→ { ok: true }

POST /api/posting/repost
Body: { documentId, newTypeId }
→ { journalEntries, openItem? }
```

**Защиты:** период CLOSED → 423; несбалансированный шаблон → 422; счёт не найден → 422.

Общие API создания/проведения/аннулирования/перепроведения проверяют текущее
членство в организации и допускают OWNER/ADMIN/ACCOUNTANT. Системные типы
PERIOD_CLOSING, YEAR_END_CLOSE, SOLIQ_IMPORT, OPENING_CAPITAL_DECLARATION запрещены здесь
(включая смену типа при repost). POST /api/documents проверяет идентификаторы,
ISO-дату и JSON-object payload через Zod, но отдельных схем всех типов ещё нет.
Это не полная RBAC-матрица и не аудит всех API.

---

## Коды DocumentType и их проводки

`FIXED_ASSET_DISPOSAL_RESULT`: прибыль Дт 9210 / Кт 9310, убыток
Дт 9430 / Кт 9210 (НСБУ №21, рег. №3593, пп. 38, 412).
Исправление базового шаблона локальное; исторические записи на 9320 требуют
отдельного аудита и согласованной корректировки, не массового перепроведения.

| code | Дебет | Кредит | Примечание |
|------|-------|--------|-----------|
| `REVENUE_VAT` | 5110 | 9030 + 6410 | НДС включён |
| `REVENUE_NO_VAT` | 5110 | 9010 | Без НДС |
| `SUPPLIER_PAYMENT` | 6010 | 5110 | Устаревший тип, `mode: MANUAL_ONLY`. Новые операции: `SUPPLIER_PAYMENT_SERVICES`/`_GOODS`/`_OTHER`/`_VAT` |
| `SALARY` | 6710 | 5110 | Выплата зарплаты |
| `TAX_PAYMENT` | 6410 | 5110 | Не устанавливает DONE без распределения |
| `INPS_PAYMENT` | 6530 | 5110 | Не устанавливает DONE без распределения |
| `SOCIAL_TAX_PAYMENT` | 6520 | 5110 | Не устанавливает DONE без распределения |
| `RENT` | 9420 | 5110 | Аренда — прямой расход, без начисления |
| `RENT_PAYMENT` | 6010 | 5110 | Аренда — оплата после `RENT_ACCRUAL`, closesOpenItemByAccount не задан (гасит 6010 вручную) |
| `SALARY_ACCRUAL` | 9420 | 6710+6520+6530+6410 | ФОТ + налоги |
| `DEPRECIATION_ACCRUAL` | 9430 | 0200 | Амортизация ОС |
| `RENT_ACCRUAL` | 9420 | 6010 | Начисление аренды |
| `PROFIT_TAX_ACCRUAL` | 9810 | 6410 | Налог на прибыль 15% |
| `TURNOVER_TAX_ACCRUAL` | 9810 | 6410 | Налог с оборота |
| `FX_DIFFERENCE` | $fxAccountCode / 9620 | 9540 / $fxAccountCode | Счёт из payload (`fxAccountCode`), не хардкод; 9540/9620 = FX_INCOME/FX_EXPENSE |
| `ADVANCE_PAID` | 4310 | 5110 | opensItem: true, счёт 4310 |
| `ADVANCE_RECEIVED` | 5110 | 6310 | opensItem: true, счёт 6310 |
| `SUPPLIER_REFUND` | 5110 | 4310 | closesOpenItemByAccount: "4310" |
| `ADVANCE_RETURN_SENT` | 6310 | 5110 | closesOpenItemByAccount: "6310" |
| `DIVIDEND_ACCRUAL` | 8710 | 6610 | opensItem: true, счёт 6610 |
| `DIVIDEND_PAYMENT` | 6610 | 5110 | closesOpenItemByAccount: "6610" |
| `ACCOUNTABLE_WRITEOFF` / `ACCOUNTABLE_RETURN` | 9420 / 5110 | 4220 | closesOpenItemByAccount: "4220" |
| `ACCOUNTABLE_GENERAL_WRITEOFF` / `ACCOUNTABLE_GENERAL_RETURN` | 9430 / 5110 | 4230 | closesOpenItemByAccount: "4230" |
| `DEPOSIT_RETURN` | 5110 | 4890 | closesOpenItemByAccount: "4890" |
| `INTERNAL_TRANSFER_RECEIVED` | 5210 | 5710 | Приёмная сторона `INTERNAL_TRANSFER` (5710 Дт / 5110 Кт) |
| `INTANGIBLE_ASSET_PURCHASE` | 0830 | 5110 | НМА (лицензии, ПО, товарный знак, патент) |
| `INTANGIBLE_ASSET_COMMISSIONING` | $assetAccountCode | 0830 | Ввод НМА в эксплуатацию |
| `PERIOD_CLOSING` | 9xxx/9910 | 9910/9xxx | Реформация баланса; предупреждает, если 9210/9220 ненулевые (см. Модуль E) |
| `YEAR_END_CLOSE` | 9910/8710 | 8710/9910 | Перенос в 8710. `net9910 = Σ(credit − debit)`, прибыль при `> 0` (см. Модуль E) |

Полный и всегда актуальный список (177 типов) — автогенерируемый `docs/DOCUMENT_TYPES.md`
в корне репозитория (`npm run docs:types`, проверяется тестом `document-types-doc.test.ts`,
источник истины: `src/lib/ensureBaseData.ts`). Тематический обзор с пояснениями —
`docs/modules/module_DOCUMENT_TYPES.md`, но он поддерживается вручную и может отставать
по названиям/полноте (см. предупреждение в начале того файла) — при расхождении
доверять `docs/DOCUMENT_TYPES.md`.

---

## Налоговые константы (`constants.ts: TAX_RATES`)

```typescript
TAX_RATES = {
  NDFL: 0.12,         // НДФЛ суммарно
  NDFL_BUDGET: 0.119, // НДФЛ в бюджет 11.9%
  INPS: 0.001,        // ИНПС 0.1%
  SOCIAL_TAX: 0.12,   // Соцналог 12%
  VAT: 0.12,          // НДС 12%
  PROFIT_TAX: 0.15,   // Налог на прибыль 15%
  TURNOVER_TAX: 0.04, // Налог с оборота (дефолт; переопределяется org.turnoverTaxRate)
}
```

---

## Переменные в expressionEval

| Переменная | Описание |
|-----------|---------|
| `amount` | Сумма транзакции |
| `vatRate` | Ставка НДС (12 если плательщик, 0 иначе) |
| `salaryAmount` | Сумма ФОТ |
| `depreciationAmount` | Сумма амортизации |
| `rentAmount` | Сумма аренды |
| `fxDifference` | Сумма курсовой разницы |
| `taxAmount` | Сумма налога |

---

## prismaWithOrg(orgId)

**Файл:** `src/lib/prisma.ts` — Prisma Extension для автоматической изоляции по orgId.

| Операция | Действие |
|---------|---------|
| findMany / findFirst / count / updateMany / deleteMany | Добавляет `WHERE orgId` |
| create | Добавляет `data.orgId` |
| createMany | Добавляет `orgId` в каждый элемент |
| upsert | Добавляет `where.orgId` + `create.orgId` |
| findUnique / findUniqueOrThrow | Выполняет запрос, затем проверяет `result.orgId === orgId` |
| update / delete | Сначала `findFirst({ id, orgId })`; ошибка FORBIDDEN если не найдено |

---

*Последнее обновление: 2026-06-30*

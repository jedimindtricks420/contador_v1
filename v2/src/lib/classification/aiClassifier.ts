import { OpenAI } from "openai";
import prisma from "../prisma";
import { StagedTransaction } from "@prisma/client";
import Decimal from "decimal.js";
import { AI, TRANSIT_INNS, CREDIT_ONLY_CODES, DEBIT_ONLY_CODES } from "../constants";
import { getActivityLabel } from "../activityCategories";
import { postDocument } from "../posting/postingEngine";
import { clearRulesCache } from "./rulesEngine";
import { getCharterCapitalDebt } from "../charterCapital";

// Transactions whose description mentions the charter capital but whose category
// can't be safely auto-decided (see the charter-capital guard in classifyAllWithAI).
const CHARTER_CAPITAL_MENTION_RE = /устав/i;

// CREDIT_ONLY_CODES/DEBIT_ONLY_CODES now live in lib/constants.ts — single source
// of truth shared with rulesEngine.ts and the manual clarification/category routes
// (previously duplicated here only, which is how the manual routes ended up with
// no direction validation at all).

// ─── Account helpers ───────────────────────────────────────────────────────────
const ACCOUNT_LABELS: Record<string, string> = {
  "6310": "Авансы ПОЛУЧЕННЫЕ от клиентов (нам должны отгрузить/выставить ЭСФ)",
  "4310": "Авансы ВЫДАННЫЕ поставщикам (они должны поставить товар/услугу)",
  "6810": "Банковские кредиты (остаток долга перед банком)",
  "6820": "Краткосрочные займы (от учредителей и от других компаний-партнёров)",
  "4720": "Займы сотрудникам",
  "4890": "Задолженность прочих дебиторов (депозиты, расчёты с агрегаторами)",
  "6990": "Неидентифицированные поступления",
  "4220": "Подотчётные суммы (командировочные)",
  "4230": "Подотчётные суммы (общехозяйственные)",
  "6610": "Дивиденды к оплате (начислены, не выплачены)",
};

// ─── Context builder ───────────────────────────────────────────────────────────

interface ClassificationContext {
  openItemsText: string;
  counterpartyHistoryText: string;
  rulesText: string;
  taxCalendarText: string;
}

async function buildContext(orgId: string): Promise<ClassificationContext> {
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

  const [openItems, pastDocs, rules, upcomingTax] = await Promise.all([
    // All open items — unresolved advances, loans, etc.
    prisma.openItem.findMany({
      where: { orgId, status: "OPEN" },
      include: { counterparty: true, account: true },
      orderBy: { amount: "desc" },
      take: 200
    }),

    // Bank-derived classified documents from the last 3 months
    prisma.document.findMany({
      where: {
        orgId,
        status: "POSTED",
        date: { gte: threeMonthsAgo },
        sourceTransactionId: { not: null }
      },
      include: { type: { select: { code: true } } },
      orderBy: { date: "desc" },
      take: 500
    }),

    // Organisation classification rules (INN → category, keyword → category)
    prisma.rule.findMany({
      where: { orgId },
      include: { documentType: { select: { code: true } } },
      take: 100
    }),

    // Upcoming unpaid tax obligations
    prisma.taxCalendarEvent.findMany({
      where: { orgId, status: "PENDING" },
      orderBy: { dueDate: "asc" },
      take: 8
    }),
  ]);

  // ── Open items grouped by account ──────────────────────────────────────────
  const byAccount = new Map<string, typeof openItems>();
  for (const item of openItems) {
    const code = item.account.code;
    if (!byAccount.has(code)) byAccount.set(code, []);
    byAccount.get(code)!.push(item);
  }

  const openItemsLines: string[] = [];
  for (const [code, items] of byAccount) {
    const label = ACCOUNT_LABELS[code] || `Счёт ${code}`;
    openItemsLines.push(`  ${label}:`);
    for (const item of items) {
      const name = item.counterparty?.name || "—";
      const inn = item.counterparty?.inn ? ` (ИНН ${item.counterparty.inn})` : "";
      const amt = Number(item.amount).toLocaleString("ru");
      const since = item.dateOpened.toISOString().split("T")[0];
      openItemsLines.push(`    • ${name}${inn}: ${amt} сум (с ${since})`);
    }
  }

  const openItemsText = openItemsLines.length > 0
    ? openItemsLines.join("\n")
    : "  Нет открытых позиций";

  // ── Counterparty history ────────────────────────────────────────────────────
  const cpMap = new Map<string, {
    name: string;
    cats: Map<string, number>;
    count: number;
  }>();

  for (const doc of pastDocs) {
    const p = doc.payload as any;
    const inn = String(p?.counterpartyInn || "").trim();
    const hint = String(p?.counterpartyHint || "").trim();
    const key = inn || hint;
    if (!key) continue;

    if (!cpMap.has(key)) {
      cpMap.set(key, { name: hint || `ИНН ${inn}`, cats: new Map(), count: 0 });
    }
    const entry = cpMap.get(key)!;
    const code = doc.type.code;
    entry.cats.set(code, (entry.cats.get(code) || 0) + 1);
    entry.count++;
  }

  const histLines = Array.from(cpMap.entries())
    .sort(([, a], [, b]) => b.count - a.count)
    .slice(0, 60)
    .map(([key, v]) => {
      const topCats = Array.from(v.cats.entries())
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([code, cnt]) => `${code}×${cnt}`)
        .join(", ");
      const innPart = key.match(/^\d{9,14}$/) ? ` [ИНН ${key}]` : "";
      return `  • ${v.name}${innPart}: ${topCats}`;
    });

  const counterpartyHistoryText = histLines.length > 0
    ? histLines.join("\n")
    : "  Нет истории";

  // ── Rules ───────────────────────────────────────────────────────────────────
  const rulesLines = rules
    .slice(0, 60)
    .map(r => {
      const type = r.matchType === "INN" ? `ИНН ${r.matchValue}` : `слово "${r.matchValue}"`;
      return `  • ${type} → ${r.documentType.code}`;
    });

  const rulesText = rulesLines.length > 0
    ? rulesLines.join("\n")
    : "  Нет правил";

  // ── Tax calendar ────────────────────────────────────────────────────────────
  const taxLines = upcomingTax.map(t => {
    const due = new Date(t.dueDate).toLocaleDateString("ru-RU");
    const amt = t.estimatedAmount
      ? ` ~${Number(t.estimatedAmount).toLocaleString("ru")} сум`
      : "";
    return `  • ${t.type} — срок ${due}${amt}`;
  });

  const taxCalendarText = taxLines.length > 0
    ? taxLines.join("\n")
    : "  Нет предстоящих налоговых платежей";

  return { openItemsText, counterpartyHistoryText, rulesText, taxCalendarText };
}

// ─── Prompt builder (direction-scoped) ──────────────────────────────────────────
// Один шаблон, параметризованный направлением — вместо одного общего промпта с
// плоским каталогом всех категорий и текстовым "ЗАКОНОМ НАПРАВЛЕНИЯ", каждая
// пачка транзакций одного направления получает СВОЙ промпт с уже отфильтрованным
// каталогом (см. classifyAllWithAI). Модель физически не видит категорий чужого
// направления, поэтому объяснять ей текстом, что можно/нельзя брать, больше не нужно.

type CatalogEntry = { id: string; code: string; name: string };
type Direction = "CREDIT" | "DEBIT";

const CREDIT_OPEN_ITEMS_HINTS = `Как использовать открытые позиции (для входящих платежей):
• Видишь платёж от контрагента из "Авансы ПОЛУЧЕННЫЕ" → он платит ещё раз (ADVANCE_RECEIVED) или дублирует
• Видишь платёж от контрагента из "Авансы ВЫДАННЫЕ" → он возвращает наш аванс (SUPPLIER_REFUND)
• Видишь платёж от контрагента с открытым депозитом (4890, DEPOSIT) → вероятно DEPOSIT_RETURN
• Видишь платёж от сотрудника с открытыми подотчётными (4220/4230) → вероятно ACCOUNTABLE_RETURN/ACCOUNTABLE_GENERAL_RETURN
• Видишь платёж от учредителя с открытым 6610 (DIVIDEND_ACCRUAL) → вероятно ошибка/не дивиденды; выплата дивидендов — это исходящий платёж, в эту пачку не попадает`;

const DEBIT_OPEN_ITEMS_HINTS = `Как использовать открытые позиции (для исходящих платежей):
• Видишь платёж контрагенту из "Авансы ВЫДАННЫЕ" → мы гасим долг (SUPPLIER_PAYMENT_SERVICES/_GOODS/_OTHER/_VAT), а не выдаём новый аванс
• Видишь платёж контрагенту из "Авансы ПОЛУЧЕННЫЕ" → мы возвращаем аванс клиенту (ADVANCE_RETURN_SENT)
• Видишь платёж на сумму ≈ остатку по банковскому кредиту → вероятно BANK_LOAN_REPAYMENT или INTEREST_PAYMENT`;

function creditRulesText(confidenceThreshold: number, remainingCharterDebt: Decimal | null): string {
  return `1.  Поступление от клиентов до выставления ЭСФ → ADVANCE_RECEIVED; после ЭСФ/акта → REVENUE_COLLECTION
2.  Поступление от маркетплейса (Payme, Click, Uzum, Ozon) → MARKETPLACE_INCOME
3.  Поступление от продажи основного средства → FIXED_ASSET_SALE
4.  Поступление от учредителя, назначение платежа упоминает "заём"/"займ" → FOUNDER_LOAN.
    Назначение платежа упоминает "уставный капитал"/"уставный фонд" — остаток долга по счёту 4610 передан как remainingCharterDebt = ${remainingCharterDebt !== null ? remainingCharterDebt.toNumber().toLocaleString("ru") + " сум" : "НЕ ОПРЕДЕЛЁН (устав не задекларирован)"}:
      а) remainingCharterDebt определён И сумма операции ≤ remainingCharterDebt → CAPITAL_CONTRIBUTION;
      б) remainingCharterDebt НЕ определён (устав не задекларирован) → НИКОГДА не бери CAPITAL_CONTRIBUTION и НИКОГДА не ставь confidence ≥ ${confidenceThreshold}. Выбери наиболее вероятный вариант из FOUNDER_LOAN / CAPITAL_INCREASE_PENDING, но confidence должен быть низким (< ${confidenceThreshold}), чтобы операция ушла на уточнение пользователю;
      в) remainingCharterDebt определён, но сумма операции > remainingCharterDebt → сумма превышает остаток долга, разделить одной проводкой нельзя: выбери CAPITAL_INCREASE_PENDING и снизь confidence < ${confidenceThreshold} — пользователь должен уточнить вручную, как разделить сумму между оплатой УК и довзносом сверх устава.
5.  Получение банковского кредита → BANK_LOAN_RECEIVED
6.  Возврат займа сотрудником → EMPLOYEE_LOAN_REPAYMENT
7.  Поступление от своего другого счёта (обычно на валютный, 5210) → INTERNAL_TRANSFER_RECEIVED
8.  Депозит возвращён → DEPOSIT_RETURN; остаток подотчётных сумм возвращён → ACCOUNTABLE_RETURN/ACCOUNTABLE_GENERAL_RETURN
9.  Поставщик возвращает НАШИ деньги → SUPPLIER_REFUND
10. Неустойка, штраф, пеня, полученная от партнёра → PENALTY_INCOME
11. Страховое возмещение, страховая выплата → INSURANCE_CLAIM_RECEIVED
12. Возврат переплаты налога не НДС (получатель Казначейство, описание содержит "возврат", "переплата") → TAX_REFUND_OTHER
13. Факторинг, выкуп дебиторки банком → FACTORING_RECEIVED
14. Займ от другой компании (не банк, не учредитель) → PARTNER_LOAN_RECEIVED
15. Возврат займа, выданного другой компании → PARTNER_LOAN_RETURNED
16. Тенант/арендатор возмещает коммунальные → TENANT_UTILITIES_RECEIVED
17. При неуверенности — выбирай ближайшее, но снижай confidence < ${confidenceThreshold}`;
}

function debitRulesText(confidenceThreshold: number): string {
  return `1.  Выплаты сотрудникам (зарплата, оклад, аванс по ЗП) → SALARY
2.  НДФЛ в бюджет (содержит "НДФЛ", "NDFL", получатель Казначейство) → TAX_PAYMENT
2a. ИНПС / накопительная пенсия (содержит "ИНПС", "INPS", получатель Народный банк) → INPS_PAYMENT
3.  Социальный налог → SOCIAL_TAX_PAYMENT
4.  Оплата поставщику по существующему долгу → SUPPLIER_PAYMENT_SERVICES (услуги, по умолчанию) / _GOODS (товары) / _VAT (с НДС) / _OTHER; предоплата без акта → ADVANCE_PAID
5.  Комиссия банка, РКО → BANK_COMMISSION
6.  Покупка основного средства → FIXED_ASSET_PURCHASE; покупка НМА (лицензия/ПО/товарный знак/патент) → INTANGIBLE_ASSET_PURCHASE
7.  Возврат займа учредителю → FOUNDER_LOAN_REPAYMENT
8.  Погашение банковского кредита → BANK_LOAN_REPAYMENT
9.  Займ сотруднику → EMPLOYEE_LOAN
10. Перевод на свой другой счёт (деньги уходят) → INTERNAL_TRANSFER
11. Аренда → RENT; реклама/маркетинг → ADVERTISING; проценты по кредиту → INTEREST_PAYMENT
12. Дивиденды (выплата) → DIVIDEND_PAYMENT; штрафы/пени → FINE_PENALTY; страховка → INSURANCE_PAYMENT
13. Коммунальные → UTILITY_PAYMENT; подписки/SaaS/домен → SUBSCRIPTION; таможня → CUSTOMS_DUTY
14. Гарантийный депозит выдан → DEPOSIT; подотчётные суммы выданы → ACCOUNTABLE/ACCOUNTABLE_GENERAL
15. Мы возвращаем деньги КЛИЕНТУ (закрываем 6310) → ADVANCE_RETURN_SENT
16. Возврат/корректировка покупателю (уменьшает выручку) → REFUND
17. Госпошлина, государственная пошлина → STATE_DUTY
18. Обучение, курсы, тренинг сотрудников → EMPLOYEE_TRAINING
19. Членский взнос, вступительный взнос в ассоциацию/СРО → MEMBERSHIP_FEE
20. Благотворительность, пожертвование → CHARITY_PAYMENT
21. Самозанятый, гражданин ФЛ без ГПХ → SELF_EMPLOYED_PAYMENT
22. ГПХ, договор подряда, гражданско-правовой договор → CIVIL_CONTRACT_PAYMENT
23. Юрист, адвокат, нотариус, аудит, консультант → PROFESSIONAL_SERVICES
24. ГСМ, топливо, бензин, дизель → FUEL_PURCHASE
25. Такси, Яндекс.Такси, каршеринг для бизнеса → TAXI_BUSINESS
26. Перевод документов, бюро переводов → TRANSLATION_SERVICES
27. Гарантийный ремонт, сервисное обслуживание клиента → WARRANTY_REPAIR
28. Займ выдан другой компании-партнёру → PARTNER_LOAN_ISSUED
29. Возврат займа другой компании → PARTNER_LOAN_REPAID
30. Эквайринг, комиссия платёжной системы, процессинг → ACQUIRING_COMMISSION
31. Доставка, курьер, транспорт для клиента → DELIVERY_TO_CUSTOMER
32. Упаковка, тара, упаковочные материалы → PACKAGING_COST
33. Таможенный брокер, декларант, таможенное оформление → CUSTOMS_BROKER
34. Сертификация, декларация соответствия товара/продукции → PRODUCT_CERTIFICATION
35. Инкассация, инкассаторы → CASH_COLLECTION_SERVICE
36. ЧОП, охрана, охранные услуги → SECURITY_SERVICES
37. Реклама на маркетплейсе, продвижение карточки → MARKETPLACE_PROMOTION
38. Реферальное, агентское вознаграждение партнёру → REFERRAL_COMMISSION
39. Мобильная связь, корпоративные симки → MOBILE_COMMUNICATION
40. Конференция, форум, семинар, участие в мероприятии → CONFERENCE_FEE
41. Сырьё, закупка материалов напрямую → RAW_MATERIALS_PURCHASE
42. Разрешение, согласование, стройнадзор → PERMITS_APPROVALS
43. Лицензия на публичное воспроизведение музыки → MUSIC_LICENSE
44. Платные дороги, парковки → ROAD_TOLLS
45. Медицинская лицензия → MEDICAL_LICENSE
46. При неуверенности — выбирай ближайшее, но снижай confidence < ${confidenceThreshold}`;
}

interface PromptParams {
  direction: Direction;
  catalog: CatalogEntry[];
  org: { name: string; taxRegime: string; isVatPayer: boolean };
  activityLabel: string;
  confidenceThreshold: number;
  remainingCharterDebt: Decimal | null;
  ctx: ClassificationContext;
}

function buildSystemPrompt(p: PromptParams): string {
  const { direction, catalog, org, activityLabel, confidenceThreshold, remainingCharterDebt, ctx } = p;
  const isCredit = direction === "CREDIT";
  const directionRu = isCredit ? "ВХОДЯЩИЕ (деньги приходят на счёт, 5110 Дт)" : "ИСХОДЯЩИЕ (деньги уходят со счёта, 5110 Кт)";

  const extraFieldsBlock = isCredit
    ? `━━━ ДОПОЛНИТЕЛЬНЫЕ ПОЛЯ-РАЗВИЛКИ (receiptType) ━━━
customsType и subscriptionPeriod для входящих операций не применяются — всегда null.
У одного типа документа проводка зависит от подтипа операции. Заполняй поле receiptType
ТОЛЬКО когда categoryCode совпадает; для всех остальных categoryCode — null.

• categoryCode = "TARGET_RECEIPTS" → receiptType:
    "membership" — членский/вступительный взнос;
    "other" — прочие целевые поступления;
    null — если не ясно.`
    : `━━━ ДОПОЛНИТЕЛЬНЫЕ ПОЛЯ-РАЗВИЛКИ (customsType / subscriptionPeriod) ━━━
receiptType для исходящих операций не применяется — всегда null.
У двух типов документов проводка зависит от подтипа операции. Заполняй соответствующее поле
ТОЛЬКО когда categoryCode совпадает; для всех остальных categoryCode — null во всех полях.

• categoryCode = "CUSTOMS_DUTY" → customsType:
    "import_goods" — пошлина/сбор при ввозе ТМЗ, сырья, товаров для перепродажи;
    "import_asset" — пошлина/сбор при ввозе основных средств, оборудования;
    null — если из описания не ясно (пойдёт в прочие расходы по умолчанию).
• categoryCode = "SUBSCRIPTION" → subscriptionPeriod:
    "monthly" — явно ежемесячная подписка/оплата;
    "other" — годовая, полугодовая или иная не-ежемесячная предоплата;
    null — если период не ясен из описания.`;

  const taxCalendarBlock = isCredit ? "" : `
━━━ БЛИЖАЙШИЕ НАЛОГОВЫЕ ОБЯЗАТЕЛЬСТВА ━━━
${ctx.taxCalendarText}
Если видишь платёж на сумму близкую к налоговому обязательству и дата ≈ 20-е число:
  • PERSONAL_INCOME_TAX → TAX_PAYMENT (получатель Казначейство, описание содержит "НДФЛ" или "NDFL")
  • INPS → INPS_PAYMENT (получатель Народный банк или описание содержит "ИНПС"/"INPS")
  • SOCIAL_TAX → SOCIAL_TAX_PAYMENT (получатель Казначейство, описание содержит "соц" или "Социальный налог")
  • VAT/TURNOVER_TAX/PROFIT_TAX → TAX_PAYMENT (прочие налоги в бюджет)
`;

  return `Ты — эксперт по бухгалтерскому учёту в Узбекистане (НСБУ №21). Классифицируй банковские транзакции.
Эта пачка содержит ТОЛЬКО ${directionRu} транзакции — другого направления здесь нет и быть не может.
confidence — целое число от 0 до 100 (процент уверенности в классификации). Порог авто-проводки: ${confidenceThreshold}.

━━━ ОРГАНИЗАЦИЯ ━━━
Название: ${org.name}
${activityLabel !== "Не указано" ? `Вид деятельности: ${activityLabel}` : ""}
Налоговый режим: ${org.taxRegime === "VAT" ? "НДС + налог на прибыль" : "Налог с оборота (УСН)"}
Плательщик НДС: ${org.isVatPayer ? "Да" : "Нет"}

━━━ КАТАЛОГ ТИПОВ ДОКУМЕНТОВ — единственные возможные категории для этого направления ━━━
Каталог ниже уже отфильтрован под ${directionRu.toLowerCase()} операции. Категорий другого
направления среди них нет и предлагать их не нужно — categoryCode обязан быть строго из
этого списка (${catalog.length} категорий).
${JSON.stringify(catalog, null, 2)}

В поле categoryCode всегда возвращай значение code из каталога выше.

━━━ ОТКРЫТЫЕ ПОЗИЦИИ (что сейчас висит на счетах) ━━━
${ctx.openItemsText}

${isCredit ? CREDIT_OPEN_ITEMS_HINTS : DEBIT_OPEN_ITEMS_HINTS}

━━━ ИСТОРИЯ КОНТРАГЕНТОВ (последние 3 месяца) ━━━
${ctx.counterpartyHistoryText}

Используй историю как сильную подсказку. Если контрагент почти всегда получает одну и ту же категорию — почти наверняка она подойдёт снова.

━━━ ПРАВИЛА ОРГАНИЗАЦИИ ━━━
${ctx.rulesText}
${taxCalendarBlock}
━━━ ТРАНЗИТНЫЕ СЧЕТА УЗБЕКИСТАНА ━━━
Если isTransit=true — контрагент (Казначейство, НБУ, биржа) является транзитным посредником.
Реальный плательщик/получатель ТОЛЬКО в поле description. Ищи там ИНН или название.

━━━ ПРАВИЛА КЛАССИФИКАЦИИ ━━━
${isCredit ? creditRulesText(confidenceThreshold, remainingCharterDebt) : debitRulesText(confidenceThreshold)}

В поле reasoning коротко объясни ПОЧЕМУ выбрал эту категорию (1-2 предложения), ссылаясь на историю или открытые позиции.

${extraFieldsBlock}

━━━ ПРАВИЛО ДЛЯ АВТОМАТИЗАЦИИ (suggestedRuleType / suggestedRuleValue) ━━━
Выбери ЛУЧШИЙ признак для автоматической классификации похожих операций в будущем.

suggestedRuleType:
• "KEYWORD" — ПРИОРИТЕТ: используй, когда description содержит характерное ключевое слово (название компании, тип услуги, вид платежа). ОБЯЗАТЕЛЬНО для isTransit=true — ИНН транзитного счёта не характеризует реальный платёж.
• "INN"     — только если extractedInn принадлежит РЕАЛЬНОМУ (не транзитному) контрагенту, AND этот контрагент делает ОДИН тип операции с данной организацией. Не используй INN если тот же контрагент может делать разные типы операций.
• "NONE"    — если нет надёжного признака для автоматизации.

suggestedRuleValue:
• Для "KEYWORD": КОРОТКАЯ характерная фраза из description (3–40 символов). Выбирай название компании, вид услуги или тип платежа. Примеры: "Tashkent Plaza", "аренда офиса", "ИНПС", "Payme", "электроэнергия", "таможенный сбор".
• Для "INN": значение из extractedInn.
• Для "NONE": пустая строка "".

ВАЖНО: isTransit=true → ВСЕГДА "KEYWORD", НИКОГДА не "INN".`;
}

// ─── JSON schema builder (direction-scoped) ─────────────────────────────────────
// categoryCode получает настоящий enum, собранный из отфильтрованного каталога —
// раньше это было просто { type: "string" }, ограниченное только текстом промпта.
// Теперь модель физически не может сгенерировать код вне списка для этого направления.
function buildResponseSchema(catalog: CatalogEntry[]) {
  return {
    type: "json_schema" as const,
    json_schema: {
      name: "classification_response",
      schema: {
        type: "object" as const,
        properties: {
          results: {
            type: "array" as const,
            items: {
              type: "object" as const,
              properties: {
                transactionId:         { type: "string" as const },
                categoryCode:          { type: "string" as const, enum: catalog.map(c => c.code) },
                confidence:            { type: "integer" as const },
                extractedCounterparty: { type: "string" as const },
                extractedInn:          { type: "string" as const },
                vatApplicable:         { type: "boolean" as const },
                reasoning:             { type: "string" as const },
                suggestedRuleType:     { type: "string" as const },
                suggestedRuleValue:    { type: "string" as const },
                customsType:           { type: ["string", "null"] as any, enum: ["import_goods", "import_asset", null] },
                subscriptionPeriod:    { type: ["string", "null"] as any, enum: ["monthly", "other", null] },
                receiptType:           { type: ["string", "null"] as any, enum: ["membership", "other", null] },
              },
              required: ["transactionId", "categoryCode", "confidence", "extractedCounterparty", "extractedInn", "vatApplicable", "reasoning", "suggestedRuleType", "suggestedRuleValue", "customsType", "subscriptionPeriod", "receiptType"],
              additionalProperties: false,
            }
          }
        },
        required: ["results"],
        additionalProperties: false,
      },
      strict: true,
    }
  };
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

// ─── Main export ───────────────────────────────────────────────────────────────

interface ClassificationResult {
  transactionId: string;
  categoryCode: string;
  confidence: number;
  extractedCounterparty: string;
  extractedInn: string;
  vatApplicable: boolean;
  reasoning: string;
  suggestedRuleType: "INN" | "KEYWORD" | "NONE";
  suggestedRuleValue: string;
  // Categorical fields that a handful of templates branch on (posting engine
  // silently defaults to the "else" branch when these are missing — see CUSTOMS_DUTY,
  // SUBSCRIPTION, TARGET_RECEIPTS in ensureBaseData.ts). null unless categoryCode needs them.
  customsType: "import_goods" | "import_asset" | null;
  subscriptionPeriod: "monthly" | "other" | null;
  receiptType: "membership" | "other" | null;
}

// Одно задание на классификацию — пачка транзакций ОДНОГО направления вместе со
// своим (уже отфильтрованным) каталогом, промптом и схемой ответа. CREDIT- и
// DEBIT-пачки собираются в один плоский список заданий и обрабатываются одним
// циклом ниже — тело цикла не знает и не должно знать, из какой ветки пришло
// задание, поэтому логика обработки результата существует в коде только один раз.
interface ClassificationJob {
  direction: Direction;
  chunk: StagedTransaction[];
  responseFormatSchema: ReturnType<typeof buildResponseSchema>;
  systemPrompt: string;
}

/**
 * Classifies all provided transactions with full business context.
 * Transactions are split by direction (CREDIT/DEBIT) before chunking — each
 * direction gets its own catalog/prompt/schema containing ONLY categories valid
 * for that direction, so the model cannot select a category of the wrong
 * direction (previously caught only after the fact by CREDIT_ONLY_CODES/
 * DEBIT_ONLY_CODES, which are now also the source of the per-direction filter).
 */
export async function classifyAllWithAI(
  orgId: string,
  transactions: StagedTransaction[]
): Promise<{ matched: number; needsClarification: number }> {
  if (transactions.length === 0) return { matched: 0, needsClarification: 0 };

  const azureEndpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const azureApiKey = process.env.AZURE_OPENAI_API_KEY;
  if (!azureEndpoint || !azureApiKey) {
    throw new Error("Azure AI Foundry: AZURE_OPENAI_ENDPOINT и AZURE_OPENAI_API_KEY не настроены");
  }

  const openai = new OpenAI({ apiKey: azureApiKey, baseURL: azureEndpoint });

  // Load everything in parallel: catalog, org, full context.
  // mode: "BANK_AUTO" — явный allow-list, а не (mode !== "MANUAL_ONLY"). Раньше
  // deny-list пропускал в каталог ИИ служебные типы вроде SOLIQ_IMPORT (протухшая
  // запись в БД с mode=BANK_AUTO, хотя код, который её создаёт, ставит MANUAL_ONLY) —
  // allow-list структурно закрывает этот случай независимо от состояния конкретных строк.
  const [catalogRaw, org, ctx] = await Promise.all([
    prisma.documentType.findMany({ where: { mode: "BANK_AUTO" }, select: { id: true, code: true, name: true } }),
    prisma.organization.findUnique({ where: { id: orgId } }),
    buildContext(orgId),
  ]);

  if (!org) throw new Error("Организация не найдена");

  const creditCatalog = catalogRaw.filter(dt => CREDIT_ONLY_CODES.has(dt.code));
  const debitCatalog = catalogRaw.filter(dt => DEBIT_ONLY_CODES.has(dt.code));

  const activityLabel = getActivityLabel(org.activityGroup, org.activityDescription, org.activityCustom);
  const confidenceThreshold = org.aiConfidenceThreshold ?? AI.CONFIDENCE_THRESHOLD;
  // Only codes that were actually offered to the AI (either catalog) are safe to auto-create
  const codeToId = new Map(catalogRaw.map(dt => [dt.code, dt.id]));

  // Outstanding founders' debt on 4610 — null when the charter capital was never
  // declared. Passed into the prompt AND used as a hard guardrail below: CAPITAL_
  // CONTRIBUTION (and anything mentioning "устав") never gets auto-posted without it.
  const remainingCharterDebt = org.charterCapitalDeclaredAt ? await getCharterCapitalDebt(orgId) : null;

  // ── Enrich transactions: extract INN/name from description ──────────────────
  const enriched = transactions.map(tx => {
    let inn = tx.counterpartyInn || "";
    let hint = tx.counterpartyHint || "";

    const innRegex = /(?:ИНН|СТИР|INN)\s*:?\s*(\d{9,14})\b(?:\s*\(([^)]+)\))?/i;
    const m = tx.description.match(innRegex);
    if (m) {
      inn = m[1];
      if (m[2]) hint = m[2].trim();
    }

    const amt = new Decimal(tx.amount.toString()).toNumber();
    const directionLabel = tx.direction === "CREDIT"
      ? `ВХОДЯЩИЙ ПЛАТЁЖ +${amt.toLocaleString("ru")} сум`
      : `ИСХОДЯЩИЙ ПЛАТЁЖ −${amt.toLocaleString("ru")} сум`;

    return {
      id: tx.id,
      date: tx.date.toISOString().split("T")[0],
      amount: amt,
      direction: tx.direction,
      directionLabel,
      description: tx.description,
      counterpartyName: hint,
      counterpartyInn: inn,
      isTransit: TRANSIT_INNS.has(inn),
    };
  });

  // ── Build one prompt/schema per direction (shared context, different catalog) ──
  const creditPrompt = buildSystemPrompt({ direction: "CREDIT", catalog: creditCatalog, org, activityLabel, confidenceThreshold, remainingCharterDebt, ctx });
  const debitPrompt = buildSystemPrompt({ direction: "DEBIT", catalog: debitCatalog, org, activityLabel, confidenceThreshold, remainingCharterDebt, ctx });
  const creditSchema = buildResponseSchema(creditCatalog);
  const debitSchema = buildResponseSchema(debitCatalog);

  // ── Split transactions by direction, chunk each group, collect into one flat job list ──
  const creditTxs = transactions.filter(tx => tx.direction === "CREDIT");
  const debitTxs = transactions.filter(tx => tx.direction === "DEBIT");

  const jobs: ClassificationJob[] = [
    ...chunkArray(creditTxs, AI.BATCH_SIZE).map((chunk): ClassificationJob => ({
      direction: "CREDIT", chunk, systemPrompt: creditPrompt, responseFormatSchema: creditSchema,
    })),
    ...chunkArray(debitTxs, AI.BATCH_SIZE).map((chunk): ClassificationJob => ({
      direction: "DEBIT", chunk, systemPrompt: debitPrompt, responseFormatSchema: debitSchema,
    })),
  ];

  // ── Process every job with the same single loop — body doesn't need to know ──
  // ── which direction a job came from, so there is only one copy of this logic ──
  let matched = 0;
  let needsClarification = 0;
  const processedTxIds = new Set<string>();

  for (const job of jobs) {
    const { chunk, systemPrompt, responseFormatSchema } = job;
    const chunkEnriched = enriched.filter(e => chunk.some(tx => tx.id === e.id));

    let results: ClassificationResult[] = [];
    try {
      const response = await openai.chat.completions.create({
        model: AI.MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: JSON.stringify({ transactions: chunkEnriched }) }
        ],
        response_format: responseFormatSchema,
        max_completion_tokens: 16384,
      });

      const text = response.choices[0].message.content || "{}";
      results = JSON.parse(text).results || [];
    } catch (aiErr: any) {
      console.error("AI call failed for chunk, sending all to NEEDS_CLARIFICATION:", aiErr.message);
      for (const tx of chunk) {
        await prisma.stagedTransaction.update({
          where: { id: tx.id },
          data: { status: "NEEDS_CLARIFICATION" }
        });
        needsClarification++;
        processedTxIds.add(tx.id);
      }
      continue;
    }

    for (const res of results) {
      const tx = chunk.find(t => t.id === res.transactionId);
      if (!tx) continue;
      processedTxIds.add(tx.id);

      const resolvedTypeId = codeToId.get(res.categoryCode);

      const aiSuggestion = {
        categoryId: resolvedTypeId ?? null,
        categoryCode: res.categoryCode,
        confidence: res.confidence,
        extractedCounterparty: res.extractedCounterparty,
        extractedInn: res.extractedInn,
        vatApplicable: res.vatApplicable,
        reasoning: res.reasoning,
        customsType: res.customsType,
        subscriptionPeriod: res.subscriptionPeriod,
        receiptType: res.receiptType,
      };

      // Unknown code
      if (!resolvedTypeId) {
        console.warn(`AI: unknown categoryCode "${res.categoryCode}" for tx ${tx.id}`);
        await prisma.stagedTransaction.update({
          where: { id: tx.id },
          data: { status: "NEEDS_CLARIFICATION", aiSuggestion: aiSuggestion as any }
        });
        needsClarification++;
        continue;
      }

      // Direction guard: reject physically impossible categorisations. With the
      // per-direction enum (buildResponseSchema) this should be unreachable in
      // practice — kept as defense-in-depth in case a code ever slips through
      // outside its enum (SDK/model edge case).
      const directionMismatch =
        (tx.direction === "DEBIT"   && CREDIT_ONLY_CODES.has(res.categoryCode)) ||
        (tx.direction === "CREDIT"  && DEBIT_ONLY_CODES.has(res.categoryCode));

      if (directionMismatch) {
        console.warn(`AI direction mismatch: tx ${tx.id} is ${tx.direction} but got ${res.categoryCode}`);
        await prisma.stagedTransaction.update({
          where: { id: tx.id },
          data: {
            status: "NEEDS_CLARIFICATION",
            aiSuggestion: { ...aiSuggestion, directionMismatch: true } as any
          }
        });
        needsClarification++;
        continue;
      }

      // Charter-capital guard: never auto-post CAPITAL_CONTRIBUTION (and never leave
      // "Авто" for anything mentioning "устав") when the declared/outstanding 4610
      // debt can't back it up — ground truth overrides the AI's own confidence here,
      // same as the direction guard above. See getCharterCapitalDebt / ensureBaseData
      // (OPENING_CAPITAL_DECLARATION) and the postDocument guard for the enforcement
      // backstop if this is ever bypassed.
      const txAmount = new Decimal(tx.amount.toString());
      let charterGuardReason: string | null = null;
      if (res.categoryCode === "CAPITAL_CONTRIBUTION") {
        if (remainingCharterDebt === null) {
          charterGuardReason = "Уставный капитал не задекларирован — уточните вручную (заём учредителя или довзнос сверх устава).";
        } else if (remainingCharterDebt.lte(0)) {
          charterGuardReason = "Долг по счёту 4610 уже полностью погашен — уточните вручную.";
        } else if (txAmount.gt(remainingCharterDebt)) {
          charterGuardReason = `Сумма операции (${txAmount.toNumber().toLocaleString("ru")}) превышает остаток долга по УК (${remainingCharterDebt.toNumber().toLocaleString("ru")}) — разделите вручную на оплату УК и довзнос сверх устава.`;
        }
      } else if (CHARTER_CAPITAL_MENTION_RE.test(tx.description) && (remainingCharterDebt === null || remainingCharterDebt.lte(0))) {
        charterGuardReason = "Описание упоминает устав/уставный капитал, но он не задекларирован — уточните вручную.";
      }

      if (charterGuardReason) {
        console.warn(`AI charter-capital guard: tx ${tx.id} — ${charterGuardReason}`);
        await prisma.stagedTransaction.update({
          where: { id: tx.id },
          data: {
            status: "NEEDS_CLARIFICATION",
            aiSuggestion: { ...aiSuggestion, charterGuardReason } as any
          }
        });
        needsClarification++;
        continue;
      }

      if (res.confidence >= confidenceThreshold) {
        // Create document + post + update StagedTransaction atomically.
        // On any failure the DB transaction rolls back — no partial/orphaned entries.
        try {
          await prisma.$transaction(async (txClient) => {
            const doc = await txClient.document.create({
              data: {
                orgId,
                periodId: tx.periodId,
                typeId: resolvedTypeId,
                date: tx.date,
                status: "POSTED",
                sourceTransactionId: tx.id,
                payload: {
                  amount: Number(tx.amount),
                  description: tx.description,
                  direction: tx.direction,
                  counterpartyHint: res.extractedCounterparty || tx.counterpartyHint || null,
                  counterpartyInn: res.extractedInn || tx.counterpartyInn || null,
                  aiConfidence: res.confidence,
                  aiReasoning: res.reasoning,
                  // Only set when the AI actually resolved the subtype — omitting them lets the
                  // template's default branch apply exactly as before when the AI is unsure.
                  ...(res.customsType ? { customsType: res.customsType } : {}),
                  ...(res.subscriptionPeriod ? { subscriptionPeriod: res.subscriptionPeriod } : {}),
                  ...(res.receiptType ? { receiptType: res.receiptType } : {}),
                } as any
              }
            });
            await postDocument(doc.id, txClient, "system");
            await txClient.stagedTransaction.update({
              where: { id: tx.id },
              data: { status: "AUTO_MATCHED", documentId: doc.id, aiSuggestion: aiSuggestion as any }
            });
          });
        } catch (txErr: any) {
          console.error(`AI: transaction failed for tx ${tx.id}:`, txErr.message);
          await prisma.stagedTransaction.update({
            where: { id: tx.id },
            data: { status: "NEEDS_CLARIFICATION", aiSuggestion: aiSuggestion as any }
          });
          needsClarification++;
          continue;
        }

        // Persist rule for future deterministic re-use.
        // AI decides the best match signal (suggestedRuleType / suggestedRuleValue).
        // Transit INNs are never used as INN rules — fall back to keyword.
        const txMeta = enriched.find(e => e.id === tx.id);
        const suggestedType = (res.suggestedRuleType || "NONE") as string;
        const suggestedValue = (res.suggestedRuleValue || "").trim();

        let finalMatchType: "INN" | "KEYWORD" | null = null;
        let finalMatchValue = "";

        if (suggestedType === "INN" && suggestedValue.length > 2 && !txMeta?.isTransit) {
          finalMatchType = "INN";
          finalMatchValue = suggestedValue;
        } else if (suggestedType === "KEYWORD" && suggestedValue.length > 2) {
          finalMatchType = "KEYWORD";
          finalMatchValue = suggestedValue;
        } else if (suggestedType === "INN" && txMeta?.isTransit) {
          // Transit account — fall back to keyword from extracted counterparty or description hint
          const fallback = (res.extractedCounterparty || "").trim();
          if (fallback.length > 2) {
            finalMatchType = "KEYWORD";
            finalMatchValue = fallback;
          }
        }

        if (finalMatchType && finalMatchValue) {
          // Dedup: Rule has @@unique([orgId, matchType, matchValue]) — one rule per match signal.
          // If a rule already exists for this signal (regardless of direction), skip creation.
          // Rule creation is best-effort: a transient DB error must not fail the whole job.
          try {
            const existing = await prisma.rule.findFirst({
              where: { orgId, matchType: finalMatchType, matchValue: finalMatchValue }
            });
            if (!existing) {
              await prisma.rule.create({
                data: {
                  orgId,
                  matchType: finalMatchType,
                  matchValue: finalMatchValue,
                  categoryId: resolvedTypeId,
                  createdFrom: "AI_SUGGESTED",
                  direction: tx.direction,
                }
              });
              clearRulesCache(orgId);
            }
          } catch (ruleErr: any) {
            // Rule creation is best-effort — log and continue; the document is already posted
            console.warn(`AI: could not create rule for tx ${tx.id}:`, ruleErr.message);
          }
        }

        matched++;
      } else {
        await prisma.stagedTransaction.update({
          where: { id: tx.id },
          data: { status: "NEEDS_CLARIFICATION", aiSuggestion: aiSuggestion as any }
        });
        needsClarification++;
      }
    }

    // Transactions not returned by AI → clarification queue
    for (const tx of chunk) {
      if (!processedTxIds.has(tx.id)) {
        await prisma.stagedTransaction.update({
          where: { id: tx.id },
          data: { status: "NEEDS_CLARIFICATION" }
        });
        needsClarification++;
        processedTxIds.add(tx.id);
      }
    }
  }

  return { matched, needsClarification };
}

// Keep the old name as an alias so nothing else breaks during the transition period
export const classifyBatchWithAI = classifyAllWithAI;

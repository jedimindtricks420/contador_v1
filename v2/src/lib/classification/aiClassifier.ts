import { OpenAI } from "openai";
import prisma from "../prisma";
import { StagedTransaction } from "@prisma/client";
import Decimal from "decimal.js";
import { AI, TRANSIT_INNS } from "../constants";
import { getActivityLabel } from "../activityCategories";
import { postDocument } from "../posting/postingEngine";
import { clearRulesCache } from "./rulesEngine";

// ─── Direction guards ──────────────────────────────────────────────────────────
// These sets are the ground truth — overrides whatever the AI returns.
// A CREDIT tx (money in, 5110 Дт) can never be categorised as a DEBIT-only type.

const CREDIT_ONLY_CODES = new Set([
  "ADVANCE_RECEIVED", "REVENUE_COLLECTION", "MARKETPLACE_INCOME",
  "FOUNDER_LOAN", "CAPITAL_CONTRIBUTION", "BANK_LOAN_RECEIVED",
  "EMPLOYEE_LOAN_REPAYMENT", "FIXED_ASSET_SALE", "SUPPLIER_REFUND",
  "REVENUE_VAT", "REVENUE_NO_VAT",
]);

const DEBIT_ONLY_CODES = new Set([
  "SUPPLIER_PAYMENT", "SUPPLIER_PAYMENT_GOODS", "SUPPLIER_PAYMENT_SERVICES",
  "SUPPLIER_PAYMENT_OTHER", "SUPPLIER_PAYMENT_VAT", "ADVANCE_PAID",
  "SALARY", "TAX_PAYMENT", "SOCIAL_TAX_PAYMENT", "INPS_PAYMENT", "RENT", "ADVERTISING",
  "OTHER_EXPENSE", "ACCOUNTABLE", "FIXED_ASSET_PURCHASE", "BANK_COMMISSION",
  "BANK_LOAN_REPAYMENT", "FOUNDER_LOAN_REPAYMENT", "EMPLOYEE_LOAN", "INTEREST_PAYMENT",
  "DIVIDEND_PAYMENT", "FINE_PENALTY", "INSURANCE_PAYMENT", "UTILITY_PAYMENT",
  "SUBSCRIPTION", "CUSTOMS_DUTY", "DEPOSIT", "REFUND",
  "ADVANCE_RETURN_SENT", // 6310 Дт — 5110 Кт, деньги уходят
  // INTERNAL_TRANSFER шаблон: Дт5710/Кт5110 — только исходящий (DEBIT).
  // Входящий перевод (CREDIT) не существует как отдельный тип — требует уточнения.
  "INTERNAL_TRANSFER",
  "RENT_PAYMENT",        // 6010 Дт — 5110 Кт, оплата аренды после начисления
  "ACCOUNTABLE_GENERAL", // 4230 Дт — 5110 Кт, подотчётные (общехозяйственные)
]);


// ─── Account helpers ───────────────────────────────────────────────────────────
const ACCOUNT_LABELS: Record<string, string> = {
  "6310": "Авансы ПОЛУЧЕННЫЕ от клиентов (нам должны отгрузить/выставить ЭСФ)",
  "4310": "Авансы ВЫДАННЫЕ поставщикам (они должны поставить товар/услугу)",
  "6810": "Банковские кредиты (остаток долга перед банком)",
  "6820": "Займы от учредителей",
  "4720": "Займы сотрудникам",
  "4890": "Задолженность прочих дебиторов (депозиты, расчёты с агрегаторами)",
  "6990": "Неидентифицированные поступления",
  "4220": "Подотчётные суммы",
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
}

/**
 * Classifies all provided transactions with full business context.
 * Processes in chunks of AI.BATCH_SIZE but each chunk receives the
 * complete open-items / history / rules / tax context.
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

  // Load everything in parallel: catalog, org, full context
  const [catalogRaw, org, ctx] = await Promise.all([
    prisma.documentType.findMany({ select: { id: true, code: true, name: true, mode: true } }),
    prisma.organization.findUnique({ where: { id: orgId } }),
    buildContext(orgId),
  ]);

  if (!org) throw new Error("Организация не найдена");

  const catalog = catalogRaw
    .filter(dt => dt.mode !== "MANUAL_ONLY")
    .map(({ id, code, name }) => ({ id, code, name }));

  const activityLabel = getActivityLabel(org.activityGroup, org.activityDescription, org.activityCustom);
  const confidenceThreshold = org.aiConfidenceThreshold ?? AI.CONFIDENCE_THRESHOLD;
  // Only codes that were actually offered to the AI are safe to auto-create
  const codeToId = new Map(catalog.map(dt => [dt.code, dt.id]));

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

  // ── Build system prompt (built once, shared across all chunks) ──────────────
  const systemPrompt = `Ты — эксперт по бухгалтерскому учёту в Узбекистане (НСБУ №21). Классифицируй банковские транзакции.
confidence — целое число от 0 до 100 (процент уверенности в классификации). Порог авто-проводки: ${confidenceThreshold}.

━━━ ОРГАНИЗАЦИЯ ━━━
Название: ${org.name}
${activityLabel !== "Не указано" ? `Вид деятельности: ${activityLabel}` : ""}
Налоговый режим: ${org.taxRegime === "VAT" ? "НДС + налог на прибыль" : "Налог с оборота (УСН)"}
Плательщик НДС: ${org.isVatPayer ? "Да" : "Нет"}

━━━ ЗАКОН НАПРАВЛЕНИЯ — АБСОЛЮТНЫЙ ЗАПРЕТ ━━━
Каждая транзакция имеет поле directionLabel. Читай его ДО выбора категории.
direction="CREDIT" (деньги ПРИХОДЯТ, ВХОДЯЩИЙ ПЛАТЁЖ, 5110 Дт) → только:
  ADVANCE_RECEIVED, REVENUE_COLLECTION, MARKETPLACE_INCOME, FOUNDER_LOAN, CAPITAL_CONTRIBUTION, BANK_LOAN_RECEIVED, EMPLOYEE_LOAN_REPAYMENT, FIXED_ASSET_SALE, SUPPLIER_REFUND, REVENUE_VAT, REVENUE_NO_VAT

direction="DEBIT" (деньги УХОДЯТ, ИСХОДЯЩИЙ ПЛАТЁЖ, 5110 Кт) → только:
  SUPPLIER_PAYMENT и варианты, ADVANCE_PAID, SALARY, TAX_PAYMENT, SOCIAL_TAX_PAYMENT, INPS_PAYMENT, RENT, ADVERTISING, OTHER_EXPENSE, ACCOUNTABLE, FIXED_ASSET_PURCHASE, BANK_COMMISSION, BANK_LOAN_REPAYMENT, FOUNDER_LOAN_REPAYMENT, EMPLOYEE_LOAN, INTEREST_PAYMENT, DIVIDEND_PAYMENT, FINE_PENALTY, INSURANCE_PAYMENT, UTILITY_PAYMENT, SUBSCRIPTION, CUSTOMS_DUTY, DEPOSIT, REFUND, ADVANCE_RETURN_SENT, INTERNAL_TRANSFER

Запрещённый пример: directionLabel="ВХОДЯЩИЙ ПЛАТЁЖ +2 200 000 сум" → ADVANCE_PAID. ADVANCE_PAID — расход (DEBIT). Правильно: ADVANCE_RECEIVED.

━━━ ОТКРЫТЫЕ ПОЗИЦИИ (что сейчас висит на счетах) ━━━
${ctx.openItemsText}

Как использовать открытые позиции:
• Видишь CREDIT от контрагента из "Авансы ПОЛУЧЕННЫЕ" → он платит ещё раз (ADVANCE_RECEIVED) или дублирует
• Видишь DEBIT контрагенту из "Авансы ВЫДАННЫЕ" → мы гасим долг (SUPPLIER_PAYMENT), а не выдаём новый аванс
• Видишь CREDIT от контрагента из "Авансы ВЫДАННЫЕ" → он возвращает наш аванс (SUPPLIER_REFUND)
• Видишь DEBIT контрагенту из "Авансы ПОЛУЧЕННЫЕ" → мы возвращаем аванс клиенту (ADVANCE_RETURN_SENT)
• Видишь DEBIT с суммой ≈ остатку по банковскому кредиту → вероятно BANK_LOAN_REPAYMENT или INTEREST_PAYMENT

━━━ ИСТОРИЯ КОНТРАГЕНТОВ (последние 3 месяца) ━━━
${ctx.counterpartyHistoryText}

Используй историю как сильную подсказку. Если контрагент всегда был ADVANCE_PAID — почти наверняка снова ADVANCE_PAID.

━━━ ПРАВИЛА ОРГАНИЗАЦИИ ━━━
${ctx.rulesText}

━━━ БЛИЖАЙШИЕ НАЛОГОВЫЕ ОБЯЗАТЕЛЬСТВА ━━━
${ctx.taxCalendarText}
Если видишь DEBIT на сумму близкую к налоговому обязательству и дата ≈ 20-е число:
  • PERSONAL_INCOME_TAX → TAX_PAYMENT (получатель Казначейство, описание содержит "НДФЛ" или "NDFL")
  • INPS → INPS_PAYMENT (получатель Народный банк или описание содержит "ИНПС"/"INPS")
  • SOCIAL_TAX → SOCIAL_TAX_PAYMENT (получатель Казначейство, описание содержит "соц" или "Социальный налог")
  • VAT/TURNOVER_TAX/PROFIT_TAX → TAX_PAYMENT (прочие налоги в бюджет)

━━━ ТРАНЗИТНЫЕ СЧЕТА УЗБЕКИСТАНА ━━━
Если isTransit=true — контрагент (Казначейство, НБУ, биржа) является транзитным посредником.
Реальный плательщик/получатель ТОЛЬКО в поле description. Ищи там ИНН или название.

━━━ КАТАЛОГ ТИПОВ ДОКУМЕНТОВ ━━━
${JSON.stringify(catalog, null, 2)}

В поле categoryCode всегда возвращай значение code из каталога выше.

━━━ ПРАВИЛА КЛАССИФИКАЦИИ ━━━
1.  Выплаты сотрудникам (зарплата, оклад, аванс по ЗП) → SALARY
2.  НДФЛ в бюджет (содержит "НДФЛ", "NDFL", получатель Казначейство) → TAX_PAYMENT
2a. ИНПС / накопительная пенсия (содержит "ИНПС", "INPS", получатель Народный банк) → INPS_PAYMENT
3.  Социальный налог → SOCIAL_TAX_PAYMENT
4.  Поступление от клиентов до выставления ЭСФ → ADVANCE_RECEIVED; после ЭСФ/акта → REVENUE_COLLECTION
5.  Поступление от маркетплейса (Payme, Click, Uzum, Ozon) → MARKETPLACE_INCOME
6.  Оплата поставщику по существующему долгу → SUPPLIER_PAYMENT; предоплата без акта → ADVANCE_PAID
7.  Комиссия банка, РКО → BANK_COMMISSION
8.  Покупка основного средства → FIXED_ASSET_PURCHASE; поступление от продажи ОС → FIXED_ASSET_SALE
9.  Займ от учредителя (CREDIT) → FOUNDER_LOAN; возврат займа учредителю (DEBIT) → FOUNDER_LOAN_REPAYMENT; взнос в уставный капитал → CAPITAL_CONTRIBUTION
10. Получение банковского кредита → BANK_LOAN_RECEIVED; погашение кредита → BANK_LOAN_REPAYMENT
11. Займ сотруднику → EMPLOYEE_LOAN; возврат займа сотрудником → EMPLOYEE_LOAN_REPAYMENT
12. Перевод DEBIT (деньги уходят на свой другой счёт) → INTERNAL_TRANSFER. Входящий CREDIT от своего счёта — не классифицируй как INTERNAL_TRANSFER, оставь на уточнение (низкий confidence)
13. Аренда → RENT; реклама/маркетинг → ADVERTISING; проценты по кредиту → INTEREST_PAYMENT
14. Дивиденды → DIVIDEND_PAYMENT; штрафы/пени → FINE_PENALTY; страховка → INSURANCE_PAYMENT
15. Коммунальные → UTILITY_PAYMENT; подписки/SaaS/домен → SUBSCRIPTION; таможня → CUSTOMS_DUTY
16. Гарантийный депозит → DEPOSIT; подотчётные суммы → ACCOUNTABLE
17. Поставщик возвращает НАШИ деньги (CREDIT) → SUPPLIER_REFUND
18. Мы возвращаем деньги КЛИЕНТУ (DEBIT, закрываем 6310) → ADVANCE_RETURN_SENT
19. Возврат/корректировка покупателю (уменьшает выручку) → REFUND (DEBIT)
20. При неуверенности — выбирай ближайшее, но снижай confidence < ${confidenceThreshold}

В поле reasoning коротко объясни ПОЧЕМУ выбрал эту категорию (1-2 предложения), ссылаясь на directionLabel, историю или открытые позиции.

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

  // ── JSON schema for AI response ─────────────────────────────────────────────
  const responseFormatSchema = {
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
                categoryCode:          { type: "string" as const },
                confidence:            { type: "integer" as const },
                extractedCounterparty: { type: "string" as const },
                extractedInn:          { type: "string" as const },
                vatApplicable:         { type: "boolean" as const },
                reasoning:             { type: "string" as const },
                suggestedRuleType:     { type: "string" as const },
                suggestedRuleValue:    { type: "string" as const },
              },
              required: ["transactionId", "categoryCode", "confidence", "extractedCounterparty", "extractedInn", "vatApplicable", "reasoning", "suggestedRuleType", "suggestedRuleValue"],
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

  // ── Process in chunks (each chunk gets the full context above) ───────────────
  let matched = 0;
  let needsClarification = 0;
  const processedTxIds = new Set<string>();

  const chunks: StagedTransaction[][] = [];
  for (let i = 0; i < transactions.length; i += AI.BATCH_SIZE) {
    chunks.push(transactions.slice(i, i + AI.BATCH_SIZE));
  }

  for (const chunk of chunks) {
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
        // @ts-ignore — gpt-5.x uses max_completion_tokens instead of max_tokens
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

      // Direction guard: reject physically impossible categorisations
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

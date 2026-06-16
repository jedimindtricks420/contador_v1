import { OpenAI } from "openai";
import prisma from "../prisma";
import { StagedTransaction } from "@prisma/client";
import Decimal from "decimal.js";
import { AI } from "../constants";
import { getActivityLabel } from "../activityCategories";
import { postDocument } from "../posting/postingEngine";

interface ClassificationResult {
  transactionId: string;
  categoryId: string;
  confidence: number;
  extractedCounterparty: string;
  extractedInn: string;
  vatApplicable: boolean;
}

export async function classifyBatchWithAI(orgId: string, transactions: StagedTransaction[]) {
  if (transactions.length === 0) return { matched: 0, needsClarification: 0 };

  // 1. Resolve OpenAI API key
  const subscription = await prisma.subscription.findUnique({
    where: { orgId }
  });
  const apiKey = subscription?.customApiKey || process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("Ключ OpenAI API не настроен в системе");
  }

  const openai = new OpenAI({ apiKey });

  // 2. Load context (DocumentType catalog, organization details)
  const [catalog, org] = await Promise.all([
    prisma.documentType.findMany({
      select: { id: true, code: true, name: true }
    }),
    prisma.organization.findUnique({
      where: { id: orgId }
    })
  ]);

  if (!org) {
    throw new Error("Организация не найдена");
  }

  const activityLabel = getActivityLabel(org.activityGroup, org.activityDescription, org.activityCustom);
  const confidenceThreshold = org.aiConfidenceThreshold ?? AI.CONFIDENCE_THRESHOLD;

  const orgContext = {
    name: org.name,
    taxRegime: org.taxRegime,
    isVatPayer: org.isVatPayer,
    activityDescription: activityLabel !== "Не указано" ? activityLabel : null
  };

  // Prepare input transactions
  const formattedTransactions = transactions.map(tx => ({
    id: tx.id,
    date: tx.date.toISOString().split("T")[0],
    amount: new Decimal(tx.amount.toString()).toNumber(),
    direction: tx.direction,
    description: tx.description,
    counterpartyHint: tx.counterpartyHint || "",
    counterpartyInn: tx.counterpartyInn || ""
  }));

  // Create prompt and JSON schema
  const systemPrompt = `Ты — эксперт по бухгалтерскому учету в Узбекистане (НСБУ №21).
Твоя задача — классифицировать банковские транзакции, распределив их по категориям из каталога типов документов (DocumentType).

ДАННЫЕ ОРГАНИЗАЦИИ:
- Название: ${orgContext.name}${orgContext.activityDescription ? `\n- Вид деятельности: ${orgContext.activityDescription}` : ""}
- Налоговый режим: ${orgContext.taxRegime === "VAT" ? "НДС + налог на прибыль" : "Налог с оборота (УСН)"}
- Является плательщиком НДС: ${orgContext.isVatPayer ? "Да" : "Нет"}

ДОСТУПНЫЕ КАТЕГОРИИ (КАТАЛОГ):
${JSON.stringify(catalog, null, 2)}

ПРАВИЛА КЛАССИФИКАЦИИ:
1. Выплаты сотрудникам (зарплата) -> кодируй как SALARY.
2. Уплата любых налогов в бюджет -> кодируй как TAX_PAYMENT.
3. Оплата поставщикам услуг (аренда, интернет, ПО) -> кодируй как SUPPLIER_PAYMENT (или RENT для аренды, ADVERTISING для рекламы).
4. Получение денег от клиентов за услуги/товары -> кодируй как REVENUE_VAT (если компания плательщик НДС) или REVENUE_NO_VAT.
5. Займы от учредителей -> FOUNDER_LOAN.
6. Внутренние переводы между своими счетами -> INTERNAL_TRANSFER.
7. Не уверен на 100% — выбирай наиболее близкую категорию, но снижай confidence (уверенность) ниже ${confidenceThreshold}.

Возвращай результат строго по схеме JSON.`;

  const userMessage = JSON.stringify({
    transactions: formattedTransactions,
    catalog,
    orgContext
  });

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
                transactionId: { type: "string" as const },
                categoryId: { type: "string" as const },
                confidence: { type: "integer" as const },
                extractedCounterparty: { type: "string" as const },
                extractedInn: { type: "string" as const },
                vatApplicable: { type: "boolean" as const }
              },
              required: ["transactionId", "categoryId", "confidence", "extractedCounterparty", "extractedInn", "vatApplicable"],
              additionalProperties: false
            }
          }
        },
        required: ["results"],
        additionalProperties: false
      },
      strict: true
    }
  };

  const response = await openai.chat.completions.create({
    model: AI.MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage }
    ],
    response_format: responseFormatSchema
  });

  const responseText = response.choices[0].message.content || "{}";
  const parsedData = JSON.parse(responseText);
  const results: ClassificationResult[] = parsedData.results || [];

  let matched = 0;
  let needsClarification = 0;

  for (const res of results) {
    const tx = transactions.find(t => t.id === res.transactionId);
    if (!tx) continue;

    const confidenceThreshold = org.aiConfidenceThreshold ?? AI.CONFIDENCE_THRESHOLD;

    const aiSuggestion = {
      categoryId: res.categoryId,
      confidence: res.confidence,
      extractedCounterparty: res.extractedCounterparty,
      extractedInn: res.extractedInn,
      vatApplicable: res.vatApplicable
    };

    if (res.confidence >= confidenceThreshold) {
      const doc = await prisma.document.create({
        data: {
          orgId,
          periodId: tx.periodId,
          typeId: res.categoryId,
          date: tx.date,
          status: "POSTED",
          sourceTransactionId: tx.id,
          payload: {
            amount: Number(tx.amount),
            description: tx.description,
            direction: tx.direction,
            counterpartyHint: res.extractedCounterparty || tx.counterpartyHint || null,
            counterpartyInn: res.extractedInn || tx.counterpartyInn || null,
            aiConfidence: res.confidence
          } as any
        }
      });

      try {
        await postDocument(doc.id, prisma, "system");
      } catch (postErr: any) {
        console.error(`AI classifier: postDocument failed for doc ${doc.id}:`, postErr.message);
        await prisma.document.update({ where: { id: doc.id }, data: { status: "VOIDED" } });
        await prisma.stagedTransaction.update({
          where: { id: tx.id },
          data: { status: "NEEDS_CLARIFICATION", aiSuggestion: aiSuggestion as any }
        });
        needsClarification++;
        continue;
      }

      await prisma.stagedTransaction.update({
        where: { id: tx.id },
        data: {
          status: "AUTO_MATCHED",
          documentId: doc.id,
          aiSuggestion: aiSuggestion as any
        }
      });
      matched++;
    } else {
      // Needs clarification
      await prisma.stagedTransaction.update({
        where: { id: tx.id },
        data: {
          status: "NEEDS_CLARIFICATION",
          aiSuggestion: aiSuggestion as any
        }
      });
      needsClarification++;
    }
  }

  return { matched, needsClarification };
}

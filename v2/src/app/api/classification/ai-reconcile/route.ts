import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/context";
import prisma from "@/lib/prisma";
import { OpenAI } from "openai";
import { AI } from "@/lib/constants";
import { getUserActivePro } from "@/lib/billing";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session.activeOrgId) {
      return NextResponse.json({ error: "Нет активной организации" }, { status: 400 });
    }

    const { isPro } = await getUserActivePro(session.userId);
    if (!isPro) {
      return NextResponse.json(
        { error: "ИИ-сверка доступна только на тарифе PRO" },
        { status: 403 }
      );
    }

    const orgId = session.activeOrgId;
    const { bankOnly, soliqOnly } = await req.json();

    if (!bankOnly || !soliqOnly || !Array.isArray(bankOnly) || !Array.isArray(soliqOnly)) {
      return NextResponse.json({ error: "Некорректный формат данных" }, { status: 400 });
    }

    if (bankOnly.length === 0 || soliqOnly.length === 0) {
      return NextResponse.json({ matches: [] });
    }

    if (bankOnly.length > 200 || soliqOnly.length > 200) {
      return NextResponse.json({ error: "Слишком много элементов для сверки (макс. 200)" }, { status: 400 });
    }

    // Validate that submitted bankOnly IDs belong to this org's open items
    const bankIds = bankOnly.map((b: any) => b.id).filter(Boolean);
    if (bankIds.length > 0) {
      const owned = await prisma.openItem.count({ where: { id: { in: bankIds }, orgId } });
      if (owned !== bankIds.length) {
        return NextResponse.json({ error: "Недопустимые данные запроса" }, { status: 400 });
      }
    }

    const azureEndpoint = process.env.AZURE_OPENAI_ENDPOINT;
    const azureApiKey = process.env.AZURE_OPENAI_API_KEY;

    if (!azureEndpoint || !azureApiKey) {
      return NextResponse.json({ error: "Azure AI Foundry: AZURE_OPENAI_ENDPOINT и AZURE_OPENAI_API_KEY не настроены" }, { status: 400 });
    }

    const openai = new OpenAI({
      apiKey: azureApiKey,
      baseURL: azureEndpoint,
    });

    const systemPrompt = `Ты — эксперт-бухгалтер. Твоя задача — найти пары между банковскими авансами и выставленными счетами-фактурами (ЭСФ).

КОНТЕКСТ:
- Банковские платежи часто идут через транзитные счета (Казначейство РУз, биржа, Узбекфинансы и т.п.).
- Поэтому ИНН и название контрагента в банке могут НЕ совпадать с реальным плательщиком в ЭСФ.
- Реальный клиент (ИНН или название) часто УКАЗАН В ТЕКСТЕ description банковского платежа.
- Название может быть сокращено или транслитерировано (AXOFT → АХОФТ, MCHJ → МЧЖ и т.п.).
- MARKETPLACE (CLICK, Payme, Uzum и др.): ЭСФ для маркетплейсов часто имеет ПУСТОЕ поле counterpartyName — сопоставляй только по ИНН. Сумма в банке будет меньше суммы ЭСФ на комиссию платформы (до 15% меньше — это нормально).

АЛГОРИТМ СОПОСТАВЛЕНИЯ:
1. Сравни суммы: amount в банке должно быть близко к amount в ЭСФ (±15% допустимо для маркетплейсов, ±5% в остальных случаях).
2. Ищи ИНН из ESF в поле description банка — это самый надёжный признак.
3. Если ИНН не найден — ищи название контрагента ESF в description банка (частичное совпадение, транслитерация).
4. Если и это не помогло — сравни названия counterpartyName банка и ESF на схожесть (сокращения, слова-синонимы).
5. Возвращай пару только если уверен хотя бы в 2 из 3 критериев (сумма + ИНН или название).

ДАННЫЕ БАНКА (АВАНСЫ):
${JSON.stringify(bankOnly, null, 2)}

ДАННЫЕ ЭСФ (SOLIQ):
${JSON.stringify(soliqOnly, null, 2)}

Верни результат строго в формате JSON по указанной схеме. Не выдумывай пары — лучше вернуть меньше, но надёжных.`;

    const responseFormatSchema = {
      type: "json_schema" as const,
      json_schema: {
        name: "reconciliation_response",
        schema: {
          type: "object" as const,
          properties: {
            matches: {
              type: "array" as const,
              items: {
                type: "object" as const,
                properties: {
                  bankId: { type: "string" as const },
                  soliqId: { type: "string" as const },
                  reason: { type: "string" as const }
                },
                required: ["bankId", "soliqId", "reason"],
                additionalProperties: false
              }
            }
          },
          required: ["matches"],
          additionalProperties: false
        },
        strict: true
      }
    };

    const response = await openai.chat.completions.create({
      model: AI.MODEL,
      messages: [{ role: "system", content: systemPrompt }],
      response_format: responseFormatSchema,
      max_completion_tokens: 2048,
    });

    const responseText = response.choices[0].message.content || "{}";
    const parsedData = JSON.parse(responseText);

    return NextResponse.json({ matches: parsedData.matches || [] });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }
    console.error("AI RECONCILE ERROR:", err);
    return NextResponse.json({ error: "Ошибка ИИ-сверки" }, { status: 500 });
  }
}

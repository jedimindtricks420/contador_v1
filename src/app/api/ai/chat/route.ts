import { OpenAI } from "openai";
import prisma from "@/lib/prisma";
import { getActiveOrganizationId, getUser } from "@/lib/context";
import { getJournalSystemPrompt } from "@/../ai/prompts";
import { NextResponse } from "next/server";
import { Decimal } from "decimal.js";

const COST_INPUT_PER_TOKEN  = 0.0000025;  // GPT-4o: $2.50 / 1M tokens
const COST_OUTPUT_PER_TOKEN = 0.0000100;  // GPT-4o: $10.00 / 1M tokens
const FREE_MONTHLY_LIMIT    = 10;

export async function POST(req: Request) {
  try {
    const organizationId = await getActiveOrganizationId();
    const user = await getUser();
    const { message, history } = await req.json();

    // ─────────────────────────────────────────────
    // AI GATEKEEPER: проверка подписки и лимитов
    // ─────────────────────────────────────────────
    const subscription = await prisma.subscription.findUnique({
      where: { organization_id: organizationId }
    });

    let apiKey: string;
    const plan = subscription?.plan || "FREE";

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const getUsageCount = async () => {
      return await prisma.aiUsage.count({
        where: {
          organization_id: organizationId,
          created_at: { gte: startOfMonth }
        }
      });
    };

    if (plan === "MYAPI") {
      // 1. MYAPI — Всегда использует кастомный ключ, лимитов нет
      if (!subscription?.custom_api_key) {
        return NextResponse.json({ error: "MYAPI_KEY_MISSING", message: "OpenAI API Key не найден в настройках" }, { status: 400 });
      }
      apiKey = subscription.custom_api_key;
    } else if (plan === "PRO") {
      // 2. PRO тариф — лимит 300 запросов
      const isExpired = subscription?.valid_until && subscription.valid_until < new Date();
      if (isExpired) {
        return NextResponse.json({ error: "PRO_EXPIRED", message: "Срок действия PRO подписки истек" }, { status: 403 });
      }

      const usageCount = await getUsageCount();
      if (usageCount >= 300) {
        return NextResponse.json({ error: "PRO_LIMIT_REACHED", message: "Месячный бюджетный лимит PRO (300 запросов) исчерпан" }, { status: 403 });
      }
      apiKey = process.env.OPENAI_API_KEY || "";
    } else {
      // 3. FREE тариф — лимит 10 запросов
      const usageCount = await getUsageCount();
      if (usageCount >= 10) {
        return NextResponse.json({ 
          error: "FREE_LIMIT_REACHED", 
          message: "Вы достигли лимита в 10 бесплатных сообщений в месяц. Перейдите на PRO или используйте свой ключ (MYAPI)." 
        }, { status: 403 });
      }
      apiKey = process.env.OPENAI_API_KEY || "";
    }

    if (!apiKey) {
      return NextResponse.json({ error: "OpenAI API key not configured" }, { status: 500 });
    }

    // ─────────────────────────────────────────────
    // КОНТЕКСТ И ВЫЗОВ OPENAI
    // ─────────────────────────────────────────────
    const openai = new OpenAI({ apiKey });

    const [accounts, settings] = await Promise.all([
      prisma.account.findMany({ where: { organization_id: organizationId, is_active: true } }),
      prisma.systemSettings.findUnique({ where: { organization_id: organizationId } })
    ]);

    const closedDate = settings?.closed_period_date || new Date("2000-01-01");

    const startTime = Date.now();
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: getJournalSystemPrompt(accounts, closedDate) },
        ...history,
        { role: "user", content: message }
      ],
      response_format: { type: "json_object" }
    });
    const durationMs = Date.now() - startTime;

    const aiResponseContent = response.choices[0].message.content || "{}";
    const usage = response.usage;

    // ─────────────────────────────────────────────
    // АУДИТ: сохранение истории и расходов
    // ─────────────────────────────────────────────
    await prisma.$transaction(async (tx) => {
      await tx.chatMessage.create({
        data: { organization_id: organizationId, user_id: user.id, role: "user", content: message }
      });

      await tx.chatMessage.create({
        data: {
          organization_id: organizationId,
          user_id: user.id,
          role: "assistant",
          content: aiResponseContent,
          tokens_used: usage?.total_tokens || 0
        }
      });

      if (usage) {
        const totalCost = new Decimal(
          usage.prompt_tokens * COST_INPUT_PER_TOKEN +
          usage.completion_tokens * COST_OUTPUT_PER_TOKEN
        );

        await tx.aiUsage.create({
          data: {
            organization_id: organizationId,
            user_id: user.id,
            feature: "JournalChat",
            tokens_input: usage.prompt_tokens,
            tokens_output: usage.completion_tokens,
            cost_usd: totalCost,
            duration_ms: durationMs
          }
        });
      }
    });

    return NextResponse.json(JSON.parse(aiResponseContent));
  } catch (error: any) {
    console.error("AI CHAT ERROR:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
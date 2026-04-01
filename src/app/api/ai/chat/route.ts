import { OpenAI } from "openai";
import prisma from "@/lib/prisma";
import { getActiveOrganizationId, getUser } from "@/lib/context";
import { getJournalSystemPrompt } from "@/../ai/prompts";
import { NextResponse } from "next/server";
import { Decimal } from "decimal.js";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Тарифы GPT-4o (на 1M токенов): $2.50 input, $10.00 output
const COST_INPUT_PER_TOKEN = 0.0000025;
const COST_OUTPUT_PER_TOKEN = 0.0000100;

export async function POST(req: Request) {
  try {
    const organizationId = await getActiveOrganizationId(); 
    const user = await getUser();
    const { message, history } = await req.json();

    // 1. Сбор контекста (Счета и Настройки)
    const [accounts, settings] = await Promise.all([
      prisma.account.findMany({ where: { organization_id: organizationId, is_active: true } }),
      prisma.systemSettings.findUnique({ where: { organization_id: organizationId } })
    ]);

    const closedDate = settings?.closed_period_date || new Date("2000-01-01");

    // 2. Вызов OpenAI
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: getJournalSystemPrompt(accounts, closedDate) },
        ...history,
        { role: "user", content: message }
      ],
      response_format: { type: "json_object" }
    });

    const aiResponseContent = response.choices[0].message.content || "{}";
    const usage = response.usage;

    // 3. Сохранение в БД (Транзакционно: История + Расход)
    await prisma.$transaction(async (tx) => {
      // Сохраняем запрос пользователя
      await tx.chatMessage.create({
        data: {
          organization_id: organizationId,
          user_id: user.id,
          role: "user",
          content: message,
        }
      });

      // Сохраняем ответ ИИ
      await tx.chatMessage.create({
        data: {
          organization_id: organizationId,
          user_id: user.id,
          role: "assistant",
          content: aiResponseContent,
          tokens_used: usage?.total_tokens || 0,
        }
      });

      // Записываем статистику и стоимость
      if (usage) {
        const costInput = usage.prompt_tokens * COST_INPUT_PER_TOKEN;
        const costOutput = usage.completion_tokens * COST_OUTPUT_PER_TOKEN;
        const totalCost = new Decimal(costInput + costOutput);

        await tx.aiUsage.create({
          data: {
            organization_id: organizationId,
            user_id: user.id,
            feature: "JournalChat",
            tokens_input: usage.prompt_tokens,
            tokens_output: usage.completion_tokens,
            cost_usd: totalCost,
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
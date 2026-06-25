// Test: Azure AI Foundry → gpt-5.4-mini
// Запуск: node test-azure-ai.mjs

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

// Читаем .env вручную
const __dir = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dir, ".env");
const envVars = {};
for (const line of readFileSync(envPath, "utf8").split("\n")) {
  const clean = line.trim();
  if (!clean || clean.startsWith("#")) continue;
  const idx = clean.indexOf("=");
  if (idx === -1) continue;
  const key = clean.slice(0, idx).trim();
  let val = clean.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
  envVars[key] = val;
}

const ENDPOINT = envVars.AZURE_OPENAI_ENDPOINT;
const API_KEY  = envVars.AZURE_OPENAI_API_KEY;
const MODEL    = envVars.OPENAI_MODEL || "gpt-5.4-mini";

console.log("─────────────────────────────────────────");
console.log("  Azure AI Foundry — Connection Test");
console.log("─────────────────────────────────────────");
console.log(`  Endpoint : ${ENDPOINT}`);
console.log(`  Model    : ${MODEL}`);
console.log(`  API Key  : ${API_KEY ? API_KEY.slice(0, 8) + "..." : "НЕТ КЛЮЧА!"}`);
console.log("─────────────────────────────────────────\n");

if (!ENDPOINT || !API_KEY) {
  console.error("❌ ОШИБКА: AZURE_OPENAI_ENDPOINT или AZURE_OPENAI_API_KEY не заданы в .env");
  process.exit(1);
}

// Тестовый запрос — бухгалтерская классификация (как в реальном коде)
const testPayload = {
  model: MODEL,
  messages: [
    {
      role: "system",
      content: "Ты эксперт-бухгалтер по НСБУ Узбекистана. Отвечай кратко на русском."
    },
    {
      role: "user",
      content: "Классифицируй транзакцию: списание 500 000 сум, описание 'Уплата НДС за июнь 2026'. Какой тип документа и счёт?"
    }
  ],
  max_tokens: 200
};

console.log("⏳ Отправляю тестовый запрос...\n");

try {
  const res = await fetch(`${ENDPOINT}/chat/completions?api-version=2025-01-01-preview`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": API_KEY
    },
    body: JSON.stringify(testPayload)
  });

  const data = await res.json();

  if (!res.ok) {
    console.error(`❌ HTTP ${res.status} — Ошибка API:`);
    console.error(JSON.stringify(data, null, 2));
    process.exit(1);
  }

  const answer = data.choices?.[0]?.message?.content;
  const usage  = data.usage;
  const modelUsed = data.model || MODEL;

  console.log("✅ УСПЕШНО! Модель отвечает.\n");
  console.log(`  Модель в ответе : ${modelUsed}`);
  console.log(`  Токены (запрос) : ${usage?.prompt_tokens}`);
  console.log(`  Токены (ответ)  : ${usage?.completion_tokens}`);
  console.log("\n─── Ответ модели ────────────────────────");
  console.log(answer);
  console.log("─────────────────────────────────────────\n");

} catch (err) {
  console.error("❌ Ошибка сети или запроса:");
  console.error(err.message);
  process.exit(1);
}

import prisma from "../prisma";
import { StagedTransaction, Rule } from "@prisma/client";
import { postDocument } from "../posting/postingEngine";

// Simple in-memory cache for organization rules (valid for 30 seconds)
interface CachedRules {
  rules: (Rule & { documentType: { id: string; code: string; name: string } })[];
  expiresAt: number;
}
const rulesCache = new Map<string, CachedRules>();
const CACHE_TTL_MS = 30000;

async function getRulesForOrg(orgId: string) {
  const now = Date.now();
  const cached = rulesCache.get(orgId);

  if (cached && cached.expiresAt > now) {
    return cached.rules;
  }

  const rules = await prisma.rule.findMany({
    where: { orgId },
    include: { documentType: { select: { id: true, code: true, name: true } } },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }]
  });

  rulesCache.set(orgId, {
    rules,
    expiresAt: now + CACHE_TTL_MS
  });

  return rules;
}

export function clearRulesCache(orgId: string) {
  rulesCache.delete(orgId);
}

function matchAmountRange(amount: number, rangeStr: string): boolean {
  try {
    const cleaned = rangeStr.replace(/\s/g, "");
    const parts = cleaned.split("-");
    if (parts.length === 2) {
      const min = parseFloat(parts[0]);
      const max = parseFloat(parts[1]);
      if (!isNaN(min) && !isNaN(max)) {
        return amount >= min && amount <= max;
      }
    }
  } catch (err) {
    console.error("Error parsing amount range rule:", rangeStr, err);
  }
  return false;
}

export async function applyRules(orgId: string, transactions: StagedTransaction[]) {
  const rules = await getRulesForOrg(orgId);
  let matchedCount = 0;

  for (const tx of transactions) {
    if (tx.status !== "IMPORTED" && tx.status !== "NEEDS_CLARIFICATION") continue;

    // Find the first rule that matches in priority order:
    // INN -> KEYWORD -> AMOUNT_RANGE -> TREASURY_ACCOUNT
    let matchingRule: typeof rules[0] | undefined;

    // Direction filter: skip rules that specify a direction not matching the transaction
    const directionMatch = (r: typeof rules[0]) =>
      !r.direction || r.direction === tx.direction;

    // 1. INN match
    if (tx.counterpartyInn) {
      matchingRule = rules.find(
        r => r.matchType === "INN" && r.matchValue === tx.counterpartyInn && directionMatch(r)
      );
    }

    // 2. Keyword match
    if (!matchingRule && tx.description) {
      matchingRule = rules.find(
        r =>
          r.matchType === "KEYWORD" &&
          tx.description.toLowerCase().includes(r.matchValue.toLowerCase()) &&
          directionMatch(r)
      );
    }

    // 3. Amount range match
    if (!matchingRule) {
      const amt = Number(tx.amount);
      matchingRule = rules.find(
        r => r.matchType === "AMOUNT_RANGE" && matchAmountRange(amt, r.matchValue) && directionMatch(r)
      );
    }

    // 4. Treasury account match (INN check or Description check)
    if (!matchingRule) {
      matchingRule = rules.find(
        r =>
          r.matchType === "TREASURY_ACCOUNT" &&
          ((tx.counterpartyInn && r.matchValue === tx.counterpartyInn) ||
            (tx.description && tx.description.toLowerCase().includes(r.matchValue.toLowerCase()))) &&
          directionMatch(r)
      );
    }

    // If matched, create Document + post + update StagedTransaction atomically
    if (matchingRule) {
      const categoryId = matchingRule.categoryId;
      try {
        await prisma.$transaction(async (txClient) => {
          const doc = await txClient.document.create({
            data: {
              orgId,
              periodId: tx.periodId,
              typeId: categoryId,
              date: tx.date,
              status: "POSTED",
              sourceTransactionId: tx.id,
              payload: {
                amount: Number(tx.amount),
                description: tx.description,
                direction: tx.direction,
                counterpartyHint: tx.counterpartyHint || null,
                counterpartyInn: tx.counterpartyInn || null,
                ruleMatched: matchingRule.id
              } as any
            }
          });

          await postDocument(doc.id, txClient, "system");

          await txClient.stagedTransaction.update({
            where: { id: tx.id },
            data: { status: "AUTO_MATCHED", documentId: doc.id }
          });
        });
        matchedCount++;
      } catch (err) {
        console.error(`RulesEngine: failed for tx ${tx.id}:`, err);
      }
    }
  }

  return matchedCount;
}

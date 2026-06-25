import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getActiveOrgId } from "@/lib/context";
import prisma from "@/lib/prisma";

import { parseSoliqExcel } from "@/lib/parsers/parserSoliq";
import { postDocument } from "@/lib/posting/postingEngine";
import Decimal from "decimal.js";

const MARKETPLACE_INNS = ["302179836", "302061230", "309532578", "205370258"];

function isMarketplace(inn?: string, name?: string): boolean {
  if (inn && MARKETPLACE_INNS.includes(inn)) return true;
  const n = (name || "").toLowerCase();
  return (
    n.includes("click") ||
    n.includes("payme") ||
    n.includes("uzum") ||
    n.includes("paynet") ||
    n.includes("inspired")
  );
}

// Normalise an organisation name for fuzzy comparison.
// Strips legal form suffixes (MCHJ, OAJ, ХК, МЧЖ, XK, LLC, etc.) and common noise words.
function normalizeOrgName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(mchj|oaj|хк|мчж|xk|llc|ojsc|jsc|zao|ooo|ip|sp|ип|пк|ак)\b/gi, "")
    .replace(/["\'.,()\-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Bigram similarity (Sørensen–Dice coefficient) — fast and language-agnostic.
function nameSimilarity(a: string, b: string): number {
  const na = normalizeOrgName(a);
  const nb = normalizeOrgName(b);
  if (na === nb) return 1;
  if (na.length < 2 || nb.length < 2) return 0;

  const bigrams = (s: string) => {
    const set: Record<string, number> = {};
    for (let i = 0; i < s.length - 1; i++) {
      const bg = s.slice(i, i + 2);
      set[bg] = (set[bg] || 0) + 1;
    }
    return set;
  };

  const ba = bigrams(na);
  const bb = bigrams(nb);
  let intersection = 0;
  for (const bg of Object.keys(ba)) {
    if (bb[bg]) intersection += Math.min(ba[bg], bb[bg]);
  }
  return (2 * intersection) / (Object.keys(ba).length + Object.keys(bb).length - 1 || 1);
}

const FUZZY_THRESHOLD = 0.5; // ≥ 50% bigram similarity → treat as same counterparty

export async function POST(req: NextRequest) {
  try {

    const orgId = await getActiveOrgId();
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const periodId = formData.get("periodId") as string | null;

    if (!file || !periodId) {
      return NextResponse.json({ error: "file и periodId обязательны" }, { status: 400 });
    }

    const period = await prisma.period.findFirst({
      where: { id: periodId, orgId },
    });
    if (!period) {
      return NextResponse.json({ error: "Отчётный период не найден" }, { status: 404 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Parse Soliq Excel
    const parsed = parseSoliqExcel(buffer);

    if (parsed.esfItems.length === 0 && parsed.taxSummary.vat === 0 && parsed.taxSummary.turnoverTax === 0) {
      return NextResponse.json({ error: "Не удалось распознать данные в файле" }, { status: 422 });
    }

    // Fetch all currently OPEN items for the org
    const openItems = await prisma.openItem.findMany({
      where: { orgId, status: "OPEN" },
      include: { counterparty: true, account: true, openingDocument: true }
    });

    let matched = 0;
    let unmatched = 0;
    const matchesList: any[] = [];
    const soliqOnlyList: any[] = [];

    // We will augment the parsed items with match information so the frontend can pass it to /complete
    const processedEsfItems = [];

    // ── Pass 1: exact INN match ─────────────────────────────────────────────
    // We use a mutable copy of openItems so matched items are not reused.
    const remainingOpenItems = [...openItems];

    const unmatchedEsfItems: typeof parsed.esfItems = [];

    for (const esf of parsed.esfItems) {
      const grossAmount = esf.amount + esf.vatAmount;
      const esfInn = esf.inn;
      const isMarket = isMarketplace(esf.inn, esf.counterpartyName);

      const matchIndex = remainingOpenItems.findIndex(item => {
        const itemInn = item.counterparty?.inn;
        if (itemInn !== esfInn) return false;

        const itemAmt = new Decimal(item.amount.toString()).toNumber();

        // Marketplace: amount tolerance up to 15% (commission case)
        if (esf.direction === "REVENUE" && isMarket && item.account.code === "6310") {
          return itemAmt <= grossAmount && (grossAmount - itemAmt) < grossAmount * 0.15;
        }

        return Math.abs(itemAmt - grossAmount) < 1.01 || Math.abs(itemAmt - esf.amount) < 1.01;
      });

      if (matchIndex !== -1) {
        const matchedItem = remainingOpenItems[matchIndex];
        remainingOpenItems.splice(matchIndex, 1);

        matched++;
        matchesList.push({ counterpartyName: esf.counterpartyName, amount: grossAmount });
        processedEsfItems.push({
          ...esf,
          matchStatus: "MATCHED",
          matchedOpenItemId: matchedItem.id,
          matchedAccountCode: matchedItem.account.code,
          matchedAmount: new Decimal(matchedItem.amount.toString()).toNumber()
        });
      } else {
        unmatchedEsfItems.push(esf);
        processedEsfItems.push({ ...esf, matchStatus: "UNMATCHED" });
      }
    }

    // ── Pass 2: fuzzy name match for unmatched ESF items ───────────────────
    // Re-scan unmatchedEsfItems against remainingOpenItems using name similarity.
    // Only applies when INN is absent in the bank record.
    for (const esf of unmatchedEsfItems) {
      const grossAmount = esf.amount + esf.vatAmount;

      const matchIndex = remainingOpenItems.findIndex(item => {
        // Skip if counterparty has an INN that differs from ESF (would have been caught in pass 1)
        if (item.counterparty?.inn && item.counterparty.inn !== esf.inn) return false;

        const itemAmt = new Decimal(item.amount.toString()).toNumber();
        const amountClose =
          Math.abs(itemAmt - grossAmount) < 1.01 ||
          Math.abs(itemAmt - esf.amount) < 1.01;
        if (!amountClose) return false;

        const bankName = item.counterparty?.name || "";
        return nameSimilarity(bankName, esf.counterpartyName) >= FUZZY_THRESHOLD;
      });

      if (matchIndex !== -1) {
        const matchedItem = remainingOpenItems[matchIndex];
        remainingOpenItems.splice(matchIndex, 1);

        matched++;
        unmatched = Math.max(0, unmatched - 1); // undo earlier unmatched count
        matchesList.push({ counterpartyName: esf.counterpartyName, amount: grossAmount });

        // Update the processedEsfItem that was originally marked UNMATCHED
        const idx = processedEsfItems.findIndex(
          p => p.inn === esf.inn && p.counterpartyName === esf.counterpartyName && p.matchStatus === "UNMATCHED"
        );
        if (idx !== -1) {
          processedEsfItems[idx] = {
            ...esf,
            matchStatus: "MATCHED",
            matchedOpenItemId: matchedItem.id,
            matchedAccountCode: matchedItem.account.code,
            matchedAmount: new Decimal(matchedItem.amount.toString()).toNumber(),
            fuzzyMatch: true
          };
          // remove from soliqOnlyList (not yet added there — it will be added below)
        }
      } else {
        unmatched++;
        soliqOnlyList.push({
          id: randomUUID(),
          counterpartyName: esf.counterpartyName,
          inn: esf.inn,
          amount: grossAmount,
          netAmount: esf.amount,
          vatAmount: esf.vatAmount
        });
      }
    }

    // bankOnly: remaining open items that had no matching ESF.
    // Include inn so the AI reconcile prompt can use it for smarter matching.
    const bankOnlyList = remainingOpenItems.map(item => ({
      id: item.id,
      counterpartyName: item.counterparty?.name || "Неизвестный контрагент",
      inn: item.counterparty?.inn || null,
      amount: new Decimal(item.amount.toString()).toNumber(),
      description: (item.openingDocument?.payload as any)?.description || "",
      accountCode: item.account.code
    }));

    return NextResponse.json({
      matched,
      unmatched,
      taxSummary: parsed.taxSummary,
      matches: matchesList,
      bankOnly: bankOnlyList,
      soliqOnly: soliqOnlyList,
      // Pass the fully processed payload to the frontend to submit on save
      parsedPayload: {
        taxSummary: parsed.taxSummary,
        expenses: parsed.expenses,
        revenues: parsed.revenues,
        esfItems: processedEsfItems
      }
    });
  } catch (err: any) {
    console.error("SOLIQ IMPORT ERROR:", err);
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}

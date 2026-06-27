import { NextRequest, NextResponse } from "next/server";
import { getActiveOrgId } from "@/lib/context";
import prisma from "@/lib/prisma";
import { TRANSIT_INNS } from "@/lib/constants";

export async function GET(req: NextRequest) {
  try {
    const orgId = await getActiveOrgId();
    const url = new URL(req.url);
    const periodId = url.searchParams.get("periodId");

    if (!periodId) {
      return NextResponse.json({ error: "periodId обязателен" }, { status: 400 });
    }

    const transactions = await prisma.stagedTransaction.findMany({
      where: {
        orgId,
        periodId,
        // Include IMPORTED (AI not run yet) and NEEDS_CLARIFICATION (AI low confidence).
        // AUTO_MATCHED/CONFIRMED/SKIPPED are already handled — exclude them.
        status: { in: ["NEEDS_CLARIFICATION", "IMPORTED"] }
      },
      orderBy: { date: "asc" }
    });

    // Grouping logic in memory
    const groupsMap = new Map<string, any>();

    for (const tx of transactions) {
      // For transit INNs (Казначейство, НБУ, etc.) the INN is meaningless for grouping —
      // all unrelated payments share the same INN. Use description prefix instead.
      const isTransit = tx.counterpartyInn ? TRANSIT_INNS.has(tx.counterpartyInn) : false;
      const groupKey = (tx.counterpartyInn && !isTransit)
        ? `inn:${tx.counterpartyInn}`
        : (tx.counterpartyHint ? `hint:${tx.counterpartyHint}` : `desc:${tx.description.substring(0, 60)}`);

      if (!groupsMap.has(groupKey)) {
        groupsMap.set(groupKey, {
          groupId: groupKey,
          counterpartyHint: tx.counterpartyHint || "Неизвестный контрагент",
          counterpartyInn: tx.counterpartyInn || null,
          transactions: [],
          aiSuggestion: tx.aiSuggestion || null
        });
      }

      const grp = groupsMap.get(groupKey);
      if (tx.status === "IMPORTED") grp.hasImported = true;
      grp.transactions.push({
        id: tx.id,
        date: tx.date.toISOString().split("T")[0],
        amount: Number(tx.amount),
        direction: tx.direction,
        description: tx.description
      });
    }

    return NextResponse.json(Array.from(groupsMap.values()));
  } catch (err: any) {
    console.error("GET CLARIFICATION QUEUE ERROR:", err);
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}

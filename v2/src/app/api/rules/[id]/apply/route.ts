import { NextRequest, NextResponse } from "next/server";
import { getActiveOrgId } from "@/lib/context";
import prisma from "@/lib/prisma";
import { postDocument } from "@/lib/posting/postingEngine";
import { clearRulesCache } from "@/lib/classification/rulesEngine";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const orgId = await getActiveOrgId();
    const { id: ruleId } = await params;
    const { transactionIds } = await req.json() as { transactionIds: string[] };

    if (!Array.isArray(transactionIds) || transactionIds.length === 0) {
      return NextResponse.json({ error: "transactionIds обязателен" }, { status: 400 });
    }

    const rule = await prisma.rule.findFirst({
      where: { id: ruleId, orgId },
    });

    if (!rule) {
      return NextResponse.json({ error: "Правило не найдено" }, { status: 404 });
    }

    const transactions = await prisma.stagedTransaction.findMany({
      where: {
        id: { in: transactionIds },
        orgId,
        status: { in: ["IMPORTED", "NEEDS_CLARIFICATION"] },
      },
    });

    let applied = 0;
    let failed = 0;

    for (const tx of transactions) {
      let doc: { id: string } | null = null;
      try {
        doc = await prisma.document.create({
          data: {
            orgId,
            periodId: tx.periodId,
            typeId: rule.categoryId,
            date: tx.date,
            status: "POSTED",
            sourceTransactionId: tx.id,
            payload: {
              amount: Number(tx.amount),
              description: tx.description,
              direction: tx.direction,
              counterpartyHint: tx.counterpartyHint || null,
              counterpartyInn: tx.counterpartyInn || null,
              ruleMatched: rule.id,
            } as any,
          },
        });

        await postDocument(doc.id, prisma, "system");

        await prisma.stagedTransaction.update({
          where: { id: tx.id },
          data: { status: "AUTO_MATCHED", documentId: doc.id },
        });

        applied++;
      } catch (err) {
        console.error(`rules/apply: failed for tx ${tx.id}:`, err);
        if (doc) {
          await prisma.document.update({ where: { id: doc.id }, data: { status: "VOIDED" } }).catch(() => {});
        }
        failed++;
      }
    }

    clearRulesCache(orgId);
    return NextResponse.json({ applied, failed });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getActiveOrgId } from "@/lib/context";
import prisma from "@/lib/prisma";
import Decimal from "decimal.js";

// Statuses that still need a category assigned.
const UNCLASSIFIED_STATUSES = ["IMPORTED", "NEEDS_CLARIFICATION"];

/**
 * Lists other bank transactions from the same counterparty (matched by INN,
 * falling back to counterpartyHint) so the UI can offer bulk clarification
 * right after the user categorizes one of them. Unclassified transactions are
 * returned first (most recent first), classified ones after.
 */
export async function GET(req: NextRequest) {
  try {
    const orgId = await getActiveOrgId();
    const { searchParams } = new URL(req.url);
    const inn = searchParams.get("inn");
    const hint = searchParams.get("hint");
    const direction = searchParams.get("direction");
    const excludeId = searchParams.get("excludeId");

    if (!inn && !hint) {
      return NextResponse.json({ transactions: [] });
    }

    const candidates = await prisma.stagedTransaction.findMany({
      where: {
        orgId,
        ...(excludeId ? { id: { not: excludeId } } : {}),
        ...(direction ? { direction: direction as "DEBIT" | "CREDIT" } : {}),
        ...(inn ? { counterpartyInn: inn } : { counterpartyHint: { equals: hint as string, mode: "insensitive" } }),
      },
      include: { document: { include: { type: { select: { id: true, name: true } } } } },
      orderBy: { date: "desc" },
      take: 200,
    });

    const rank = (status: string) => {
      if (UNCLASSIFIED_STATUSES.includes(status)) return 0;
      if (status === "SKIPPED") return 2;
      return 1; // AUTO_MATCHED, CONFIRMED, POSTED
    };

    const sorted = [...candidates].sort((a, b) => {
      const r = rank(a.status) - rank(b.status);
      if (r !== 0) return r;
      return b.date.getTime() - a.date.getTime();
    });

    const transactions = sorted.slice(0, 100).map((tx) => ({
      id: tx.id,
      date: tx.date.toISOString().split("T")[0],
      amount: new Decimal(tx.amount.toString()).toNumber(),
      direction: tx.direction,
      description: tx.description,
      counterpartyHint: tx.counterpartyHint,
      counterpartyInn: tx.counterpartyInn,
      status: tx.status,
      categoryId: tx.document?.type?.id ?? null,
      categoryName: tx.document?.type?.name ?? null,
      selectable: UNCLASSIFIED_STATUSES.includes(tx.status),
    }));

    return NextResponse.json({ transactions });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED" || err.message === "NO_ACTIVE_ORG") {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }
    return NextResponse.json({ error: err.message || "Внутренняя ошибка сервера" }, { status: 500 });
  }
}

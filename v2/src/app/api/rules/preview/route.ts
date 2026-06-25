import { NextRequest, NextResponse } from "next/server";
import { getActiveOrgId } from "@/lib/context";
import prisma from "@/lib/prisma";
import Decimal from "decimal.js";

export async function GET(req: NextRequest) {
  try {
    const orgId = await getActiveOrgId();
    const { searchParams } = new URL(req.url);
    const matchType = searchParams.get("matchType");
    const matchValue = searchParams.get("matchValue");
    const direction = searchParams.get("direction") || null;

    if (!matchType || !matchValue) {
      return NextResponse.json({ error: "matchType и matchValue обязательны" }, { status: 400 });
    }

    if (matchType !== "INN" && matchType !== "KEYWORD") {
      return NextResponse.json({ transactions: [] });
    }

    const candidates = await prisma.stagedTransaction.findMany({
      where: {
        orgId,
        status: { in: ["IMPORTED", "NEEDS_CLARIFICATION"] },
        ...(direction ? { direction: direction as "DEBIT" | "CREDIT" } : {}),
      },
      orderBy: { date: "desc" },
      take: 200,
    });

    const lower = matchValue.toLowerCase();
    const matched = candidates
      .filter(tx => {
        if (matchType === "INN") return tx.counterpartyInn === matchValue;
        if (matchType === "KEYWORD") return tx.description.toLowerCase().includes(lower);
        return false;
      })
      .slice(0, 50)
      .map(tx => ({
        id: tx.id,
        date: tx.date.toISOString().split("T")[0],
        amount: new Decimal(tx.amount.toString()).toNumber(),
        direction: tx.direction,
        description: tx.description,
        counterpartyHint: tx.counterpartyHint,
        counterpartyInn: tx.counterpartyInn,
        status: tx.status,
      }));

    return NextResponse.json({ transactions: matched });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

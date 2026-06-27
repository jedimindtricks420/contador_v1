import { NextRequest, NextResponse } from "next/server";
import { getActiveOrgId } from "@/lib/context";
import prisma from "@/lib/prisma";
import { applyRules } from "@/lib/classification/rulesEngine";

export async function POST(req: NextRequest) {
  try {
    const orgId = await getActiveOrgId();
    const { periodId } = await req.json();

    if (!periodId) {
      return NextResponse.json({ error: "periodId обязателен" }, { status: 400 });
    }

    const txs = await prisma.stagedTransaction.findMany({
      where: {
        orgId,
        periodId,
        status: { in: ["IMPORTED", "NEEDS_CLARIFICATION"] }
      }
    });

    const matched = await applyRules(orgId, txs);

    const remaining = await prisma.stagedTransaction.count({
      where: {
        orgId,
        periodId,
        status: { in: ["IMPORTED", "NEEDS_CLARIFICATION"] }
      }
    });

    return NextResponse.json({ matched, remaining });
  } catch (err: any) {
    console.error("RUN RULES ERROR:", err);
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}

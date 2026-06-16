import { NextRequest, NextResponse } from "next/server";
import { getActiveOrgId } from "@/lib/context";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const orgId = await getActiveOrgId();
    const { id } = await params;

    const account = await prisma.bankAccount.findFirst({ where: { id, orgId } });
    if (!account) return NextResponse.json({ error: "Счёт не найден" }, { status: 404 });

    const transactionCount = await prisma.stagedTransaction.count({
      where: { bankAccountId: id, orgId }
    });

    const periodRows = await prisma.stagedTransaction.findMany({
      where: { bankAccountId: id, orgId },
      select: { periodId: true },
      distinct: ["periodId"]
    });

    return NextResponse.json({
      transactionCount,
      periodCount: periodRows.length,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

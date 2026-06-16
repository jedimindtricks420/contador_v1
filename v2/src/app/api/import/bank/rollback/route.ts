import { NextRequest, NextResponse } from "next/server";
import { getActiveOrgId } from "@/lib/context";
import prisma from "@/lib/prisma";

export async function DELETE(req: NextRequest) {
  try {
    const orgId = await getActiveOrgId();
    const { batchId } = await req.json();

    if (!batchId) return NextResponse.json({ error: "batchId обязателен" }, { status: 400 });

    const transactions = await prisma.stagedTransaction.findMany({
      where: { importBatchId: batchId, orgId },
      select: { id: true, status: true, amount: true, direction: true, bankAccountId: true }
    });

    if (transactions.length === 0) {
      return NextResponse.json({ error: "Транзакции не найдены или уже удалены" }, { status: 404 });
    }

    // Block rollback if any transaction is already processed
    const processed = transactions.filter(t => t.status !== "IMPORTED");
    if (processed.length > 0) {
      return NextResponse.json({
        error: `Нельзя откатить: ${processed.length} транзакций уже обработаны (классифицированы или проведены)`
      }, { status: 409 });
    }

    // Recalculate balance delta to reverse it
    const bankAccountId = transactions[0].bankAccountId;
    let netDelta = 0;
    for (const tx of transactions) {
      netDelta += tx.direction === "CREDIT" ? Number(tx.amount) : -Number(tx.amount);
    }

    await prisma.stagedTransaction.deleteMany({ where: { importBatchId: batchId, orgId } });

    // Reverse the balance update
    const current = await prisma.bankAccount.findUnique({
      where: { id: bankAccountId },
      select: { lastBalance: true }
    });
    await prisma.bankAccount.update({
      where: { id: bankAccountId },
      data: { lastBalance: Number(current?.lastBalance ?? 0) - netDelta }
    });

    return NextResponse.json({ deleted: transactions.length });
  } catch (err: any) {
    console.error("ROLLBACK IMPORT ERROR:", err);
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}

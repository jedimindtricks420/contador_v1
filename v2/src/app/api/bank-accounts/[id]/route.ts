import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getActiveOrgId } from "@/lib/context";
import Decimal from "decimal.js";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const orgId = await getActiveOrgId();
    const { name, bankName, accountNumber, lastBalance, currency } = await req.json();

    const account = await prisma.bankAccount.findFirst({
      where: { id, orgId }
    });

    if (!account) {
      return NextResponse.json({ error: "Счёт не найден" }, { status: 404 });
    }

    const updated = await prisma.bankAccount.update({
      where: { id },
      data: {
        name: name !== undefined ? name : account.name,
        bankName: bankName !== undefined ? bankName : account.bankName,
        accountNumber: accountNumber !== undefined ? accountNumber : account.accountNumber,
        lastBalance: lastBalance !== undefined ? new Decimal(lastBalance) : account.lastBalance,
        currency: currency !== undefined ? currency : account.currency
      }
    });

    return NextResponse.json(updated);
  } catch (err: any) {
    console.error("PUT BANK ACCOUNT ERROR:", err);
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const orgId = await getActiveOrgId();

    const account = await prisma.bankAccount.findFirst({
      where: { id, orgId },
      include: { _count: { select: { stagedTransactions: true } } }
    });

    if (!account) {
      return NextResponse.json({ error: "Счёт не найден" }, { status: 404 });
    }

    if (account._count.stagedTransactions > 0) {
      return NextResponse.json(
        { error: `Нельзя удалить счёт: к нему привязано ${account._count.stagedTransactions} транзакций. Сначала откатите импорт.` },
        { status: 409 }
      );
    }

    await prisma.bankAccount.delete({
      where: { id }
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("DELETE BANK ACCOUNT ERROR:", err);
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}

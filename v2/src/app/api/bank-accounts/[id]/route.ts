import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getActiveMembership } from "@/lib/context";
import Decimal from "decimal.js";
import { updateBankAccountSchema } from "@/lib/bankAccountInput";
import { normalizeBankAccountNumber } from "@/lib/bankStatementValidation";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const membership = await getActiveMembership();
    if (!["OWNER", "ADMIN"].includes(membership.role)) throw new Error("FORBIDDEN");
    const orgId = membership.orgId;
    const input = updateBankAccountSchema.safeParse(await req.json().catch(() => null));
    if (!input.success) return NextResponse.json({ error: "Некорректные реквизиты счёта", details: input.error.issues }, { status: 400 });
    const { name, bankName, accountNumber, lastBalance, currency } = input.data;

    return await prisma.$transaction(async database => {
      await database.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`bank-account:${orgId}`}))::text`;
      await database.$queryRaw`SELECT "id" FROM "BankAccount" WHERE "id" = ${id} AND "orgId" = ${orgId} FOR NO KEY UPDATE`;
      const account = await database.bankAccount.findFirst({
        where: { id, orgId },
        include: { _count: { select: { stagedTransactions: true } } },
      });

      if (!account) return NextResponse.json({ error: "Счёт не найден" }, { status: 404 });
      if (accountNumber !== undefined) {
        const others = await database.bankAccount.findMany({ where: { orgId, id: { not: id } }, select: { accountNumber: true } });
        if (others.some(other => normalizeBankAccountNumber(other.accountNumber) === accountNumber)) {
          return NextResponse.json({ error: "Номер счёта уже существует в организации", code: "BANK_ACCOUNT_DUPLICATE" }, { status: 409 });
        }
      }
      const imported = await database.auditLog.findFirst({ where: {
        orgId, entityType: "BankAccount", entityId: id,
        action: { in: ["IMPORT_BANK", "ROLLBACK_IMPORT_BANK"] },
      }, select: { id: true } });
      const hasHistory = account.lastSyncedAt !== null || account._count.stagedTransactions > 0 || imported !== null;
      const changesFinancialIdentity =
        (accountNumber !== undefined && accountNumber !== normalizeBankAccountNumber(account.accountNumber)) ||
        (currency !== undefined && currency !== account.currency) ||
        (lastBalance !== undefined && !new Decimal(lastBalance).eq(account.lastBalance.toString()));
      if (hasHistory && changesFinancialIdentity) {
        return NextResponse.json({
          error: "Нельзя менять номер, валюту или остаток счёта с историей импорта. Требуется сверка и отдельная корректировка",
          code: "BANK_ACCOUNT_IN_USE",
        }, { status: 409 });
      }

      const data = {
        name: name !== undefined ? name : account.name,
        bankName: bankName !== undefined ? bankName : account.bankName,
        accountNumber: accountNumber !== undefined ? accountNumber : account.accountNumber,
        lastBalance: lastBalance !== undefined ? new Decimal(lastBalance) : account.lastBalance,
        currency: currency !== undefined ? currency : account.currency
      };
      const updated = await database.bankAccount.update({ where: { id, orgId }, data });
      await database.auditLog.create({ data: {
        orgId, userId: membership.userId, action: "UPDATE_BANK_ACCOUNT", entityType: "BankAccount", entityId: id,
        oldValue: { name: account.name, bankName: account.bankName, accountNumber: account.accountNumber,
          currency: account.currency, lastBalance: account.lastBalance.toFixed(2), lastSyncedAt: account.lastSyncedAt?.toISOString() ?? null },
        newValue: { ...data, lastBalance: data.lastBalance.toFixed(2), lastSyncedAt: account.lastSyncedAt?.toISOString() ?? null },
      } });

      return NextResponse.json(updated);
    }, { maxWait: 5000, timeout: 10000 });
  } catch (err: any) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002" && err.meta?.modelName === "BankAccount") {
      return NextResponse.json({ error: "Номер счёта уже существует в организации", code: "BANK_ACCOUNT_DUPLICATE" }, { status: 409 });
    }
    console.error("PUT BANK ACCOUNT ERROR:", err);
    return NextResponse.json({ error: err.message || "Internal error" }, { status: ["FORBIDDEN", "NO_ACTIVE_ORG"].includes(err.message) ? 403 : 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const membership = await getActiveMembership();
    if (!["OWNER", "ADMIN"].includes(membership.role)) throw new Error("FORBIDDEN");
    const orgId = membership.orgId;
    return await prisma.$transaction(async database => {
      await database.$queryRaw`SELECT "id" FROM "BankAccount" WHERE "id" = ${id} AND "orgId" = ${orgId} FOR UPDATE`;
      const account = await database.bankAccount.findFirst({
        where: { id, orgId }, include: { _count: { select: { stagedTransactions: true } } },
      });
      if (!account) return NextResponse.json({ error: "Счёт не найден" }, { status: 404 });
      const imported = await database.auditLog.findFirst({ where: {
        orgId, entityType: "BankAccount", entityId: id,
        action: { in: ["IMPORT_BANK", "ROLLBACK_IMPORT_BANK"] },
      }, select: { id: true } });
      if (account._count.stagedTransactions > 0 || account.lastSyncedAt !== null || !account.lastBalance.isZero() || imported !== null) {
        return NextResponse.json({ error: "Нельзя удалить счёт с остатком, операциями или историей импорта", code: "BANK_ACCOUNT_IN_USE" }, { status: 409 });
      }
      await database.bankAccount.delete({ where: { id, orgId } });
      await database.auditLog.create({ data: {
        orgId, userId: membership.userId, action: "DELETE_BANK_ACCOUNT", entityType: "BankAccount", entityId: id,
        oldValue: { name: account.name, bankName: account.bankName, accountNumber: account.accountNumber,
          currency: account.currency, lastBalance: account.lastBalance.toFixed(2), lastSyncedAt: null },
      } });
      return NextResponse.json({ success: true });
    }, { maxWait: 5000, timeout: 10000 });
  } catch (err: any) {
    console.error("DELETE BANK ACCOUNT ERROR:", err);
    return NextResponse.json({ error: err.message || "Internal error" }, { status: ["FORBIDDEN", "NO_ACTIVE_ORG"].includes(err.message) ? 403 : 500 });
  }
}

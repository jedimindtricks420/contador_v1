import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getActiveOrgId, getActiveMembership } from "@/lib/context";
import { createBankAccountSchema } from "@/lib/bankAccountInput";
import { normalizeBankAccountNumber } from "@/lib/bankStatementValidation";

export async function GET() {
  try {

    const orgId = await getActiveOrgId();
    const accounts = await prisma.bankAccount.findMany({
      where: { orgId },
      orderBy: { name: "asc" }
    });
    return NextResponse.json(accounts);
  } catch (err: any) {
    console.error("GET BANK ACCOUNTS ERROR:", err);
    if (err.message === "UNAUTHORIZED" || err.message === "NO_ACTIVE_ORG") {
      return NextResponse.json({ error: err.message || "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const membership = await getActiveMembership();
    if (!["OWNER", "ADMIN"].includes(membership.role)) throw new Error("FORBIDDEN");
    const orgId = membership.orgId;
    const input = createBankAccountSchema.safeParse(await req.json().catch(() => null));
    if (!input.success) return NextResponse.json({ error: "Некорректные реквизиты счёта", details: input.error.issues }, { status: 400 });
    return await prisma.$transaction(async database => {
      await database.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`bank-account:${orgId}`}))::text`;
      const existing = await database.bankAccount.findMany({ where: { orgId }, select: { accountNumber: true } });
      if (existing.some(account => normalizeBankAccountNumber(account.accountNumber) === input.data.accountNumber)) {
        return NextResponse.json({ error: "Номер счёта уже существует в организации", code: "BANK_ACCOUNT_DUPLICATE" }, { status: 409 });
      }
      const account = await database.bankAccount.create({ data: { orgId, ...input.data } });
      await database.auditLog.create({ data: {
        orgId, userId: membership.userId, action: "CREATE_BANK_ACCOUNT", entityType: "BankAccount", entityId: account.id,
        newValue: { ...input.data, lastSyncedAt: null },
      } });
      return NextResponse.json(account, { status: 201 });
    }, { maxWait: 5000, timeout: 10000 });
  } catch (err: any) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002" && err.meta?.modelName === "BankAccount") {
      return NextResponse.json({ error: "Номер счёта уже существует в организации", code: "BANK_ACCOUNT_DUPLICATE" }, { status: 409 });
    }
    console.error("POST BANK ACCOUNT ERROR:", err);
    return NextResponse.json({ error: err.message || "Internal error" }, { status: ["FORBIDDEN", "NO_ACTIVE_ORG"].includes(err.message) ? 403 : 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getActiveMembership } from "@/lib/context";
import prisma from "@/lib/prisma";
import { assertAccountingWriteRole } from "@/lib/posting/documentPolicy";
import { isOpeningBalanceAccount, openingBalanceSchema, openingBalanceTotals } from "@/lib/openingBalanceInput";

function failure(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message === "UNAUTHORIZED") return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  if (["FORBIDDEN", "NO_ACTIVE_ORG"].includes(message)) return NextResponse.json({ error: "Нет доступа" }, { status: 403 });
  if (error instanceof SyntaxError) return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  if (error && typeof error === "object" && "code" in error && ["P2034", "P2002"].includes(String(error.code))) {
    return NextResponse.json({ error: "Учётные данные изменились. Обновите страницу и повторите проверку." }, { status: 409 });
  }
  console.error("OPENING BALANCE ERROR:", error);
  return NextResponse.json({ error: "Внутренняя ошибка сервера" }, { status: 500 });
}

export async function GET() {
  try {
    const { orgId } = await getActiveMembership();
    const documents = await prisma.document.findMany({
      where: { orgId, type: { code: "OPENING_BALANCE" }, status: "POSTED" },
      include: { journalEntries: { include: { account: { select: { code: true, name: true } } }, orderBy: { account: { code: "asc" } } } },
      orderBy: [{ date: "asc" }, { id: "asc" }], take: 2,
    });
    if (documents.length > 1) return NextResponse.json({ error: "Найдены несколько начальных балансов. Требуется сверка истории.", code: "OPENING_BALANCE_REQUIRES_REVIEW" }, { status: 409 });
    const document = documents[0];
    if (!document) return NextResponse.json({ lines: [] });
    const lines = document.journalEntries.map(entry => ({
      accountCode: entry.account.code, accountName: entry.account.name,
      debit: entry.debit.toFixed(2), credit: entry.credit.toFixed(2),
    }));
    const date = new Date(document.date.getTime() + 5 * 60 * 60 * 1000).toISOString().slice(0, 10);
    return NextResponse.json({ lines, date, documentId: document.id, totals: openingBalanceTotals(lines), readOnly: true });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { orgId, userId, role } = await getActiveMembership();
    assertAccountingWriteRole(role);
    const parsed = openingBalanceSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Неверные остатки" }, { status: 400 });
    const { lines, date } = parsed.data;
    const year = Number(date.slice(0, 4));
    const month = Number(date.slice(5, 7));
    const balanceDate = new Date(`${date}T00:00:00+05:00`);

    return await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "Organization" WHERE "id" = ${orgId} FOR UPDATE`;
      await tx.$queryRaw`SELECT "id" FROM "Period" WHERE "orgId" = ${orgId} ORDER BY "year", "month" FOR NO KEY UPDATE`;
      const period = await tx.period.findFirst({ where: { orgId, year, month } });
      if (!period) return NextResponse.json({ error: "Сначала создайте период, соответствующий дате остатков" }, { status: 400 });
      if (period.status !== "OPEN" || period.lockDate !== null) {
        return NextResponse.json({ error: "Период закрыт или заблокирован" }, { status: 409 });
      }
      const existing = await tx.document.findFirst({ where: { orgId }, select: { id: true } });
      if (existing) return NextResponse.json({
        error: "В организации уже есть документы. Изменение начального баланса требует контролируемой корректировки без удаления истории.",
        code: "OPENING_BALANCE_REQUIRES_REVIEW",
      }, { status: 409 });
      const closed = await tx.period.findFirst({ where: { orgId, OR: [{ status: { not: "OPEN" } }, { lockDate: { not: null } }, { closingData: { not: Prisma.DbNull } }] }, select: { id: true } });
      if (closed) return NextResponse.json({ error: "В организации есть закрытие или блокировка периода" }, { status: 409 });
      const accounts = await tx.account.findMany({ where: { code: { in: lines.map(line => line.accountCode) } }, include: { _count: { select: { children: true } } } });
      if (accounts.length !== lines.length || accounts.some(account => !isOpeningBalanceAccount(account))) {
        return NextResponse.json({ error: "Допустимы только действующие проводимые балансовые счета; групповые, транзитные и забалансовые счета запрещены" }, { status: 400 });
      }
      const type = await tx.documentType.upsert({
        where: { code: "OPENING_BALANCE" }, update: {},
        create: { code: "OPENING_BALANCE", name: "Ввод начальных остатков", mode: "MANUAL_ONLY", postingTemplate: { lines: [], opensItem: false } },
      });
      const totals = openingBalanceTotals(lines);
      const document = await tx.document.create({ data: {
        orgId, periodId: period.id, typeId: type.id, date: balanceDate, status: "POSTED",
        payload: { note: "Ввод начальных остатков", version: 1, date, lines, totals },
        journalEntries: { create: lines.map(line => ({
          accountId: accounts.find(account => account.code === line.accountCode)!.id,
          debit: line.debit, credit: line.credit, date: balanceDate,
        })) },
      } });
      await tx.auditLog.create({ data: {
        orgId, userId, action: "CREATE_OPENING_BALANCE", entityType: "Document", entityId: document.id,
        newValue: { version: 1, date, periodId: period.id, lines, totals },
      } });
      return NextResponse.json({ id: document.id, totals }, { status: 201 });
    }, { maxWait: 5000, timeout: 15000 });
  } catch (error) {
    return failure(error);
  }
}

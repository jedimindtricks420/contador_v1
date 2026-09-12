import { NextRequest, NextResponse } from "next/server";
import { getActiveMembership } from "@/lib/context";
import prisma from "@/lib/prisma";

const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };

export async function GET(req: NextRequest) {
  try {
    const { orgId } = await getActiveMembership();
    const bankAccountId = req.nextUrl.searchParams.get("bankAccountId");
    const cursor = req.nextUrl.searchParams.get("cursor");
    if (!bankAccountId || bankAccountId.length > 100 || (cursor !== null && (!cursor || cursor.length > 100))) {
      return NextResponse.json({ error: "Не указан счёт или неверный курсор" }, { status: 400, headers });
    }
    const bank = await prisma.bankAccount.findFirst({ where: { id: bankAccountId, orgId }, select: { id: true } });
    if (!bank) return NextResponse.json({ error: "Счёт не найден" }, { status: 404, headers });
    const scope = { orgId, bankAccountId, bankAccount: { orgId } };
    const anchor = cursor ? await prisma.bankImportBatch.findFirst({
      where: { ...scope, id: cursor }, select: { id: true, createdAt: true },
    }) : null;
    if (cursor && !anchor) return NextResponse.json({ error: "Партия не найдена" }, { status: 404, headers });
    const batches = await prisma.bankImportBatch.findMany({
      where: { ...scope, ...(anchor ? { OR: [
        { createdAt: { lt: anchor.createdAt } },
        { createdAt: anchor.createdAt, id: { lt: anchor.id } },
      ] } : {}) },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 21,
      select: {
        id: true, bankAccountId: true, bankCurrency: true, sourceName: true, sourceHash: true,
        parserVersion: true, statement: true, status: true, createdAt: true, createdBy: true,
        rolledBackAt: true, rolledBackBy: true,
      },
    });
    return NextResponse.json({ batches: batches.slice(0, 20), nextCursor: batches.length > 20 ? batches[19].id : null }, { headers });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const status = message === "UNAUTHORIZED" ? 401 : ["FORBIDDEN", "NO_ACTIVE_ORG"].includes(message) ? 403 : 500;
    return NextResponse.json({ error: status === 500 ? "Не удалось загрузить архив банка" : "Нет доступа" }, { status, headers });
  }
}
import { NextRequest, NextResponse } from "next/server";
import { getActiveMembership } from "@/lib/context";
import prisma from "@/lib/prisma";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const membership = await getActiveMembership();
    if (!["OWNER", "ADMIN"].includes(membership.role)) throw new Error("FORBIDDEN");
    const { orgId, userId } = membership;
    const { id } = await params;

    return await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "Period" WHERE "id" = ${id} AND "orgId" = ${orgId} FOR UPDATE`;
      const period = await tx.period.findFirst({ where: { id, orgId }, include: { _count: { select: {
        documents: true, stagedTransactions: true, taxEvents: true, closingJobs: true, soliqImportBatches: true,
      } } } });
      if (!period) return NextResponse.json({ error: "Период не найден" }, { status: 404 });
      if (period.status !== "OPEN" || period.lockDate !== null) {
        return NextResponse.json({ error: "Нельзя удалить закрытый или заблокированный период" }, { status: 400 });
      }
      const [correction, affectedDebt] = await Promise.all([
        tx.document.findFirst({ where: { orgId, correctionForPeriodId: id }, select: { id: true } }),
        tx.openItem.findFirst({ where: { orgId, affectedPeriodId: id }, select: { id: true } }),
      ]);
      if (period.closingData !== null || Object.values(period._count).some(count => count > 0) || correction || affectedDebt) {
        return NextResponse.json({
          error: "Период содержит учётные данные или историю закрытия. Удаление запрещено.",
          code: "PERIOD_NOT_EMPTY",
        }, { status: 409 });
      }
      await tx.period.delete({ where: { id, orgId } });
      await tx.auditLog.create({ data: {
        orgId, userId, action: "DELETE_PERIOD", entityType: "Period", entityId: id,
        oldValue: { year: period.year, month: period.month, mode: period.mode, status: period.status },
      } });
      return NextResponse.json({ deleted: true });
    }, { maxWait: 5000, timeout: 10000 });
  } catch (err: any) {
    console.error("DELETE PERIOD ERROR:", err);
    const status = ["FORBIDDEN", "NO_ACTIVE_ORG"].includes(err.message) ? 403 : 500;
    return NextResponse.json({ error: err.message || "Internal error" }, { status });
  }
}

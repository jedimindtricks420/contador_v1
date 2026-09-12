import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getActiveMembership } from "@/lib/context";
import { assertAccountingWriteRole } from "@/lib/posting/documentPolicy";
import { SoliqBatchError } from "@/lib/soliqBatch";

const requestSchema = z.object({ reason: z.string().trim().min(1).max(1000) }).strict();

export async function POST(req: NextRequest, { params }: { params: Promise<{ batchId: string }> }) {
  try {
    const membership = await getActiveMembership();
    assertAccountingWriteRole(membership.role);
    const { batchId } = await params;
    const request = requestSchema.safeParse(await req.json());
    if (!request.success) throw new SoliqBatchError("Укажите причину отмены пакета (до 1000 символов)");
    const { orgId, userId } = membership;
    const batch = await prisma.soliqImportBatch.findFirst({ where: { id: batchId, orgId }, select: { periodId: true } });
    if (!batch) return NextResponse.json({ error: "Пакет не найден" }, { status: 404 });
    const { periodId } = batch;
    await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "Period" WHERE "id" = ${periodId} AND "orgId" = ${orgId} FOR NO KEY UPDATE`;
      const period = await tx.period.findFirst({ where: { id: periodId, orgId } });
      if (!period || period.status !== "OPEN" || period.lockDate) throw new SoliqBatchError("Период закрыт или заблокирован");
      const cancelled = await tx.soliqImportBatch.updateMany({
        where: { id: batchId, orgId, periodId, status: "READY" },
        data: { status: "CANCELLED", result: { reason: request.data.reason, userId, cancelledAt: new Date().toISOString() } },
      });
      if (cancelled.count !== 1) throw new SoliqBatchError("Пакет уже проведён или отменён");
    }, { maxWait: 5000, timeout: 10000 });
    return NextResponse.json({ batchId, status: "CANCELLED" });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal error";
    const status = message === "UNAUTHORIZED" ? 401 : ["FORBIDDEN", "NO_ACTIVE_ORG"].includes(message) ? 403 :
      error instanceof SoliqBatchError || error instanceof SyntaxError ? 400 : 500;
    return NextResponse.json({ error: status === 500 ? "Не удалось отменить пакет Soliq" : message }, { status });
  }
}
import { NextRequest, NextResponse } from "next/server";
import { getActiveOrgId, getActiveMembership } from "@/lib/context";
import prisma from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const orgId = await getActiveOrgId();

    const period = await prisma.period.findFirst({
      where: { id, orgId }
    });

    if (!period) {
      return NextResponse.json({ error: "Период не найден" }, { status: 404 });
    }

    if (period.status === "CLOSED") {
      return NextResponse.json({ error: "Период уже закрыт" }, { status: 400 });
    }

    // Check for unresolved transactions: period cannot be closed if any transactions need clarification
    const needsClarification = await prisma.stagedTransaction.count({
      where: { orgId, periodId: id, status: "NEEDS_CLARIFICATION" }
    });
    if (needsClarification > 0) {
      return NextResponse.json({
        error: `Невозможно закрыть период: ${needsClarification} транзакций требуют уточнения. Используйте мастер закрытия месяца.`
      }, { status: 400 });
    }

    // Warn if wizard was never run (no accrual documents exist)
    const { force } = await req.json().catch(() => ({ force: false }));
    if (force) {
      const membership = await getActiveMembership();
      if (membership.role !== "OWNER" && membership.role !== "ADMIN") {
        return NextResponse.json({ error: "Только владелец или администратор может принудительно закрыть период" }, { status: 403 });
      }
    }
    if (!force) {
      const accrualCount = await prisma.document.count({
        where: {
          orgId,
          periodId: id,
          type: { code: { in: ["SALARY_ACCRUAL", "DEPRECIATION_ACCRUAL", "FX_DIFFERENCE"] } }
        }
      });
      if (accrualCount === 0) {
        return NextResponse.json({
          error: "Мастер закрытия месяца не был запущен. Используйте /closing для корректного закрытия периода или передайте force: true для принудительного закрытия.",
          requiresForce: true
        }, { status: 400 });
      }
    }

    const updated = await prisma.period.updateMany({
      where: { id, orgId },
      data: {
        status: "CLOSED",
        lockDate: new Date()
      }
    });
    if (updated.count === 0) {
      return NextResponse.json({ error: "Период не найден" }, { status: 404 });
    }
    const closedPeriod = await prisma.period.findUnique({ where: { id } });

    return NextResponse.json(closedPeriod);
  } catch (err: any) {
    console.error("CLOSE PERIOD ERROR:", err);
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}

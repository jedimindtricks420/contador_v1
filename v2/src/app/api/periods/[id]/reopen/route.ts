import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getActiveMembership } from "@/lib/context";
import prisma from "@/lib/prisma";
import { assertAccountingWriteRole } from "@/lib/posting/documentPolicy";

class ReopenError extends Error {
  constructor(message: string, readonly status: number = 400) { super(message); }
}

const CLOSING_DOC_CODES = [
  "PERIOD_CLOSING",
  "YEAR_END_CLOSE",
  "SALARY_ACCRUAL",
  "SALARY_OFFSET",
  "DEPRECIATION_ACCRUAL",
  "RENT_ACCRUAL",
  "FX_DIFFERENCE",
  "PROFIT_TAX_ACCRUAL",
  "PROFIT_TAX_REVERSAL",
  "TURNOVER_TAX_ACCRUAL",
];

const PROFIT_TAX_DOC_CODES = ["PROFIT_TAX_ACCRUAL", "PROFIT_TAX_REVERSAL"];

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const membership = await getActiveMembership();
    assertAccountingWriteRole(membership.role);
    const orgId = membership.orgId;

    await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Period" WHERE "orgId" = ${orgId} ORDER BY "year", "month" FOR NO KEY UPDATE`;
    const period = await tx.period.findFirst({ where: { id, orgId } });
    if (!period) {
      throw new ReopenError("Период не найден", 404);
    }
    if (period.status !== "CLOSED") {
      throw new ReopenError("Период не закрыт");
    }

    const laterClosed = await tx.period.findFirst({
      where: { orgId, status: "CLOSED", OR: [
        { year: { gt: period.year } }, { year: period.year, month: { gt: period.month } },
      ] },
      orderBy: [{ year: "asc" }, { month: "asc" }],
    });
    if (laterClosed) throw new ReopenError("Сначала переоткройте последующие закрытые периоды, начиная с последнего");

    // Проверка: нельзя переоткрыть если уже выполнен перенос остатков на следующий год
    const hasYearEndFollower = period.month === 12
      ? await tx.document.findFirst({
          where: { orgId, periodId: id, type: { code: "YEAR_END_CLOSE" } },
        })
      : null;
    if (hasYearEndFollower) {
      throw new ReopenError("Нельзя переоткрыть: уже выполнен перенос остатков на следующий год.");
    }

      // 1. Найти системные документы закрытия
      const closingDocs = await tx.document.findMany({
        where: {
          orgId,
          periodId: id,
          type: { code: { in: CLOSING_DOC_CODES } },
        },
        select: { id: true },
      });
      const closingDocIds = closingDocs.map((d) => d.id);

      if (closingDocIds.length > 0) {
        const settledItem = await tx.openItem.findFirst({ where: {
          orgId, openingDocumentId: { in: closingDocIds },
          closingDocumentId: { not: null, notIn: closingDocIds },
        } });
        if (settledItem) throw new ReopenError("Сначала отмените погашения задолженностей, созданных закрытием периода");
        await tx.openItem.updateMany({
          where: { orgId, closingDocumentId: { in: closingDocIds }, openingDocumentId: { notIn: closingDocIds } },
          data: { status: "OPEN", closingDocumentId: null, dateClosed: null },
        });
        await tx.openItem.deleteMany({
          where: { orgId, openingDocumentId: { in: closingDocIds } },
        });
        // JournalEntry удалятся каскадом вместе с Document
        await tx.document.deleteMany({
          where: { orgId, id: { in: closingDocIds } },
        });
      }

      // 3. Удалить налоговые события периода со статусом PENDING
      await tx.taxCalendarEvent.deleteMany({
        where: { orgId, periodId: id, status: "PENDING" },
      });

      // 3a. Налог на прибыль считается нарастающим итогом по кварталам (ст. 339 НК):
      // переоткрытие месяца меняет базу своего квартала и всех последующих. Удаляем
      // начисления/сторно этого и последующих кварталов года — при повторном закрытии
      // квартальных месяцев дельта пересчитается заново (accruedSoFar это учитывает).
      const affectedPtaxDocs = await tx.document.findMany({
        where: {
          orgId,
          type: { code: { in: PROFIT_TAX_DOC_CODES } },
          period: { orgId, status: "OPEN", year: period.year, month: { gt: period.month } },
        },
        select: { id: true, periodId: true, payload: true, date: true },
      });
      const staleDocs = affectedPtaxDocs;
      if (staleDocs.length > 0) {
        const staleIds = staleDocs.map((d) => d.id);
        const stalePeriodIds = [...new Set(staleDocs.map((d) => d.periodId))];
        await tx.document.deleteMany({ where: { orgId, id: { in: staleIds } } });
        await tx.taxCalendarEvent.deleteMany({
          where: {
            orgId,
            periodId: { in: stalePeriodIds },
            type: "PROFIT_TAX",
            status: "PENDING",
          },
        });
      }

      // 4. Разблокировать период
      await tx.period.update({
        where: { id },
        data: {
          status: "OPEN",
          lockDate: null,
          closingData: Prisma.DbNull,
        },
      });
      await tx.closingJob.deleteMany({ where: { periodId: id, orgId } });
      await tx.auditLog.create({ data: {
        orgId, userId: membership.userId, action: "REOPEN_PERIOD", entityType: "Period", entityId: id,
        oldValue: { status: "CLOSED" }, newValue: { status: "OPEN", removedDocumentCount: closingDocIds.length + staleDocs.length },
      } });
    }, { maxWait: 5000, timeout: 30000 });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("REOPEN PERIOD ERROR:", err);
    return NextResponse.json(
      { error: err.message || "Internal error" },
      { status: err instanceof ReopenError ? err.status : ["FORBIDDEN", "NO_ACTIVE_ORG"].includes(err.message) ? 403 : 500 }
    );
  }
}

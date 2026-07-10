import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getActiveOrgId } from "@/lib/context";
import prisma from "@/lib/prisma";
import { clearClosingState } from "@/lib/closing";

const CLOSING_DOC_CODES = [
  "PERIOD_CLOSING",
  "YEAR_END_CLOSE",
  "SALARY_ACCRUAL",
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
    const orgId = await getActiveOrgId();

    const period = await prisma.period.findFirst({ where: { id, orgId } });
    if (!period) {
      return NextResponse.json({ error: "Период не найден" }, { status: 404 });
    }
    if (period.status !== "CLOSED") {
      return NextResponse.json({ error: "Период не закрыт" }, { status: 400 });
    }

    // Проверка: нельзя переоткрыть если уже выполнен перенос остатков на следующий год
    const hasYearEndFollower = period.month === 12
      ? await prisma.document.findFirst({
          where: { orgId, periodId: id, type: { code: "YEAR_END_CLOSE" } },
        })
      : null;
    if (hasYearEndFollower) {
      return NextResponse.json(
        { error: "Нельзя переоткрыть: уже выполнен перенос остатков на следующий год." },
        { status: 400 }
      );
    }

    await prisma.$transaction(async (tx) => {
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
        // 2. Удалить OpenItem, привязанные к системным документам закрытия
        await tx.openItem.deleteMany({
          where: {
            OR: [
              { openingDocumentId: { in: closingDocIds } },
              { closingDocumentId: { in: closingDocIds } },
            ],
          },
        });
        // JournalEntry удалятся каскадом вместе с Document
        await tx.document.deleteMany({
          where: { id: { in: closingDocIds } },
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
      const reopenedQuarter = Math.ceil(period.month / 3);
      const affectedPtaxDocs = await tx.document.findMany({
        where: {
          orgId,
          type: { code: { in: PROFIT_TAX_DOC_CODES } },
          date: {
            gte: new Date(period.year, 0, 1),
            lt: new Date(period.year + 1, 0, 1),
          },
        },
        select: { id: true, periodId: true, payload: true, date: true },
      });
      const staleDocs = affectedPtaxDocs.filter((d) => {
        // Документы без quarter в payload — начисления старой (помесячной) логики;
        // их квартал выводим из даты документа.
        const q = (d.payload as any)?.quarter ?? Math.ceil((d.date.getMonth() + 1) / 3);
        return q >= reopenedQuarter;
      });
      if (staleDocs.length > 0) {
        const staleIds = staleDocs.map((d) => d.id);
        const stalePeriodIds = [...new Set(staleDocs.map((d) => d.periodId))];
        await tx.document.deleteMany({ where: { id: { in: staleIds } } });
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
    });

    // 5. Сбросить ClosingJob из БД
    await clearClosingState(id, orgId);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("REOPEN PERIOD ERROR:", err);
    return NextResponse.json(
      { error: err.message || "Internal error" },
      { status: 500 }
    );
  }
}

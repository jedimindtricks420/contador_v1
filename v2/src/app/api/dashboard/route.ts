import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getActiveOrgId } from "@/lib/context";
import Decimal from "decimal.js";
import { DASHBOARD } from "@/lib/constants";

export async function GET(req: NextRequest) {
  try {
    const orgId = await getActiveOrgId();
    const { searchParams } = new URL(req.url);
    const periodIdParam = searchParams.get("periodId");

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    // Все периоды для dropdown
    const allPeriods = await prisma.period.findMany({
      where: { orgId },
      orderBy: [{ year: "desc" }, { month: "desc" }],
      select: { id: true, year: true, month: true, status: true, mode: true }
    });

    // Целевой период: из параметра или текущий месяц
    let period;
    if (periodIdParam) {
      period = await prisma.period.findFirst({ where: { id: periodIdParam, orgId } });
    } else {
      period = await prisma.period.findFirst({ where: { orgId, year, month } });
    }

    // Транзакции текущего месяца (по статусу)
    const [totalImported, needsClarification, confirmed] = await Promise.all([
      prisma.stagedTransaction.count({ where: { orgId, periodId: period?.id } }),
      prisma.stagedTransaction.count({
        where: { orgId, periodId: period?.id, status: "NEEDS_CLARIFICATION" },
      }),
      prisma.stagedTransaction.count({
        where: { orgId, periodId: period?.id, status: { in: ["CONFIRMED", "POSTED"] } },
      }),
    ]);

    // Остатки по банковским счетам
    const bankAccounts = await prisma.bankAccount.findMany({
      where: { orgId },
      select: { id: true, name: true, currency: true, lastBalance: true, lastSyncedAt: true },
    });

    const totalBalance = bankAccounts.reduce(
      (sum, a) => sum.plus(a.lastBalance.toString()),
      new Decimal(0)
    );

    // Доход/расход за текущий период (из JournalEntry через Document)
    let revenue = new Decimal(0);
    let expenses = new Decimal(0);

    if (period) {
      const entries = await prisma.$queryRaw<
        { type: string; total: string }[]
      >`
        SELECT dt.code as type, SUM(je.credit - je.debit) as total
        FROM "JournalEntry" je
        JOIN "Document" d ON d.id = je."documentId"
        JOIN "DocumentType" dt ON dt.id = d."typeId"
        WHERE d."orgId" = ${orgId}
          AND d."periodId" = ${period.id}
          AND d.status = 'POSTED'
        GROUP BY dt.code
      `;

      for (const row of entries) {
        const val = new Decimal(row.total || 0);
        if (["REVENUE_VAT", "REVENUE_NO_VAT"].includes(row.type)) {
          revenue = revenue.plus(val);
        } else if (
          ["SUPPLIER_PAYMENT", "SALARY", "TAX_PAYMENT", "RENT", "ADVERTISING", "OTHER_EXPENSE"].includes(row.type)
        ) {
          expenses = expenses.plus(val.abs());
        }
      }
    }

    const riskOpenItems = await prisma.openItem.findMany({
      where: { orgId, status: "RISK" },
      include: { counterparty: true, account: true },
      orderBy: { dateOpened: "asc" },
      take: DASHBOARD.RISK_ITEMS_LIMIT
    });

    const riskItems = await prisma.openItem.count({
      where: { orgId, status: "RISK" },
    });

    const upcomingCutoff = new Date();
    upcomingCutoff.setDate(upcomingCutoff.getDate() + DASHBOARD.UPCOMING_TAX_DAYS);
    const upcomingTax = await prisma.taxCalendarEvent.findMany({
      where: { orgId, status: "PENDING", dueDate: { lte: upcomingCutoff } },
      orderBy: { dueDate: "asc" },
      take: DASHBOARD.UPCOMING_TAX_LIMIT,
    });

    // Налоги к уплате (estimatedAmount в статусе PENDING текущего периода)
    let taxesOwed = new Decimal(0);
    if (period) {
      const pendingTaxes = await prisma.taxCalendarEvent.findMany({
        where: { orgId, periodId: period.id, status: "PENDING" }
      });
      taxesOwed = pendingTaxes.reduce(
        (sum, t) => sum.plus(new Decimal(t.estimatedAmount?.toString() || "0")),
        new Decimal(0)
      );
    }

    // Статус месяца
    let monthStatus: "awaiting_data" | "awaiting_action" | "closed" = "awaiting_data";
    if (period?.status === "CLOSED") {
      monthStatus = "closed";
    } else if (totalImported > 0) {
      monthStatus = "awaiting_action";
    }

    // Чек-лист закрытия
    let accrualsConfirmed = false;
    let soliqConfirmed = false;
    if (period) {
      const accrualsCount = await prisma.document.count({
        where: {
          periodId: period.id,
          type: { code: { in: ["SALARY_ACCRUAL", "DEPRECIATION_ACCRUAL", "RENT_ACCRUAL", "FX_DIFFERENCE"] } }
        }
      });
      accrualsConfirmed = accrualsCount > 0 || period.status === "CLOSED";

      const soliqCount = await prisma.document.count({
        where: { periodId: period.id, type: { code: "SOLIQ_IMPORT" } }
      });
      soliqConfirmed = soliqCount > 0;
    }

    const closingChecklist = [
      { step: 1, done: totalImported > 0, label: `Выписка загружена (${totalImported} операций)` },
      { step: 2, done: totalImported > 0 && needsClarification === 0, label: `Вопросы отвечены (${totalImported - needsClarification} из ${totalImported})` },
      { step: 4, done: accrualsConfirmed, label: accrualsConfirmed ? "Начисления подтверждены" : "Начисления не подтверждены" },
      { step: 6, done: soliqConfirmed, label: soliqConfirmed ? "Сверка с Soliq выполнена" : "Сверка с Soliq не выполнена" },
      { step: 7, done: period?.status === "CLOSED", label: period?.status === "CLOSED" ? "Месяц закрыт" : "Месяц не закрыт" }
    ];

    // Импортированные Soliq ЭСФ
    let soliqMatched = 0;
    if (period) {
      const soliqDoc = await prisma.document.findFirst({
        where: { periodId: period.id, type: { code: "SOLIQ_IMPORT" } }
      });
      if (soliqDoc && soliqDoc.payload) {
        const payloadObj = soliqDoc.payload as any;
        soliqMatched = payloadObj.totalEsfItems || 0;
      }
    }

    return NextResponse.json({
      period: period ? { id: period.id, year: period.year, month: period.month, status: period.status } : null,
      allPeriods,
      monthStatus,
      stats: {
        totalImported,
        needsClarification,
        confirmed,
        totalBalance: totalBalance.toFixed(2),
        revenue: revenue.toFixed(2),
        expenses: expenses.toFixed(2),
        profit: revenue.minus(expenses).toFixed(2),
        riskItems,
      },
      bankAccounts,
      upcomingTax,
      importStatus: {
        bankTransactions: totalImported,
        soliqMatched
      },
      closingChecklist,
      kpi: {
        totalBalance: totalBalance.toFixed(2),
        income: revenue.toFixed(2),
        expense: expenses.toFixed(2),
        taxesOwed: taxesOwed.toFixed(2)
      },
      upcomingTaxes: upcomingTax,
      riskOpenItems: riskOpenItems.map(item => {
        const overdueDays = item.riskDeadline 
          ? Math.max(0, Math.ceil((Date.now() - new Date(item.riskDeadline).getTime()) / (1000 * 60 * 60 * 24)))
          : 0;
        return {
          id: item.id,
          counterpartyName: item.counterparty?.name || "Неизвестный контрагент",
          accountCode: item.account.code,
          amount: item.amount,
          dateOpened: item.dateOpened,
          overdueDays
        };
      })
    });
  } catch (err: any) {
    console.error("DASHBOARD ERROR:", err);
    if (err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }
    if (err.message === "FORBIDDEN" || err.message === "NO_ACTIVE_ORG") {
      return NextResponse.json({ error: "Нет доступа" }, { status: 403 });
    }
    return NextResponse.json({ error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}

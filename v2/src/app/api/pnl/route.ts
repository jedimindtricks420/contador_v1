import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getActiveOrgId } from "@/lib/context";
import Decimal from "decimal.js";
import { ACCOUNTS, REVENUE_ACCOUNT_CODES, COGS_ACCOUNT_CODES, EXPENSE_ACCOUNT_CODES } from "@/lib/constants";

export async function GET(req: NextRequest) {
  try {
    const orgId = await getActiveOrgId();
    const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { taxRegime: true } });
    const { searchParams } = new URL(req.url);

    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");

    const now = new Date();
    const currentYear = now.getFullYear();

    const startDate = fromParam ? new Date(fromParam) : new Date(currentYear, 0, 1);
    const endDate = toParam ? new Date(toParam) : new Date(currentYear, 11, 31, 23, 59, 59);

    // Get journal entries for 9xxx and sales VAT (6410)
    const entries = await prisma.journalEntry.findMany({
      where: {
        document: {
          orgId,
          status: "POSTED",
          date: {
            gte: startDate,
            lte: endDate
          }
        },
        OR: [
          { account: { code: { startsWith: "9" } } },
          {
            account: { code: "6410" },
            document: { type: { code: "REVENUE_VAT" } }
          }
        ]
      },
      include: {
        document: {
          include: {
            type: true
          }
        },
        account: true
      },
      orderBy: {
        date: "asc"
      }
    });

    // Generate list of months in YYYY-MM format
    const months: string[] = [];
    let curr = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    const last = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
    while (curr <= last) {
      const key = `${curr.getFullYear()}-${String(curr.getMonth() + 1).padStart(2, "0")}`;
      months.push(key);
      curr.setMonth(curr.getMonth() + 1);
    }

    // Initialize arrays
    const salesRevenue = Array(months.length).fill(null).map(() => new Decimal(0));
    const salesVat = Array(months.length).fill(null).map(() => new Decimal(0));
    const cogs = Array(months.length).fill(null).map(() => new Decimal(0));
    const salary = Array(months.length).fill(null).map(() => new Decimal(0));
    const payrollTax = Array(months.length).fill(null).map(() => new Decimal(0));
    const rent = Array(months.length).fill(null).map(() => new Decimal(0));
    const advertising = Array(months.length).fill(null).map(() => new Decimal(0));
    const depreciation = Array(months.length).fill(null).map(() => new Decimal(0));
    const otherExpense = Array(months.length).fill(null).map(() => new Decimal(0));
    const otherIncome = Array(months.length).fill(null).map(() => new Decimal(0));
    const profitTaxExpense = Array(months.length).fill(null).map(() => new Decimal(0));

    // Process entries
    for (const entry of entries) {
      const doc = entry.document;
      const dateStr = `${doc.date.getFullYear()}-${String(doc.date.getMonth() + 1).padStart(2, "0")}`;
      const monthIdx = months.indexOf(dateStr);
      if (monthIdx === -1) continue;

      const debit = new Decimal(entry.debit.toString());
      const credit = new Decimal(entry.credit.toString());
      const code = entry.account.code;

      const payloadObj = (doc.payload || {}) as any;
      const salaryAmt = new Decimal(payloadObj.salaryAmount || 0);

      if (REVENUE_ACCOUNT_CODES.includes(code as any)) {
        salesRevenue[monthIdx] = salesRevenue[monthIdx].plus(credit).minus(debit);
      }
      
      else if (code === ACCOUNTS.TAX_PAYABLE && doc.type.code === "REVENUE_VAT") {
        salesVat[monthIdx] = salesVat[monthIdx].plus(credit);
      }

      else if (COGS_ACCOUNT_CODES.includes(code as any)) {
        cogs[monthIdx] = cogs[monthIdx].plus(debit).minus(credit);
      }

      // Salary / Payroll taxes from SALARY_ACCRUAL
      else if (doc.type.code === "SALARY_ACCRUAL" && code.startsWith("9")) {
        // If entry amount matches salaryAmount it is Gross Salary, else social/payroll tax
        if (debit.equals(salaryAmt)) {
          salary[monthIdx] = salary[monthIdx].plus(debit);
        } else {
          payrollTax[monthIdx] = payrollTax[monthIdx].plus(debit);
        }
      }

      // Rent: RENT_ACCRUAL or direct RENT payment
      else if (doc.type.code === "RENT_ACCRUAL" || (doc.type.code === "RENT" && code.startsWith("9"))) {
        rent[monthIdx] = rent[monthIdx].plus(debit).minus(credit);
      }

      // Advertising
      else if (doc.type.code === "ADVERTISING" && code.startsWith("9")) {
        advertising[monthIdx] = advertising[monthIdx].plus(debit).minus(credit);
      }

      // Depreciation
      else if (doc.type.code === "DEPRECIATION_ACCRUAL") {
        depreciation[monthIdx] = depreciation[monthIdx].plus(debit);
      }

      // Profit tax expense: 9810 (Расходы по налогу на прибыль)
      else if (code === "9810") {
        profitTaxExpense[monthIdx] = profitTaxExpense[monthIdx].plus(debit).minus(credit);
      }

      // Other operational income: 9390 (Прочие операционные доходы) and similar 93xx
      else if (code.startsWith("93") && !REVENUE_ACCOUNT_CODES.includes(code as any)) {
        otherIncome[monthIdx] = otherIncome[monthIdx].plus(credit).minus(debit);
      }

      else if (code.startsWith("9") && code !== "9910") {
        if (EXPENSE_ACCOUNT_CODES.includes(code as any)) {
          otherExpense[monthIdx] = otherExpense[monthIdx].plus(debit).minus(credit);
        }
      }
    }

    // Load Tax Calendar Events for profit tax / turnover tax
    const taxEvents = await prisma.taxCalendarEvent.findMany({
      where: {
        orgId,
        type: { in: ["PROFIT_TAX", "TURNOVER_TAX"] },
        periodId: { not: null }
      },
      include: {
        period: true
      }
    });

    const taxAmount = Array(months.length).fill(null).map(() => new Decimal(0));
    for (const event of taxEvents) {
      if (!event.period) continue;
      const dateStr = `${event.period.year}-${String(event.period.month).padStart(2, "0")}`;
      const monthIdx = months.indexOf(dateStr);
      if (monthIdx === -1) continue;
      
      const amt = new Decimal(event.estimatedAmount?.toString() || "0");
      taxAmount[monthIdx] = taxAmount[monthIdx].plus(amt);
    }

    // Format lines
    const sum = (arr: Decimal[]) => arr.reduce((s, v) => s.plus(v), new Decimal(0));

    const revenueData = [
      { line: "Выручка от продаж", amounts: salesRevenue.map((r) => r.toNumber()), total: sum(salesRevenue).toNumber() },
      { line: "НДС к уплате", amounts: salesVat.map((v) => v.toNumber()), total: sum(salesVat).toNumber() },
      {
        line: "Выручка без НДС",
        amounts: salesRevenue.map((r, idx) => r.minus(salesVat[idx]).toNumber()),
        total: sum(salesRevenue).minus(sum(salesVat)).toNumber()
      },
      { line: "Прочие операционные доходы", amounts: otherIncome.map((o) => o.toNumber()), total: sum(otherIncome).toNumber() }
    ];

    const expensesData = [
      { line: "Себестоимость", amounts: cogs.map((c) => c.toNumber()), total: sum(cogs).toNumber() },
      { line: "Зарплата", amounts: salary.map((s) => s.toNumber()), total: sum(salary).toNumber() },
      { line: "НДФЛ + соцналог", amounts: payrollTax.map((p) => p.toNumber()), total: sum(payrollTax).toNumber() },
      { line: "Аренда", amounts: rent.map((r) => r.toNumber()), total: sum(rent).toNumber() },
      { line: "Реклама", amounts: advertising.map((a) => a.toNumber()), total: sum(advertising).toNumber() },
      { line: "Амортизация", amounts: depreciation.map((d) => d.toNumber()), total: sum(depreciation).toNumber() },
      { line: "Прочие расходы", amounts: otherExpense.map((o) => o.toNumber()), total: sum(otherExpense).toNumber() },
      { line: "Налог на прибыль (начислен)", amounts: profitTaxExpense.map((t) => t.toNumber()), total: sum(profitTaxExpense).toNumber() }
    ];

    // Totals
    const profitBeforeTax = Array(months.length).fill(null).map((_, idx) => {
      const netRev = salesRevenue[idx].minus(salesVat[idx]).plus(otherIncome[idx]);
      const totalExp = cogs[idx]
        .plus(salary[idx])
        .plus(payrollTax[idx])
        .plus(rent[idx])
        .plus(advertising[idx])
        .plus(depreciation[idx])
        .plus(otherExpense[idx]);
      return netRev.minus(totalExp);
    });

    // Use accrued profit tax from JE (9810) if available, otherwise fall back to calendar estimate
    const netProfit = profitBeforeTax.map((p, idx) => {
      const tax = profitTaxExpense[idx].gt(0) ? profitTaxExpense[idx] : taxAmount[idx];
      return p.minus(tax);
    });

    return NextResponse.json({
      months,
      revenue: revenueData,
      expenses: expensesData,
      profitBeforeTax: profitBeforeTax.map((p) => p.toNumber()),
      tax: taxAmount.map((t) => t.toNumber()),
      netProfit: netProfit.map((n) => n.toNumber()),
      taxRegime: org?.taxRegime ?? "TURNOVER_TAX"
    });
  } catch (err: any) {
    console.error("GET PNL ERROR:", err);
    return NextResponse.json({ error: err.message || "Unauthorized" }, { status: 401 });
  }
}

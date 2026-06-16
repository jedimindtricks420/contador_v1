import { NextRequest, NextResponse } from "next/server";
import { getClosingState } from "@/lib/closing";
import prisma from "@/lib/prisma";
import { getActiveOrgId } from "@/lib/context";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ periodId: string }> }
) {
  try {
    const { periodId } = await params;
    const orgId = await getActiveOrgId();

    const period = await prisma.period.findFirst({ where: { id: periodId, orgId } });
    if (!period) {
      return NextResponse.json({ error: "Период не найден" }, { status: 404 });
    }

    const state = await getClosingState(periodId);

    // Prefill Step 4 из предыдущего закрытого периода если суммы 0
    if (
      state.accruals.salaryAmount === 0 &&
      state.accruals.depreciationAmount === 0 &&
      state.accruals.rentAmount === 0
    ) {
      let prevMonth = period.month - 1;
      let prevYear = period.year;
      if (prevMonth === 0) { prevMonth = 12; prevYear -= 1; }

      const prevPeriod = await prisma.period.findFirst({
        where: { orgId, year: prevYear, month: prevMonth, status: "CLOSED" }
      });
      if (prevPeriod) {
        const docs = await prisma.document.findMany({
          where: {
            periodId: prevPeriod.id,
            type: { code: { in: ["SALARY_ACCRUAL", "DEPRECIATION_ACCRUAL", "RENT_ACCRUAL"] } }
          },
          include: { type: true }
        });

        const salaryDoc = docs.find((d) => d.type.code === "SALARY_ACCRUAL");
        const depDoc = docs.find((d) => d.type.code === "DEPRECIATION_ACCRUAL");
        const rentDoc = docs.find((d) => d.type.code === "RENT_ACCRUAL");

        if (salaryDoc?.payload) state.accruals.salaryAmount = (salaryDoc.payload as any).salaryAmount || 0;
        if (depDoc?.payload) state.accruals.depreciationAmount = (depDoc.payload as any).depreciationAmount || 0;
        if (rentDoc?.payload) state.accruals.rentAmount = (rentDoc.payload as any).rentAmount || 0;
      }
    }

    return NextResponse.json({
      period: { id: period.id, status: period.status, mode: period.mode, year: period.year, month: period.month },
      ...state
    });
  } catch (err: any) {
    console.error("GET CLOSING STATE ERROR:", err);
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}

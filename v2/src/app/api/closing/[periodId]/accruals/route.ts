import { NextRequest, NextResponse } from "next/server";
import { saveClosingState } from "@/lib/closing";
import prisma from "@/lib/prisma";
import { getActiveOrgId } from "@/lib/context";
import { ACCOUNTS } from "@/lib/constants";

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

    // Sum posted SALARY_ACCRUAL docs for this period to suggest prefill
    const salaryDocs = await prisma.document.findMany({
      where: { orgId, periodId, type: { code: "SALARY_ACCRUAL" }, status: "POSTED" }
    });
    const depDocs = await prisma.document.findMany({
      where: { orgId, periodId, type: { code: "DEPRECIATION_ACCRUAL" }, status: "POSTED" }
    });
    const rentDocs = await prisma.document.findMany({
      where: { orgId, periodId, type: { code: "RENT_ACCRUAL" }, status: "POSTED" }
    });

    const sumPayload = (docs: any[], field: string) =>
      docs.reduce((s, d) => s + (Number((d.payload as any)?.[field]) || 0), 0);

    return NextResponse.json({
      postedSalaryAmount: sumPayload(salaryDocs, "salaryAmount"),
      postedDepreciationAmount: sumPayload(depDocs, "depreciationAmount"),
      postedRentAmount: sumPayload(rentDocs, "rentAmount"),
      postedExpenseAccountCode: (salaryDocs[0]?.payload as any)?.expenseAccountCode || null,
      hasPostedDocs: salaryDocs.length + depDocs.length + rentDocs.length > 0
    });
  } catch (err: any) {
    console.error("GET ACCRUALS ERROR:", err);
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}

export async function DELETE(
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
    if (period.status === "CLOSED") {
      return NextResponse.json({ error: "Нельзя изменить закрытый период" }, { status: 409 });
    }

    await saveClosingState(periodId, {
      accruals: { salaryAmount: 0, depreciationAmount: 0, rentAmount: 0, expenseAccountCode: ACCOUNTS.EXPENSE_ADMIN }
    }, orgId);

    return NextResponse.json({ reset: true });
  } catch (err: any) {
    console.error("RESET ACCRUALS ERROR:", err);
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}

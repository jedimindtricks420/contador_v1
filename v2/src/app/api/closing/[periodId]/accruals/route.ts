import { NextRequest, NextResponse } from "next/server";
import { getClosingState, saveClosingState } from "@/lib/closing";
import prisma from "@/lib/prisma";
import { getActiveOrgId } from "@/lib/context";

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
      accruals: { salaryAmount: 0, depreciationAmount: 0, rentAmount: 0 }
    });

    return NextResponse.json({ reset: true });
  } catch (err: any) {
    console.error("RESET ACCRUALS ERROR:", err);
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}

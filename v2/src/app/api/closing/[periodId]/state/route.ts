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

    const state = await getClosingState(periodId, orgId);

    return NextResponse.json({
      ...state,
      period: { id: period.id, status: period.status, mode: period.mode, year: period.year, month: period.month },
    });
  } catch (err: any) {
    console.error("GET CLOSING STATE ERROR:", err);
    const status = ["FORBIDDEN", "NO_ACTIVE_ORG"].includes(err.message) ? 403 : 500;
    return NextResponse.json({ error: err.message || "Internal error" }, { status });
  }
}

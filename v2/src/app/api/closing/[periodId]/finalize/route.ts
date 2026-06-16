import { NextRequest, NextResponse } from "next/server";
import { finalizePeriod } from "@/lib/closing";
import { getActiveOrgId, getUser } from "@/lib/context";
import prisma from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ periodId: string }> }
) {
  try {
    const { periodId } = await params;
    const orgId = await getActiveOrgId();
    const user = await getUser();

    const period = await prisma.period.findFirst({
      where: { id: periodId, orgId }
    });

    if (!period) {
      return NextResponse.json({ error: "Период не найден" }, { status: 404 });
    }

    const result = await finalizePeriod(periodId, orgId, user.id);
    return NextResponse.json(result);
  } catch (err: any) {
    console.error("FINALIZE PERIOD ERROR:", err);
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}

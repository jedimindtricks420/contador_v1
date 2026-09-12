import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getActiveOrgId } from "@/lib/context";

export async function GET(req: NextRequest) {
  try {
    const orgId = await getActiveOrgId();
    const periodId = req.nextUrl.searchParams.get("periodId");
    if (!periodId) return NextResponse.json({ error: "Не указан период" }, { status: 400 });

    const period = await prisma.period.findFirst({ where: { id: periodId, orgId } });
    if (!period) return NextResponse.json({ error: "Период не найден" }, { status: 404 });
    if (period.status !== "CLOSED" || period.month !== 12) return NextResponse.json({ done: false });

    const existing = await prisma.document.findFirst({
      where: { orgId, periodId, status: "POSTED", type: { code: "YEAR_END_CLOSE" } }
    });
    return NextResponse.json({ done: !!existing });
  } catch (err: any) {
    const status = ["FORBIDDEN", "NO_ACTIVE_ORG"].includes(err.message) ? 403 : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}

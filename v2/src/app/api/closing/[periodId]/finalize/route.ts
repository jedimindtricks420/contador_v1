import { NextRequest, NextResponse } from "next/server";
import { finalizePeriod, MissingCogsError } from "@/lib/closing";
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

    const body = await req.json().catch(() => ({}));
    const confirmMissingCogs = body?.confirmMissingCogs === true;

    const result = await finalizePeriod(periodId, orgId, user.id, undefined, { confirmMissingCogs });
    return NextResponse.json(result);
  } catch (err: any) {
    console.error("FINALIZE PERIOD ERROR:", err);
    if (err instanceof MissingCogsError) {
      return NextResponse.json({ error: err.message, code: "MISSING_COGS" }, { status: 409 });
    }
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}

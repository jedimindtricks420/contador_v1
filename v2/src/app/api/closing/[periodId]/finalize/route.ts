import { NextRequest, NextResponse } from "next/server";
import { finalizePeriod, MissingCogsError } from "@/lib/closing";
import { getActiveMembership } from "@/lib/context";
import { assertAccountingWriteRole } from "@/lib/posting/documentPolicy";
import { PostingValidationError } from "@/lib/posting/errors";
import { z } from "zod";
import prisma from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ periodId: string }> }
) {
  try {
    const { periodId } = await params;
    const membership = await getActiveMembership();
    assertAccountingWriteRole(membership.role);
    const orgId = membership.orgId;

    const period = await prisma.period.findFirst({
      where: { id: periodId, orgId }
    });

    if (!period) {
      return NextResponse.json({ error: "Период не найден" }, { status: 404 });
    }

    const text = await req.text();
    const body = z.object({ confirmMissingCogs: z.boolean().optional() }).strict()
      .safeParse(text === "" ? {} : JSON.parse(text));
    if (!body.success) return NextResponse.json({ error: "Некорректные параметры закрытия" }, { status: 400 });
    const confirmMissingCogs = body.data.confirmMissingCogs === true;

    const result = await finalizePeriod(periodId, orgId, membership.userId, undefined, { confirmMissingCogs });
    return NextResponse.json(result);
  } catch (err: any) {
    console.error("FINALIZE PERIOD ERROR:", err);
    if (["FORBIDDEN", "NO_ACTIVE_ORG"].includes(err.message)) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    if (err instanceof SyntaxError || err instanceof PostingValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    if (err instanceof MissingCogsError) {
      return NextResponse.json({ error: err.message, code: "MISSING_COGS" }, { status: 409 });
    }
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}

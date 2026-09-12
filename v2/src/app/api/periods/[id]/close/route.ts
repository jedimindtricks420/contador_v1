import { NextRequest, NextResponse } from "next/server";
import { getActiveMembership } from "@/lib/context";
import prisma from "@/lib/prisma";
import { finalizePeriod } from "@/lib/closing";
import { assertAccountingWriteRole } from "@/lib/posting/documentPolicy";
import { z } from "zod";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const membership = await getActiveMembership();
    assertAccountingWriteRole(membership.role);
    const orgId = membership.orgId;

    const period = await prisma.period.findFirst({
      where: { id, orgId }
    });

    if (!period) {
      return NextResponse.json({ error: "Период не найден" }, { status: 404 });
    }

    const text = await req.text();
    const body = z.object({ force: z.boolean().optional() }).strict()
      .safeParse(text === "" ? {} : JSON.parse(text));
    if (!body.success) return NextResponse.json({ error: "Некорректные параметры закрытия" }, { status: 400 });
    if (body.data.force) {
      return NextResponse.json({ error: "Принудительное закрытие без проверок запрещено. Используйте мастер закрытия месяца." }, { status: 400 });
    }

    const result = await finalizePeriod(id, orgId, membership.userId);
    return NextResponse.json(result.period);
  } catch (err: any) {
    console.error("CLOSE PERIOD ERROR:", err);
    const status = ["FORBIDDEN", "NO_ACTIVE_ORG"].includes(err.message) ? 403 : 400;
    return NextResponse.json({ error: err.message || "Internal error" }, { status });
  }
}

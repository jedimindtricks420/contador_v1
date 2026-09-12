import { NextRequest, NextResponse } from "next/server";
import { getActiveMembership } from "@/lib/context";
import prisma from "@/lib/prisma";
import { assertAccountingWriteRole } from "@/lib/posting/documentPolicy";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const membership = await getActiveMembership();
    assertAccountingWriteRole(membership.role);
    const orgId = membership.orgId;
    const { id } = await params;

    const openItem = await prisma.openItem.findFirst({
      where: { id, orgId }
    });

    if (!openItem) {
      return NextResponse.json({ error: "Открытая позиция не найдена" }, { status: 404 });
    }

    return NextResponse.json({
      error: "Ручное закрытие задолженности запрещено. Проведите документ расчёта с контрагентом.",
    }, { status: 409 });
  } catch (err: any) {
    console.error("PATCH CLOSE OPEN ITEM ERROR:", err);
    if (err.message === "UNAUTHORIZED") return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    if (["FORBIDDEN", "NO_ACTIVE_ORG"].includes(err.message)) return NextResponse.json({ error: "Нет доступа" }, { status: 403 });
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}

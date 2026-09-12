import { NextRequest, NextResponse } from "next/server";
import { getActiveMembership } from "@/lib/context";
import prisma from "@/lib/prisma";
import { assertAccountingWriteRole } from "@/lib/posting/documentPolicy";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const membership = await getActiveMembership();
    assertAccountingWriteRole(membership.role);
    const orgId = membership.orgId;
    const { id } = await params;

    const item = await prisma.openItem.findFirst({ where: { id, orgId } });
    if (!item) return NextResponse.json({ error: "Позиция не найдена" }, { status: 404 });

    return NextResponse.json({
      error: item.closingDocumentId
        ? "Для восстановления задолженности отмените документ расчёта."
        : "Ручное изменение задолженности запрещено. Позиция без документа расчёта требует бухгалтерской сверки.",
    }, { status: 409 });
  } catch (err: any) {
    console.error("REOPEN OPEN ITEM ERROR:", err);
    if (err.message === "UNAUTHORIZED") return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    if (["FORBIDDEN", "NO_ACTIVE_ORG"].includes(err.message)) return NextResponse.json({ error: "Нет доступа" }, { status: 403 });
    return NextResponse.json({ error: "Ошибка при переоткрытии позиции" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getActiveOrgId } from "@/lib/context";
import prisma from "@/lib/prisma";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const orgId = await getActiveOrgId();
    const { id } = await params;

    const item = await prisma.openItem.findFirst({ where: { id, orgId } });
    if (!item) return NextResponse.json({ error: "Позиция не найдена" }, { status: 404 });

    if (item.status !== "CLOSED") {
      return NextResponse.json({ error: "Позиция не закрыта" }, { status: 400 });
    }

    // Only allow reopen if closed manually (no closing document)
    if (item.closingDocumentId !== null) {
      return NextResponse.json({
        error: "Позиция закрыта документом-проводкой. Для переоткрытия необходимо отменить соответствующую проводку."
      }, { status: 400 });
    }

    const updated = await prisma.openItem.update({
      where: { id },
      data: {
        status: "OPEN",
        dateClosed: null,
        closingDocumentId: null,
      }
    });

    return NextResponse.json(updated);
  } catch (err: any) {
    console.error("REOPEN OPEN ITEM ERROR:", err);
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}

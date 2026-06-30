import { NextRequest, NextResponse } from "next/server";
import { getActiveOrgId } from "@/lib/context";
import prisma from "@/lib/prisma";

/**
 * Manually closes an open item sub-ledger position.
 * Verifies period lock status, then sets status to CLOSED with the provided closingDocumentId.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const orgId = await getActiveOrgId();
    const { id } = await params;
    
    const body = await req.json().catch(() => ({}));
    const closingDocumentId = body.closingDocumentId || null;
    const dateClosed = body.dateClosed ? new Date(body.dateClosed) : new Date();

    const openItem = await prisma.openItem.findFirst({
      where: { id, orgId }
    });

    if (!openItem) {
      return NextResponse.json({ error: "Открытая позиция не найдена" }, { status: 404 });
    }

    // Check period lock
    if (openItem.affectedPeriodId) {
      const period = await prisma.period.findUnique({
        where: { id: openItem.affectedPeriodId }
      });
      if (period && (period.status === "CLOSED" || period.lockDate !== null)) {
        return NextResponse.json(
          { error: "Отчётный период закрыт или заблокирован для редактирования" },
          { status: 400 }
        );
      }
    }

    const updated = await prisma.openItem.update({
      where: { id, orgId },
      data: {
        status: "CLOSED",
        closingDocumentId,
        dateClosed
      }
    });

    return NextResponse.json(updated);
  } catch (err: any) {
    console.error("PATCH CLOSE OPEN ITEM ERROR:", err);
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}

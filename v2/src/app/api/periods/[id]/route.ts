import { NextRequest, NextResponse } from "next/server";
import { getActiveOrgId } from "@/lib/context";
import prisma from "@/lib/prisma";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const orgId = await getActiveOrgId();
    const { id } = await params;

    const period = await prisma.period.findFirst({ where: { id, orgId } });
    if (!period) return NextResponse.json({ error: "Период не найден" }, { status: 404 });
    if (period.status === "CLOSED") {
      return NextResponse.json({ error: "Нельзя удалить закрытый период" }, { status: 400 });
    }

    // Delete in correct order to respect FK constraints
    // 1. JournalEntries linked via Documents
    const documents = await prisma.document.findMany({
      where: { periodId: id, orgId },
      select: { id: true }
    });
    const docIds = documents.map((d) => d.id);

    if (docIds.length > 0) {
      await prisma.openItem.deleteMany({ where: { openingDocumentId: { in: docIds } } });
      await prisma.openItem.deleteMany({ where: { closingDocumentId: { in: docIds } } });
      await prisma.journalEntry.deleteMany({ where: { documentId: { in: docIds } } });
    }

    await prisma.document.deleteMany({ where: { periodId: id, orgId } });
    await prisma.stagedTransaction.deleteMany({ where: { periodId: id, orgId } });
    await prisma.taxCalendarEvent.deleteMany({ where: { periodId: id, orgId } });
    await prisma.period.delete({ where: { id, orgId } });

    return NextResponse.json({ deleted: true });
  } catch (err: any) {
    console.error("DELETE PERIOD ERROR:", err);
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}

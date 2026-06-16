import { NextRequest, NextResponse } from "next/server";
import { getActiveMembership } from "@/lib/context";
import prisma from "@/lib/prisma";
import { voidDocument } from "@/lib/posting/postingEngine";

/**
 * Toggles a transaction status between SKIPPED and IMPORTED.
 * If skipping a transaction with an active document, voids its journal entries.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const membership = await getActiveMembership();
    const orgId = membership.orgId;
    const { id } = await params;

    const stagedTx = await prisma.stagedTransaction.findFirst({
      where: { id, orgId }
    });

    if (!stagedTx) {
      return NextResponse.json({ error: "Транзакция не найдена" }, { status: 404 });
    }

    // Check period lock
    const period = await prisma.period.findUnique({
      where: { id: stagedTx.periodId }
    });
    if (!period) {
      return NextResponse.json({ error: "Период не найден" }, { status: 404 });
    }
    if (period.status === "CLOSED" || period.lockDate !== null) {
      return NextResponse.json({ error: "Период закрыт для редактирования" }, { status: 400 });
    }

    let updatedTx;
    if (stagedTx.status === "SKIPPED") {
      // Restore to IMPORTED so it can be classified again
      updatedTx = await prisma.stagedTransaction.update({
        where: { id },
        data: {
          status: "IMPORTED"
        }
      });
    } else {
      // Void postings if document exists
      if (stagedTx.documentId) {
        try {
          await voidDocument(stagedTx.documentId, prisma, membership.userId);
        } catch (voidErr) {
          console.error(`Failed to void document ${stagedTx.documentId} on skip:`, voidErr);
        }
      }

      updatedTx = await prisma.stagedTransaction.update({
        where: { id },
        data: {
          status: "SKIPPED",
          documentId: null
        }
      });
    }

    return NextResponse.json({ transaction: updatedTx });
  } catch (err: any) {
    console.error("PATCH SKIP TRANSACTION ERROR:", err);
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}

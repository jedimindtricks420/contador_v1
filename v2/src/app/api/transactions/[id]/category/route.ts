import { NextRequest, NextResponse } from "next/server";
import { getActiveMembership } from "@/lib/context";
import prisma from "@/lib/prisma";
import { postDocument, repostDocument } from "@/lib/posting/postingEngine";
import { clearRulesCache } from "@/lib/classification/rulesEngine";

/**
 * Assigns or changes the classification category of a staged transaction.
 * Creates or updates/reposts the associated accounting document and generates postings.
 * Optionally auto-creates a classification rule.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const membership = await getActiveMembership();
    const orgId = membership.orgId;
    const { id } = await params;
    const { documentTypeId, createRule } = await req.json();

    if (!documentTypeId) {
      return NextResponse.json({ error: "documentTypeId обязателен" }, { status: 400 });
    }

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

    // Verify document type exists
    const docType = await prisma.documentType.findUnique({
      where: { id: documentTypeId }
    });
    if (!docType) {
      return NextResponse.json({ error: "Категория операции не найдена" }, { status: 404 });
    }

    const result = await prisma.$transaction(async (tx) => {
      let docId = stagedTx.documentId;
      let doc;

      if (docId) {
        // Void and repost existing document
        await repostDocument(docId, documentTypeId, tx, membership.userId);
        doc = await tx.document.findUnique({
          where: { id: docId },
          include: { type: true }
        });
      } else {
        // Create new document
        doc = await tx.document.create({
          data: {
            orgId,
            periodId: stagedTx.periodId,
            typeId: documentTypeId,
            date: stagedTx.date,
            status: "POSTED",
            sourceTransactionId: stagedTx.id,
            payload: {
              amount: Number(stagedTx.amount),
              description: stagedTx.description,
              direction: stagedTx.direction,
              counterpartyHint: stagedTx.counterpartyHint,
              counterpartyInn: stagedTx.counterpartyInn,
              confirmedBy: "USER"
            } as any
          }
        });
        docId = doc.id;
        await postDocument(docId, tx, membership.userId);
      }

      // Update StagedTransaction status and link to the document
      const updatedTx = await tx.stagedTransaction.update({
        where: { id },
        data: {
          status: "CONFIRMED",
          documentId: docId
        }
      });

      let ruleCreated = false;
      if (createRule) {
        const matchType = stagedTx.counterpartyInn ? "INN" : "KEYWORD";
        const matchValue = stagedTx.counterpartyInn || stagedTx.counterpartyHint;

        if (matchValue) {
          // Check if rule already exists to avoid unique constraint issues
          const existingRule = await tx.rule.findFirst({
            where: {
              orgId,
              matchType,
              matchValue
            }
          });

          if (!existingRule) {
            await tx.rule.create({
              data: {
                orgId,
                matchType,
                matchValue,
                categoryId: documentTypeId,
                createdFrom: "USER_ANSWER"
              }
            });
            ruleCreated = true;
          }
        }
      }

      return { transaction: updatedTx, document: doc, ruleCreated };
    });

    if (result.ruleCreated) {
      clearRulesCache(orgId);
    }

    return NextResponse.json(result);
  } catch (err: any) {
    console.error("PATCH CATEGORY TRANSACTION ERROR:", err);
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}

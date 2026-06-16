import { NextRequest, NextResponse } from "next/server";
import { getActiveOrgId, getActiveMembership } from "@/lib/context";
import prisma from "@/lib/prisma";
import { clearRulesCache } from "@/lib/classification/rulesEngine";
import { postDocument } from "@/lib/posting/postingEngine";

export async function POST(req: NextRequest) {
  try {
    const membership = await getActiveMembership();
    const orgId = membership.orgId;
    const {
      transactionIds,
      documentTypeId,
      createRule,
      ruleMatchType,
      ruleMatchValue
    } = await req.json();

    if (!transactionIds || !Array.isArray(transactionIds) || transactionIds.length === 0 || !documentTypeId) {
      return NextResponse.json({ error: "transactionIds и documentTypeId обязательны" }, { status: 400 });
    }

    // Verify document type exists
    const docType = await prisma.documentType.findUnique({
      where: { id: documentTypeId }
    });
    if (!docType) {
      return NextResponse.json({ error: "Категория операции не найдена" }, { status: 404 });
    }

    // Perform database operations inside a Prisma transaction
    const result = await prisma.$transaction(async (tx) => {
      let createdDocsCount = 0;

      for (const txId of transactionIds) {
        const stagedTx = await tx.stagedTransaction.findFirst({
          where: { id: txId, orgId }
        });

        if (!stagedTx) continue;

        // Create the POSTED document
        const doc = await tx.document.create({
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

        // Generate postings using the posting engine (in transaction)
        await postDocument(doc.id, tx, membership.userId);

        // Update StagedTransaction status and documentId
        await tx.stagedTransaction.update({
          where: { id: txId },
          data: {
            status: "CONFIRMED",
            documentId: doc.id
          }
        });

        createdDocsCount++;
      }

      let ruleCreated = false;

      // Create rule if requested
      if (createRule && ruleMatchType && ruleMatchValue) {
        // Prevent duplicate rules
        const existingRule = await tx.rule.findFirst({
          where: {
            orgId,
            matchType: ruleMatchType,
            matchValue: ruleMatchValue
          }
        });

        if (!existingRule) {
          await tx.rule.create({
            data: {
              orgId,
              matchType: ruleMatchType,
              matchValue: ruleMatchValue,
              categoryId: documentTypeId,
              createdFrom: "USER_ANSWER"
            }
          });
          ruleCreated = true;
        }
      }

      return { classified: createdDocsCount, ruleCreated };
    });

    if (result.ruleCreated) {
      clearRulesCache(orgId);
    }

    return NextResponse.json(result);
  } catch (err: any) {
    console.error("POST ANSWER ERROR:", err);
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}

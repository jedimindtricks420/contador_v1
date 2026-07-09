import { NextRequest, NextResponse } from "next/server";
import { getActiveOrgId, getActiveMembership } from "@/lib/context";
import prisma from "@/lib/prisma";
import { clearRulesCache } from "@/lib/classification/rulesEngine";
import { postDocument } from "@/lib/posting/postingEngine";
import { TRANSIT_INNS, isDirectionCompatible } from "@/lib/constants";

export async function POST(req: NextRequest) {
  try {
    const membership = await getActiveMembership();
    const orgId = membership.orgId;
    const {
      transactionIds,
      documentTypeId,
      createRule,
      ruleMatchType,
      ruleMatchValue,
      extraPayload
    } = await req.json();

    const ids: string[] = Array.isArray(transactionIds) ? transactionIds : [];

    if (!documentTypeId) {
      return NextResponse.json({ error: "documentTypeId обязателен" }, { status: 400 });
    }
    // Allow an empty transactionIds list when the caller only wants to save a rule
    // (e.g. "save rule" checkbox ticked with no other transactions selected for bulk-apply).
    if (ids.length === 0 && !createRule) {
      return NextResponse.json({ error: "transactionIds или createRule обязательны" }, { status: 400 });
    }

    // Verify document type exists
    const docType = await prisma.documentType.findUnique({
      where: { id: documentTypeId }
    });
    if (!docType) {
      return NextResponse.json({ error: "Категория операции не найдена" }, { status: 404 });
    }
    // StagedTransactions come from a bank statement — only BANK_AUTO categories make
    // sense here. MANUAL_ONLY types (accruals, closing documents, etc.) are created
    // through the closing wizard, never by manually confirming a bank transaction.
    if (docType.mode === "MANUAL_ONLY") {
      return NextResponse.json({ error: "Эта категория недоступна для банковских транзакций" }, { status: 400 });
    }

    // Perform database operations inside a Prisma transaction
    const result = await prisma.$transaction(async (tx) => {
      let createdDocsCount = 0;
      const classifiedDirections: string[] = [];
      const skippedDirectionMismatch: string[] = [];

      for (const txId of ids) {
        const stagedTx = await tx.stagedTransaction.findFirst({
          where: { id: txId, orgId }
        });

        if (!stagedTx) continue;

        // Lock the row so a concurrent request for the same staged transaction
        // (double submit / retry) can't also create a document for it — the
        // second request blocks here, then sees documentId already set and skips.
        const [lockedTx] = await tx.$queryRaw<{ documentId: string | null }[]>`
          SELECT "documentId" FROM "StagedTransaction" WHERE id = ${txId} FOR UPDATE
        `;
        if (lockedTx?.documentId) continue;

        // Direction guard: a CREDIT (money in) transaction can never be posted as a
        // DEBIT-only category and vice versa. Without this, a group of transactions
        // from the same counterparty that mixes both directions (common — e.g. a
        // supplier who both bills us and occasionally refunds us) would silently let
        // one bulk category choice post a backwards journal entry for the minority
        // direction, since the clarification queue groups by counterparty only,
        // never by direction (see app/api/clarification/queue/route.ts).
        if (!isDirectionCompatible(docType.code, stagedTx.direction)) {
          skippedDirectionMismatch.push(txId);
          continue;
        }

        classifiedDirections.push(stagedTx.direction);

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
              confirmedBy: "USER",
              // Categorical fields some templates branch on (customsType, subscriptionPeriod, etc.) —
              // collected in the clarification UI when the chosen type's template needs them.
              ...(extraPayload && typeof extraPayload === "object" ? extraPayload : {})
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

      // Direction for the rule: use it only if all classified transactions share one direction
      const uniqueDirs = [...new Set(classifiedDirections)];
      const ruleDirection = uniqueDirs.length === 1 ? uniqueDirs[0] : null;

      let ruleCreated = false;
      let ruleId: string | null = null;

      // Create rule if requested
      if (createRule && ruleMatchType && ruleMatchValue) {
        // Guard: never create INN rules for transit accounts (Казначейство, НБУ, etc.)
        const isTransitInn = ruleMatchType === "INN" && TRANSIT_INNS.has(ruleMatchValue);

        if (!isTransitInn) {
          const existingRule = await tx.rule.findFirst({
            where: { orgId, matchType: ruleMatchType, matchValue: ruleMatchValue }
          });

          if (!existingRule) {
            const newRule = await tx.rule.create({
              data: {
                orgId,
                matchType: ruleMatchType,
                matchValue: ruleMatchValue,
                categoryId: documentTypeId,
                createdFrom: "USER_ANSWER",
                direction: ruleDirection
              }
            });
            ruleCreated = true;
            ruleId = newRule.id;
          } else {
            ruleId = existingRule.id;
          }
        }
      }

      return { classified: createdDocsCount, ruleCreated, ruleId, skippedDirectionMismatch };
    });

    if (result.ruleCreated) {
      clearRulesCache(orgId);
    }

    if (result.skippedDirectionMismatch.length > 0) {
      console.warn(
        `Clarification answer: category "${docType.code}" is incompatible with the direction of ${result.skippedDirectionMismatch.length} transaction(s); left unclassified:`,
        result.skippedDirectionMismatch
      );
    }

    return NextResponse.json(result);
  } catch (err: any) {
    console.error("POST ANSWER ERROR:", err);
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}

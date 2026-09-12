import { randomUUID } from "node:crypto";
import type { Document, DocumentType, Prisma } from "@prisma/client";
import { PostingValidationError } from "./errors";

export type RevisionAction = "POST" | "VOID";

export async function assertPostingRevisionState(
  tx: Pick<Prisma.TransactionClient, "$queryRaw">,
  document: Pick<Document, "id" | "orgId" | "periodId" | "status">,
  action: RevisionAction,
) {
  await tx.$queryRaw`SELECT "id" FROM "JournalEntry"
    WHERE "documentId" = ${document.id} ORDER BY "id" FOR UPDATE`;
  const [revision] = await tx.$queryRaw<{
    orgId: string; periodId: string; action: string;
    hashValid: boolean; ledgerMatches: boolean; hasEntries: boolean;
  }[]>`
    SELECT history."orgId", history."periodId", history."action",
      history."snapshotHash" = encode(sha256(convert_to(history."snapshot"::text, 'UTF8')), 'hex') AS "hashValid",
      history."snapshot"->'journalEntries' = COALESCE((
        SELECT jsonb_agg(to_jsonb(entry) || jsonb_build_object(
          'debit', entry."debit"::text, 'credit', entry."credit"::text,
          'accountCode', account."code") ORDER BY entry."id")
        FROM "JournalEntry" entry JOIN "Account" account ON account."id" = entry."accountId"
        WHERE entry."documentId" = ${document.id}
      ), '[]'::jsonb) AS "ledgerMatches",
      EXISTS(SELECT 1 FROM "JournalEntry" WHERE "documentId" = ${document.id}) AS "hasEntries"
    FROM "PostingRevision" history WHERE history."documentId" = ${document.id}
    ORDER BY history."revision" DESC LIMIT 1
  `;
  if (!revision) return;

  const ownRevision = revision.orgId === document.orgId && revision.periodId === document.periodId
    && revision.hashValid === true;
  const inactive = revision.action === "VOID" && revision.hasEntries === false;
  const valid = action === "POST"
    ? inactive && document.status === "POSTED"
    : (inactive && document.status === "VOIDED") || (
      revision.action === "POST" && document.status === "POSTED"
      && revision.hasEntries === true && revision.ledgerMatches === true
    );
  if (!ownRevision || !valid) {
    throw new PostingValidationError("Posting revision and live ledger disagree; accounting review is required");
  }
}

export async function appendPostingRevision(
  tx: Pick<Prisma.TransactionClient, "$executeRaw">,
  document: Document & { type: DocumentType },
  action: RevisionAction,
  userId: string,
  calculationContext: Record<string, unknown> | null,
) {
  const { type, ...sourceDocument } = document;
  const metadata = JSON.stringify({
    formatVersion: 1,
    document: sourceDocument,
    observedType: type,
    calculationContext,
    ruleProvenance: action === "POST" ? "USED_FOR_POSTING" : "OBSERVED_AT_VOID",
  });
  await tx.$executeRaw`
    INSERT INTO "PostingRevision"
      ("id", "orgId", "documentId", "periodId", "revision", "previousId", "action", "createdBy", "snapshot", "snapshotHash")
    SELECT ${randomUUID()}, ${document.orgId}, ${document.id}, ${document.periodId},
      COALESCE(previous."revision", 0) + 1, previous."id", ${action}, ${userId},
      source.snapshot, encode(sha256(convert_to(source.snapshot::text, 'UTF8')), 'hex')
    FROM (SELECT ${metadata}::jsonb || jsonb_build_object(
      'journalEntries', COALESCE((SELECT jsonb_agg(to_jsonb(entry) || jsonb_build_object(
        'debit', entry."debit"::text, 'credit', entry."credit"::text,
        'accountCode', account."code") ORDER BY entry."id")
        FROM "JournalEntry" entry JOIN "Account" account ON account."id" = entry."accountId"
        WHERE entry."documentId" = ${document.id}), '[]'::jsonb),
      'openItems', COALESCE((SELECT jsonb_agg(to_jsonb(item) || jsonb_build_object(
        'amount', item."amount"::text) ORDER BY item."id") FROM "OpenItem" item
        WHERE item."orgId" = ${document.orgId} AND
          (item."openingDocumentId" = ${document.id} OR item."closingDocumentId" = ${document.id})), '[]'::jsonb)
    ) AS snapshot) source
    LEFT JOIN LATERAL (SELECT "id", "revision" FROM "PostingRevision"
      WHERE "documentId" = ${document.id} ORDER BY "revision" DESC LIMIT 1) previous ON true
  `;
}
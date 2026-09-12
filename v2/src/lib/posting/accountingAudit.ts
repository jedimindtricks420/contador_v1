import { Prisma, PrismaClient } from "@prisma/client";
import { normalizeBankAccountNumber } from "../bankStatementValidation";

export async function auditAccounting(client: PrismaClient, orgId: string) {
  if (!orgId.trim()) throw new Error("An explicit organization ID is required");
  return client.$transaction(async (transaction) => {
    await transaction.$executeRaw`SET TRANSACTION READ ONLY`;
    await transaction.$executeRaw`SET LOCAL statement_timeout = '5s'`;
    await transaction.$executeRaw`SET LOCAL lock_timeout = '1s'`;
    await transaction.$executeRaw`SET LOCAL work_mem = '4MB'`;
    const organization = await transaction.organization.findUnique({ where: { id: orgId }, select: { id: true } });
    if (!organization) throw new Error("Organization not found");
    const counts = await transaction.$queryRaw<Array<{ check: string; count: bigint }>>(Prisma.sql`
      WITH documents AS (
        SELECT document.*, type.code AS "typeCode", period."orgId" AS "periodOrgId",
          period.year, period.month
        FROM "Document" document
        JOIN "Period" period ON period.id = document."periodId"
        JOIN "DocumentType" type ON type.id = document."typeId"
        WHERE document."orgId" = ${orgId}
      ), ledger AS (
        SELECT entry.*, account.code, counterparty."orgId" AS "counterpartyOrgId"
        FROM "JournalEntry" entry
        JOIN documents document ON document.id = entry."documentId"
        JOIN "Account" account ON account.id = entry."accountId"
        LEFT JOIN "Counterparty" counterparty ON counterparty.id = entry."counterpartyId"
      ), totals AS (
        SELECT document.id, COUNT(entry.id) AS lines,
          COALESCE(SUM(entry.debit), 0) AS debit, COALESCE(SUM(entry.credit), 0) AS credit
        FROM documents document LEFT JOIN ledger entry ON entry."documentId" = document.id
        GROUP BY document.id
      )
      SELECT 'posted_without_entries' AS "check", COUNT(*) AS count FROM documents document
        JOIN totals ON totals.id = document.id
        WHERE document.status = 'POSTED' AND totals.lines = 0 AND document."typeCode" <> 'PERIOD_CLOSING'
      UNION ALL SELECT 'unbalanced_documents', COUNT(*) FROM totals WHERE debit <> credit
      UNION ALL SELECT 'invalid_ledger_sides', COUNT(*) FROM ledger
        WHERE debit < 0 OR credit < 0 OR (debit > 0 AND credit > 0) OR (debit = 0 AND credit = 0)
      UNION ALL SELECT 'voided_with_entries', COUNT(*) FROM documents document
        JOIN totals ON totals.id = document.id WHERE document.status = 'VOIDED' AND totals.lines > 0
      UNION ALL SELECT 'date_period_mismatch', COUNT(*) FROM documents
        WHERE EXTRACT(YEAR FROM date AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tashkent') <> year
           OR EXTRACT(MONTH FROM date AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tashkent') <> month
      UNION ALL SELECT 'foreign_period', COUNT(*) FROM documents WHERE "periodOrgId" <> ${orgId}
      UNION ALL SELECT 'foreign_counterparty', COUNT(*) FROM ledger WHERE "counterpartyOrgId" <> ${orgId}
      UNION ALL SELECT 'tax_calendar_sync_failed', COUNT(*) FROM documents WHERE "taxCalendarSyncStatus" = 'FAILED'
      UNION ALL SELECT 'possible_duplicate_ledger_groups', COUNT(*) FROM (
        SELECT "documentId", "accountId", debit, credit, date, "counterpartyId", "contractId"
        FROM ledger GROUP BY "documentId", "accountId", debit, credit, date, "counterpartyId", "contractId"
        HAVING COUNT(*) > 1
      ) duplicates
      UNION ALL SELECT 'possible_disposal_loss_9320', COUNT(*) FROM ledger entry
        JOIN documents document ON document.id = entry."documentId"
        WHERE document."typeCode" = 'FIXED_ASSET_DISPOSAL_RESULT' AND entry.code = '9320' AND entry.debit > 0
      UNION ALL SELECT 'foreign_currency_bank_on_5110', COUNT(DISTINCT entry."documentId")
        FROM ledger entry JOIN "StagedTransaction" staged ON staged."documentId" = entry."documentId"
        JOIN "BankAccount" bank ON bank.id = staged."bankAccountId"
        WHERE entry.code = '5110' AND bank.currency <> 'UZS'
      UNION ALL SELECT 'duplicate_counterparty_inn_groups', COUNT(*) FROM (
        SELECT inn FROM "Counterparty" WHERE "orgId" = ${orgId} AND inn IS NOT NULL AND BTRIM(inn) <> ''
        GROUP BY inn HAVING COUNT(*) > 1
      ) duplicates
      UNION ALL SELECT 'closed_period_unprocessed_bank_rows', COUNT(*) FROM "StagedTransaction" staged
        JOIN "Period" period ON period.id = staged."periodId"
        WHERE staged."orgId" = ${orgId} AND period.status = 'CLOSED'
          AND staged.status IN ('IMPORTED', 'NEEDS_CLARIFICATION')
      UNION ALL SELECT 'closed_items_without_settlement_document', COUNT(*) FROM "OpenItem" item
        JOIN "Document" opening ON opening.id = item."openingDocumentId"
        WHERE item."orgId" = ${orgId} AND item.status = 'CLOSED'
          AND item."closingDocumentId" IS NULL AND opening.status = 'POSTED'
      ORDER BY "check"
    `);
    const bankAccounts = await transaction.bankAccount.findMany({
      where: { orgId }, select: { accountNumber: true }
    });
    let missingBankNumbers = 0;
    let invalidBankNumbers = 0;
    const bankNumberCounts = new Map<string, number>();
    for (const { accountNumber } of bankAccounts) {
      if (!accountNumber?.trim()) {
        missingBankNumbers += 1;
        continue;
      }
      const normalized = normalizeBankAccountNumber(accountNumber);
      if (!normalized) {
        invalidBankNumbers += 1;
        continue;
      }
      bankNumberCounts.set(normalized, (bankNumberCounts.get(normalized) ?? 0) + 1);
    }
    const bankChecks = [
      { check: "missing_bank_account_number", count: String(missingBankNumbers) },
      { check: "invalid_bank_account_number", count: String(invalidBankNumbers) },
      { check: "duplicate_bank_account_number_groups", count: String(
        Array.from(bankNumberCounts.values()).filter(count => count > 1).length
      ) }
    ];
    return {
      orgId,
      generatedAt: new Date().toISOString(),
      readOnly: true,
      checks: [
        ...counts.map((row) => ({ check: row.check, count: row.count.toString() })),
        ...bankChecks
      ].sort((left, right) => left.check.localeCompare(right.check))
    };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, maxWait: 5000, timeout: 15000 });
}
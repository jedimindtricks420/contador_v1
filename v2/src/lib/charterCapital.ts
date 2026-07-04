import Decimal from "decimal.js";
import prisma from "./prisma";

const CHARTER_DEBT_ACCOUNT_CODE = "4610";

/**
 * Outstanding debt of the founders towards the company for their charter capital
 * contribution — the actual GL balance (debit - credit) of account 4610 for POSTED
 * documents. This is the source of truth for "how much of the declared charter
 * capital is still unpaid", used by the settings UI, the posting-engine guard on
 * CAPITAL_CONTRIBUTION, and the AI classifier prompt context.
 *
 * Computed from the ledger rather than `charterCapitalAmount - Σ(CAPITAL_CONTRIBUTION)`
 * so it stays correct even when the declaration document itself already credits part
 * of 4610 (FULLY_PAID_CASH / PARTIALLY_PAID / PAID_IN_KIND at declaration time).
 */
export async function getCharterCapitalDebt(orgId: string, tx: any = prisma): Promise<Decimal> {
  const rows = await tx.$queryRaw<{ total: string }[]>`
    SELECT COALESCE(SUM(je.debit - je.credit), 0)::text AS total
    FROM "JournalEntry" je
    JOIN "Document" d ON d.id = je."documentId"
    JOIN "Account" a ON a.id = je."accountId"
    WHERE d."orgId" = ${orgId} AND d.status = 'POSTED' AND a.code = ${CHARTER_DEBT_ACCOUNT_CODE}
  `;
  return new Decimal(rows[0]?.total ?? 0);
}

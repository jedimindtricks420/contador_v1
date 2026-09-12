import { createHash } from "node:crypto";
import type { StagedTransaction } from "@prisma/client";

export function bankImportFingerprint(rows: StagedTransaction[]): string {
  const source = [...rows].sort((first, second) => first.id < second.id ? -1 : first.id > second.id ? 1 : 0)
    .map(row => ({
      id: row.id, orgId: row.orgId, bankAccountId: row.bankAccountId, periodId: row.periodId,
      importBatchId: row.importBatchId, date: row.date.toISOString(), amount: row.amount.toFixed(2),
      direction: row.direction, description: row.description, counterpartyHint: row.counterpartyHint,
      counterpartyInn: row.counterpartyInn, hash: row.hash,
    }));
  return createHash("sha256").update(JSON.stringify(source)).digest("hex");
}
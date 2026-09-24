import { createHash } from "node:crypto";
import type { ParsedTransaction } from "@/lib/parsers/types";
import { BankStatementValidationError, normalizeBankAccountNumber, parseBankStatementMoney } from "@/lib/bankStatementValidation";

export function bankTransactionReferenceHash(transaction: ParsedTransaction, orgId: string, bankAccountId: string, currency: string): string | null {
  if (transaction.bankDocumentNumber === undefined) return null;
  if (!transaction.bankDocumentNumber || !normalizeBankAccountNumber(transaction.payerAccountNumber) ||
      !normalizeBankAccountNumber(transaction.recipientAccountNumber)) {
    throw new BankStatementValidationError("Неполные реквизиты банковского документа");
  }
  return createHash("sha256").update(JSON.stringify([
    "bank-reference-v1", orgId, bankAccountId, currency, transaction.date.toISOString(),
    transaction.payerAccountNumber, transaction.bankDocumentNumber,
  ])).digest("hex");
}

export function matchesArchivedBankRow(value: unknown, transaction: ParsedTransaction): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return row.date === transaction.date.toISOString() && row.amount === parseBankStatementMoney(String(transaction.amount)) &&
    row.direction === transaction.direction && row.description === transaction.description &&
    row.bankDocumentNumber === (transaction.bankDocumentNumber ?? null) &&
    row.payerAccountNumber === (transaction.payerAccountNumber ?? null) &&
    row.recipientAccountNumber === (transaction.recipientAccountNumber ?? null) &&
    row.counterpartyHint === (transaction.counterpartyHint ?? null) && row.counterpartyInn === (transaction.counterpartyInn ?? null);
}
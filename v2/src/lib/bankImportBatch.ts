import { createHash } from "node:crypto";
import { BANK_UPLOAD_MAX_FILE_BYTES } from "@/lib/bankUpload";
import { BANK_STATEMENT_MAX_TRANSACTIONS } from "@/lib/parsers/parser1c";
import type { ParsedBankStatement } from "@/lib/parsers/types";
import { BankStatementValidationError, normalizeBankAccountNumber, parseBankStatementMoney } from "@/lib/bankStatementValidation";

export const BANK_IMPORT_PARSER_VERSION = "1c-bank-v1";

export function bankSourceHash(source: Uint8Array): string {
  return createHash("sha256").update(source).digest("hex");
}

export function buildBankImportSource(source: Buffer, sourceName: string, parsed: ParsedBankStatement) {
  const accountNumber = normalizeBankAccountNumber(parsed.accountNumber);
  const periodStart = parsed.periodStart;
  const periodEnd = parsed.periodEnd;
  if (!source.length || source.length > BANK_UPLOAD_MAX_FILE_BYTES || !accountNumber ||
      !periodStart || !periodEnd || !Number.isFinite(periodStart.getTime()) || !Number.isFinite(periodEnd.getTime()) ||
      periodStart > periodEnd || !parsed.transactions.length || parsed.transactions.length > BANK_STATEMENT_MAX_TRANSACTIONS ||
      parsed.openingBalance === undefined || parsed.closingBalance === undefined) {
    throw new BankStatementValidationError("Неполный исходный снимок банковского импорта");
  }
  const openingBalance = parseBankStatementMoney(String(parsed.openingBalance), true);
  const closingBalance = parseBankStatementMoney(String(parsed.closingBalance), true);
  let creditCents = BigInt(0);
  let debitCents = BigInt(0);
  const rows = parsed.transactions.map((transaction, index) => {
    if (!Number.isFinite(transaction.date.getTime()) || transaction.date < periodStart || transaction.date > periodEnd ||
        !["CREDIT", "DEBIT"].includes(transaction.direction)) {
      throw new BankStatementValidationError("Некорректная строка исходного снимка банковского импорта");
    }
    const amount = parseBankStatementMoney(String(transaction.amount));
    const cents = BigInt(amount.replace(".", ""));
    if (transaction.direction === "CREDIT") creditCents += cents;
    else debitCents += cents;
    return {
      rowNumber: index + 1, date: transaction.date.toISOString(), amount, direction: transaction.direction,
      description: transaction.description, counterpartyHint: transaction.counterpartyHint ?? null,
      counterpartyInn: transaction.counterpartyInn ?? null,
    };
  });
  if (BigInt(openingBalance.replace(".", "")) + creditCents - debitCents !== BigInt(closingBalance.replace(".", ""))) {
    throw new BankStatementValidationError("Контрольные итоги исходного снимка банковского импорта не совпадают");
  }
  const fixedMoney = (cents: bigint) => `${cents / BigInt(100)}.${String(cents % BigInt(100)).padStart(2, "0")}`;
  return {
    sourceName: sourceName.split(/[\\/]/).pop()?.replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 255) || "bank.txt",
    sourceHash: bankSourceHash(source), sourceData: Buffer.from(source), parserVersion: BANK_IMPORT_PARSER_VERSION,
    rows,
    statement: {
      accountNumber, periodStart: periodStart.toISOString(), periodEnd: periodEnd.toISOString(),
      openingBalance, closingBalance, credits: fixedMoney(creditCents), debits: fixedMoney(debitCents), rowCount: rows.length,
    },
  };
}
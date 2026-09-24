import { z } from "zod";
import { bankSourceHash } from "@/lib/bankImportBatch";
import { BankStatementValidationError, normalizeBankAccountNumber, parseBankStatementMoney } from "@/lib/bankStatementValidation";
import type { ParsedBankStatement } from "@/lib/parsers/types";

type BankState = { lastBalance: string; lastSyncedAt: Date | null; currency: string; accountNumber: string | null };
type Archive = { id: string; bankCurrency: string; sourceHash: string; sourceData: Uint8Array; statement: unknown; result: unknown };
const previousStatement = z.object({ accountNumber: z.string(), periodEnd: z.string().datetime(), closingBalance: z.string() });
const previousResult = z.object({ newValue: z.object({ lastSyncedAt: z.string().datetime(), lastBalance: z.string(), currency: z.string(), accountNumber: z.string() }) });

function dayNumber(date: Date): number {
  const parts = new Intl.DateTimeFormat("en", { timeZone: "Asia/Tashkent", year: "numeric", month: "numeric", day: "numeric" }).formatToParts(date);
  const part = (type: string) => Number(parts.find(item => item.type === type)?.value);
  return Date.UTC(part("year"), part("month") - 1, part("day")) / 86400000;
}

export function assertBankStatementContinuity(statement: ParsedBankStatement, bank: BankState, archives: Archive[]): string | null {
  const opening = parseBankStatementMoney(String(statement.openingBalance), true);
  const balance = parseBankStatementMoney(bank.lastBalance, true);
  if (!bank.lastSyncedAt) {
    if (archives.length || (balance !== "0.00" && balance !== opening)) {
      throw new BankStatementValidationError("Начальный остаток выписки не подтверждён состоянием счёта");
    }
    return null;
  }
  const archive = archives.length === 1 ? archives[0] : null;
  const previous = previousStatement.safeParse(archive?.statement);
  const result = previousResult.safeParse(archive?.result);
  if (!archive || !previous.success || !result.success || archive.sourceHash !== bankSourceHash(archive.sourceData) ||
      archive.bankCurrency !== bank.currency || result.data.newValue.currency !== bank.currency ||
      result.data.newValue.lastSyncedAt !== bank.lastSyncedAt.toISOString() ||
      result.data.newValue.accountNumber !== normalizeBankAccountNumber(bank.accountNumber) ||
      previous.data.accountNumber !== normalizeBankAccountNumber(bank.accountNumber) ||
      parseBankStatementMoney(result.data.newValue.lastBalance, true) !== balance ||
      parseBankStatementMoney(previous.data.closingBalance, true) !== balance || opening !== balance) {
    throw new BankStatementValidationError("Нет подтверждённого предыдущего остатка выписки. Требуется сверка");
  }
  if (!statement.periodStart || dayNumber(statement.periodStart) !== dayNumber(new Date(previous.data.periodEnd)) + 1) {
    throw new BankStatementValidationError("Периоды выписок пересекаются или имеют пропуск. Требуется последовательная выписка");
  }
  return archive.id;
}
import Decimal from "decimal.js";

export class BankStatementValidationError extends Error {
  readonly code = "BANK_STATEMENT_INVALID";
}

export function normalizeBankAccountNumber(value: string | null | undefined): string | null {
  const normalized = value?.replace(/\s/g, "");
  return normalized && /^\d{20}$/.test(normalized) ? normalized : null;
}

export function assertStatementAccount(statementNumber: string | undefined, bankNumber: string | null): string {
  const statement = normalizeBankAccountNumber(statementNumber);
  const bank = normalizeBankAccountNumber(bankNumber);
  if (!statement || !bank) {
    throw new BankStatementValidationError("Необходим распознанный 20-значный номер счёта в выписке и настройках банка");
  }
  if (statement !== bank) {
    throw new BankStatementValidationError("Номер счёта в выписке не совпадает с выбранным банковским счётом");
  }
  return statement;
}

export function parseBankStatementMoney(value: string, allowNegative = false): string {
  const trimmed = value.trim();
  if (!/^-?(?:\d+|\d{1,3}(?:[ \u00a0]\d{3})+)(?:[.,]\d{1,2})?$/.test(trimmed)) {
    throw new BankStatementValidationError("Некорректная сумма в банковской выписке");
  }
  const amount = new Decimal(trimmed.replace(/[ \u00a0]/g, "").replace(",", "."));
  if (amount.abs().gte("1000000000000000000") || (!allowNegative && !amount.gt(0))) {
    throw new BankStatementValidationError("Сумма банковской выписки вне допустимого диапазона");
  }
  return amount.toFixed(2);
}
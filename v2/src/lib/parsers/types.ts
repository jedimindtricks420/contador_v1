export interface ParsedTransaction {
  date: Date;
  amount: number | string;
  direction: "CREDIT" | "DEBIT";
  description: string;
  counterpartyHint?: string;
  counterpartyInn?: string;
}

export interface ParsedBankStatement {
  transactions: ParsedTransaction[];
  openingBalance?: number | string;
  closingBalance?: number | string;
  periodStart?: Date;
  periodEnd?: Date;
  accountNumber?: string;
}

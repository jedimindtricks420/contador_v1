export interface ParsedTransaction {
  date: Date;
  amount: number;
  direction: "CREDIT" | "DEBIT";
  description: string;
  counterpartyHint?: string;
  counterpartyInn?: string;
}

export interface ParsedBankStatement {
  transactions: ParsedTransaction[];
  openingBalance?: number;
  closingBalance?: number;
  periodStart?: Date;
  periodEnd?: Date;
  accountNumber?: string;
}

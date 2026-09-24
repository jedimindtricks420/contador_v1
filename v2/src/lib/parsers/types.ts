export interface ParsedTransaction {
  date: Date;
  amount: number | string;
  direction: "CREDIT" | "DEBIT";
  description: string;
  counterpartyHint?: string;
  counterpartyInn?: string;
  bankDocumentNumber?: string;
  payerAccountNumber?: string;
  recipientAccountNumber?: string;
}

export interface ParsedBankStatement {
  transactions: ParsedTransaction[];
  openingBalance?: number | string;
  closingBalance?: number | string;
  periodStart?: Date;
  periodEnd?: Date;
  accountNumber?: string;
  currency?: string;
}

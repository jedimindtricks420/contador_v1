export interface ParsedTransaction {
  date: Date;
  amount: number;
  direction: "CREDIT" | "DEBIT";
  description: string;
  counterpartyHint?: string;
  counterpartyInn?: string;
}

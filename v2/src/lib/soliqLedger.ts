import Decimal from "decimal.js";
import { SoliqBatchError } from "@/lib/soliqBatch";

const layouts: Record<string, { direction: "REVENUE" | "EXPENSE"; settlement: string; net: string }> = {
  INVOICE_CONFIRMED: { direction: "REVENUE", settlement: "4010", net: "9030" },
  INVOICE_CONFIRMED_PREPAID: { direction: "REVENUE", settlement: "6310", net: "9030" },
  INVOICE_CONFIRMED_GOODS: { direction: "REVENUE", settlement: "4010", net: "9020" },
  INVOICE_CONFIRMED_PREPAID_GOODS: { direction: "REVENUE", settlement: "6310", net: "9020" },
  SERVICE_RECEIVED: { direction: "EXPENSE", settlement: "6010", net: "9420" },
  SERVICE_RECEIVED_PREPAID: { direction: "EXPENSE", settlement: "4310", net: "9420" },
  GOODS_RECEIVED: { direction: "EXPENSE", settlement: "6010", net: "2910" },
  GOODS_RECEIVED_PREPAID: { direction: "EXPENSE", settlement: "4310", net: "2910" },
};

export function assertSoliqLedger(
  row: { rowId: string; direction: "REVENUE" | "EXPENSE"; amount: string; vatAmount: string },
  documentTypeCode: string,
  entries: { account: { code: string }; debit: { toString(): string }; credit: { toString(): string } }[],
) {
  const fail = () => { throw new SoliqBatchError(`Проводки строки Soliq ${row.rowId} не совпадают с реестром`); };
  const layout = layouts[documentTypeCode];
  if (!layout || layout.direction !== row.direction) return fail();
  const revenue = row.direction === "REVENUE";
  const expected = new Map([
    [layout.settlement, { debit: revenue ? new Decimal(row.amount).plus(row.vatAmount) : new Decimal(0), credit: revenue ? new Decimal(0) : new Decimal(row.amount).plus(row.vatAmount) }],
    [layout.net, { debit: revenue ? new Decimal(0) : new Decimal(row.amount), credit: revenue ? new Decimal(row.amount) : new Decimal(0) }],
    [revenue ? "6410" : "4410", { debit: revenue ? new Decimal(0) : new Decimal(row.vatAmount), credit: revenue ? new Decimal(row.vatAmount) : new Decimal(0) }],
  ]);
  for (const entry of entries) {
    const remaining = expected.get(entry.account.code);
    if (!remaining) return fail();
    const debit = new Decimal(entry.debit.toString());
    const credit = new Decimal(entry.credit.toString());
    if ([debit, credit].some(amount => !amount.isFinite() || amount.isNegative() || amount.decimalPlaces() > 2) ||
        (debit.gt(0) && credit.gt(0))) return fail();
    remaining.debit = remaining.debit.minus(debit);
    remaining.credit = remaining.credit.minus(credit);
  }
  if ([...expected.values()].some(amount => !amount.debit.isZero() || !amount.credit.isZero())) fail();
}
import { describe, expect, it } from "vitest";
import { assertSoliqLedger } from "@/lib/soliqLedger";
import { SoliqBatchError } from "@/lib/soliqBatch";

const row = { rowId: "1", direction: "REVENUE" as const, amount: "100.10", vatAmount: "12.01" };
const entry = (code: string, debit: string, credit: string) => ({ account: { code }, debit, credit });
const ledger = [entry("6310", "112.11", "0"), entry("9030", "0", "100.10"), entry("6410", "0", "12.01")];

describe("Soliq ledger controls", () => {
  it.each([
    { type: "INVOICE_CONFIRMED", settlement: "4010", net: "9030", revenue: true },
    { type: "INVOICE_CONFIRMED_PREPAID", settlement: "6310", net: "9030", revenue: true },
    { type: "INVOICE_CONFIRMED_GOODS", settlement: "4010", net: "9020", revenue: true },
    { type: "INVOICE_CONFIRMED_PREPAID_GOODS", settlement: "6310", net: "9020", revenue: true },
    { type: "SERVICE_RECEIVED", settlement: "6010", net: "9420", revenue: false },
    { type: "SERVICE_RECEIVED_PREPAID", settlement: "4310", net: "9420", revenue: false },
    { type: "GOODS_RECEIVED", settlement: "6010", net: "2910", revenue: false },
    { type: "GOODS_RECEIVED_PREPAID", settlement: "4310", net: "2910", revenue: false },
  ])("checks net, VAT and settlement for $type", ({ type, settlement, net, revenue }) => {
    const entries = revenue ? [entry(settlement, "112.11", "0"), entry(net, "0", "100.10"), entry("6410", "0", "12.01")]
      : [entry(net, "100.10", "0"), entry("4410", "12.01", "0"), entry(settlement, "0", "112.11")];
    expect(() => assertSoliqLedger({ ...row, direction: revenue ? "REVENUE" : "EXPENSE" }, type, entries)).not.toThrow();
  });

  it.each([
    { label: "missing ledger", entries: [] },
    { label: "missing VAT", entries: ledger.slice(0, 2) },
    { label: "VAT included in revenue", entries: [ledger[0], entry("9030", "0", "112.11")] },
    { label: "wrong settlement", entries: [entry("4010", "112.11", "0"), ...ledger.slice(1)] },
    { label: "balanced unrelated turnover", entries: [...ledger, entry("5110", "5", "0"), entry("9030", "0", "5")] },
    { label: "negative reversal", entries: [...ledger, entry("9030", "-1", "-1")] },
    { label: "excess precision", entries: [...ledger, entry("9030", "0", "0.001")] },
    { label: "nonfinite amount", entries: [...ledger, entry("9030", "0", "NaN")] },
  ])("refuses $label", ({ entries }) => {
    expect(() => assertSoliqLedger(row, "INVOICE_CONFIRMED_PREPAID", entries)).toThrow(SoliqBatchError);
  });

  it("allows a missing zero VAT line without rounding large cents", () => {
    expect(() => assertSoliqLedger({ ...row, amount: "70368744177664.01", vatAmount: "0.00" }, "INVOICE_CONFIRMED_PREPAID", [
      entry("6310", "70368744177664.01", "0"), entry("9030", "0", "70368744177664.01"),
    ])).not.toThrow();
  });

  it("refuses a different direction or unsupported type", () => {
    expect(() => assertSoliqLedger(row, "SERVICE_RECEIVED", ledger)).toThrow(SoliqBatchError);
    expect(() => assertSoliqLedger(row, "UNKNOWN", ledger)).toThrow(SoliqBatchError);
  });
});
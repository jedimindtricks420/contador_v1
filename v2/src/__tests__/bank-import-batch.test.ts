import { describe, expect, it } from "vitest";
import { bankSourceHash, buildBankImportSource } from "@/lib/bankImportBatch";
import type { ParsedBankStatement } from "@/lib/parsers/types";

const statement = (): ParsedBankStatement => ({
  accountNumber: "00000000000000000001", openingBalance: "9007199254740993.27", closingBalance: "9007199254740993.30",
  periodStart: new Date("2026-09-01T00:00:00Z"), periodEnd: new Date("2026-09-30T00:00:00Z"),
  transactions: [
    { date: new Date("2026-09-10T00:00:00Z"), amount: "0.10", direction: "CREDIT", description: "Synthetic incoming" },
    { date: new Date("2026-09-11T00:00:00Z"), amount: "0.07", direction: "DEBIT", description: "Synthetic outgoing" },
  ],
});

describe("bank import source contract", () => {
  it("archives source currency and document references without changing their meaning", () => {
    const parsed = statement();
    parsed.currency = "USD";
    parsed.transactions[0].bankDocumentNumber = "00012";
    parsed.transactions[0].payerAccountNumber = "00000000000000000002";
    parsed.transactions[0].recipientAccountNumber = parsed.accountNumber;
    const source = buildBankImportSource(Buffer.from("source"), "bank.txt", parsed);
    expect(source.parserVersion).toBe("1c-bank-v2");
    expect(source.statement.currency).toBe("USD");
    expect(source.rows[0]).toMatchObject({ bankDocumentNumber: "00012", payerAccountNumber: "00000000000000000002", recipientAccountNumber: parsed.accountNumber });
  });

  it("retains original bytes, numbered rows and exact controls above Number precision", () => {
    const bytes = Buffer.from([0xc0, 0xc1, 0x0d, 0x0a]);
    const source = buildBankImportSource(bytes, "statement.txt", statement());
    expect(source.sourceData).toEqual(bytes);
    expect(source.sourceHash).toBe(bankSourceHash(bytes));
    expect(source.statement).toMatchObject({ openingBalance: "9007199254740993.27", closingBalance: "9007199254740993.30", credits: "0.10", debits: "0.07", rowCount: 2 });
    expect(source.rows.map(row => [row.rowNumber, row.amount])).toEqual([[1, "0.10"], [2, "0.07"]]);
    bytes.fill(0);
    expect(source.sourceHash).toBe(bankSourceHash(source.sourceData));
    expect(source.sourceHash).not.toBe(bankSourceHash(bytes));
  });

  it("does not include path or control characters in the stored filename", () => {
    expect(buildBankImportSource(Buffer.from("source"), "C:\\private\\bank\r\n.txt", statement()).sourceName).toBe("bank.txt");
  });

  it.each(["openingBalance", "closingBalance", "periodStart", "periodEnd", "accountNumber"] as const)("rejects missing %s", field => {
    const parsed = statement();
    delete parsed[field];
    expect(() => buildBankImportSource(Buffer.from("source"), "bank.txt", parsed)).toThrow("Неполный исходный снимок");
  });

  it("rejects inconsistent controls instead of storing a partial protocol", () => {
    expect(() => buildBankImportSource(Buffer.from("source"), "bank.txt", { ...statement(), closingBalance: "9007199254740993.31" }))
      .toThrow("Контрольные итоги");
  });

  it("rejects a row outside the statement period", () => {
    const parsed = statement();
    parsed.transactions[0].date = new Date("2026-08-31T00:00:00Z");
    expect(() => buildBankImportSource(Buffer.from("source"), "bank.txt", parsed)).toThrow("Некорректная строка");
  });

  it("retains signed balances without rounding row amounts", () => {
    const source = buildBankImportSource(Buffer.from("source"), "bank.txt", { ...statement(), openingBalance: "-0.10", closingBalance: "-0.07" });
    expect(source.statement).toMatchObject({ openingBalance: "-0.10", closingBalance: "-0.07" });
    const parsed = statement();
    parsed.transactions[0].amount = "0.101";
    expect(() => buildBankImportSource(Buffer.from("source"), "bank.txt", parsed)).toThrow();
  });
});
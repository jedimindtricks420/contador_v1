import { describe, expect, it } from "vitest";
import { BANK_STATEMENT_MAX_LINES, BANK_STATEMENT_MAX_TRANSACTIONS, parse1CExchange } from "@/lib/parsers/parser1c";
import { assertStatementAccount, BankStatementValidationError } from "@/lib/bankStatementValidation";

const ownAccount = "00000000000000000001";
const otherAccount = "00000000000000000002";
const thirdAccount = "00000000000000000003";
const statement = (overrides: Record<string, string> = {}, metadata = "") => [
  "1CClientBankExchange", `РасчСчет=${ownAccount}`, "СекцияРасчСчет",
  `РасчСчет=${ownAccount}`, "ДатаНачала=01.09.2026", "ДатаКонца=30.09.2026",
  "НачальныйОстаток=100.00", "КонечныйОстаток=100.10",
  "КонецРасчСчет", metadata, "СекцияДокумент=Платежное поручение",
  ...Object.entries({
    Дата: "10.09.2026", Сумма: "0,10", ПлательщикРасчСчет: otherAccount,
    ПолучательРасчСчет: ownAccount, НазначениеПлатежа: "Synthetic payment", ...overrides,
  }).map(([name, value]) => `${name}=${value}`),
  "КонецДокумента", "КонецФайла",
].join("\n");

describe("bank source identity and dates", () => {
  it("preserves document numbers and both bank accounts", () => {
    expect(parse1CExchange(statement({ Номер: "000012" })).transactions[0]).toMatchObject({
      bankDocumentNumber: "000012", payerAccountNumber: otherAccount, recipientAccountNumber: ownAccount,
    });
  });

  it.each([["860", "UZS"], ["usd", "USD"], ["978", "EUR"], ["643", "RUB"]])("normalizes explicit currency %s", (value, expected) => {
    expect(parse1CExchange(statement({}, `Валюта=${value}`)).currency).toBe(expected);
  });

  it("does not invent a currency when the file does not declare it", () => {
    expect(parse1CExchange(statement()).currency).toBeUndefined();
  });

  it.each(["", "000", "US", "USD RUB"])('rejects invalid currency "%s"', currency => {
    expect(() => parse1CExchange(statement({}, `Валюта=${currency}`))).toThrow(BankStatementValidationError);
  });

  it("rejects conflicting header and document currencies", () => {
    expect(() => parse1CExchange(statement({ КодВалюты: "840" }, "Валюта=UZS"))).toThrow(BankStatementValidationError);
  });

  it.each(["", "1".repeat(129), "12\u0000"])('rejects malformed document number "%s"', number => {
    expect(() => parse1CExchange(statement({ Номер: number }))).toThrow(BankStatementValidationError);
  });

  it.each(["string", "utf8"])("parses an unambiguous incoming operation from %s", encoding => {
    const text = statement();
    const result = parse1CExchange(encoding === "utf8" ? Buffer.from(text, "utf8") : text);
    expect(result.accountNumber).toBe(ownAccount);
    expect(result.transactions).toEqual([expect.objectContaining({ direction: "CREDIT", amount: "0.10", date: new Date("2026-09-10T00:00:00Z") })]);
  });

  it("parses an outgoing operation only when our account is the payer", () => {
    const text = statement({ ПлательщикРасчСчет: ownAccount, ПолучательРасчСчет: otherAccount }).replace("КонечныйОстаток=100.10", "КонечныйОстаток=99.90");
    expect(parse1CExchange(text).transactions[0].direction).toBe("DEBIT");
  });

  it("retains support for Windows-1251 statement bytes", () => {
    const decoder = new TextDecoder("windows-1251");
    const bytes = new Map(Array.from({ length: 256 }, (_, value) => [decoder.decode(Uint8Array.of(value)), value]));
    const input = Buffer.from([...statement()].map(character => bytes.get(character)!));
    expect(parse1CExchange(input)).toEqual(parse1CExchange(statement()));
  });

  it.each([
    { ПлательщикРасчСчет: thirdAccount, ПолучательРасчСчет: otherAccount },
    { ПлательщикРасчСчет: ownAccount, ПолучательРасчСчет: ownAccount },
    { ПлательщикРасчСчет: "", ПолучательРасчСчет: ownAccount },
    { ПлательщикРасчСчет: otherAccount, ПолучательРасчСчет: "unknown" },
  ])("refuses ambiguous accounts: %j", overrides => {
    expect(() => parse1CExchange(statement(overrides))).toThrow(BankStatementValidationError);
  });

  it("refuses multiple statement account numbers", () => {
    expect(() => parse1CExchange(statement({}, `РасчСчет=${otherAccount}`))).toThrow(BankStatementValidationError);
  });

  it("refuses a statement with no own account", () => {
    expect(() => parse1CExchange(statement().replaceAll(`РасчСчет=${ownAccount}\n`, ""))).toThrow(BankStatementValidationError);
  });

  it.each(["31.09.2026", "29.02.2026", "00.09.2026", "10.13.2026", "2026-09-10", "", "10.09.26"])("refuses date %s without dropping the row", date => {
    expect(() => parse1CExchange(statement({ Дата: date }))).toThrow(BankStatementValidationError);
  });

  it.each(["31.08.2026", "01.10.2026"])("refuses a transaction outside the statement period: %s", date => {
    expect(() => parse1CExchange(statement({ Дата: date }))).toThrow(BankStatementValidationError);
  });

  it("accepts a leap day in the stated period", () => {
    const text = statement({ Дата: "29.02.2024" }).replace("01.09.2026", "01.02.2024").replace("30.09.2026", "29.02.2024");
    expect(parse1CExchange(text).transactions[0].date.toISOString()).toBe("2024-02-29T00:00:00.000Z");
  });

  it("refuses a reversed statement period", () => {
    expect(() => parse1CExchange(statement().replace("01.09.2026", "30.09.2026").replace("ДатаКонца=30.09.2026", "ДатаКонца=01.09.2026"))).toThrow(BankStatementValidationError);
  });

  it("refuses a truncated document instead of returning a partial statement", () => {
    expect(() => parse1CExchange(statement().replace("КонецДокумента", ""))).toThrow(BankStatementValidationError);
  });

  it.each([null, "", "1e19", "0000000000000000000a", "000000000000000000001"])("refuses an invalid bank number %s", value => {
    expect(() => assertStatementAccount(ownAccount, value)).toThrow(BankStatementValidationError);
  });

  it("preserves leading zeros while normalizing spacing", () => {
    expect(assertStatementAccount("00000 00000 00000 00001", ownAccount)).toBe(ownAccount);
  });

  it.each(["100abc", "1e3", "0", "-0.10", "NaN", "Infinity", "1,000.50", "0.001", "1 00", "1000000000000000000", ""])("refuses malformed amount %s", amount => {
    expect(() => parse1CExchange(statement({ Сумма: amount }))).toThrow(BankStatementValidationError);
  });

  it("keeps large monetary values as exact strings", () => {
    const text = statement({ Сумма: "9 007 199 254 740 993,27" })
      .replace("НачальныйОстаток=100.00", "НачальныйОстаток=0")
      .replace("КонечныйОстаток=100.10", "КонечныйОстаток=9007199254740993.27");
    expect(parse1CExchange(text)).toMatchObject({
      openingBalance: "0.00", closingBalance: "9007199254740993.27",
      transactions: [expect.objectContaining({ amount: "9007199254740993.27" })],
    });
  });

  it("retains negative control balances", () => {
    const text = statement().replace("НачальныйОстаток=100.00", "НачальныйОстаток=-0.20").replace("КонечныйОстаток=100.10", "КонечныйОстаток=-0.10");
    expect(parse1CExchange(text)).toMatchObject({ openingBalance: "-0.20", closingBalance: "-0.10" });
  });

  it.each(["ДатаНачала=01.09.2026", "ДатаКонца=30.09.2026", "НачальныйОстаток=100.00", "КонечныйОстаток=100.10"])("refuses a missing control field %s", field => {
    expect(() => parse1CExchange(statement().replace(field, ""))).toThrow(BankStatementValidationError);
  });

  it("refuses a one-cent control discrepancy", () => {
    expect(() => parse1CExchange(statement().replace("КонечныйОстаток=100.10", "КонечныйОстаток=100.11"))).toThrow(BankStatementValidationError);
  });

  it("refuses duplicate monetary fields rather than overwriting", () => {
    expect(() => parse1CExchange(statement().replace("Сумма=0,10", "Сумма=0,10\nСумма=0,20"))).toThrow(BankStatementValidationError);
  });

  it("refuses malformed control balances instead of treating them as zero", () => {
    expect(() => parse1CExchange(statement().replace("НачальныйОстаток=100.00", "НачальныйОстаток=garbage"))).toThrow(BankStatementValidationError);
  });

  it.each(["\n", "\r\n"])("accepts the exact physical line limit with %j endings", newline => {
    const text = statement();
    const padded = (text + "\n".repeat(BANK_STATEMENT_MAX_LINES - text.split("\n").length)).replaceAll("\n", newline);
    expect(parse1CExchange(padded).transactions).toHaveLength(1);
    expect(() => parse1CExchange(padded + newline)).toThrow("50000 текстовых строк");
  });

  it.each([
    ["string", "СекцияДокумент="], ["buffer", "СекцияДокумент="],
    ["string", "СекцияДокумент \t="], ["buffer", "СекцияДокумент \t="],
  ])("accepts exactly the transaction limit but rejects one more in %s with %j", (inputType, sectionKey) => {
    const text = statement();
    const start = text.indexOf("СекцияДокумент=");
    const document = text.slice(start, text.indexOf("КонецФайла")).replace("СекцияДокумент=", sectionKey);
    const multiple = (count: number, balance: string) => {
      const result = text.slice(0, start).replace("КонечныйОстаток=100.10", `КонечныйОстаток=${balance}`) + document.repeat(count) + "КонецФайла";
      return inputType === "buffer" ? Buffer.from(result) : result;
    };
    expect(parse1CExchange(multiple(BANK_STATEMENT_MAX_TRANSACTIONS, "200.00")).transactions).toHaveLength(BANK_STATEMENT_MAX_TRANSACTIONS);
    expect(() => parse1CExchange(multiple(BANK_STATEMENT_MAX_TRANSACTIONS + 1, "200.10"))).toThrow("1000 операций");
  });
});
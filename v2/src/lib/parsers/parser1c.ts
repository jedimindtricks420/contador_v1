import { ParsedBankStatement, ParsedTransaction } from "./types";
import { BankStatementValidationError, normalizeBankAccountNumber, parseBankStatementMoney } from "../bankStatementValidation";

export const BANK_STATEMENT_MAX_TRANSACTIONS = 1_000;
export const BANK_STATEMENT_MAX_LINES = 50_000;

// Windows-1251 code points for bytes 0x80–0xFF
const CP1251_MAP = [
  0x0402,0x0403,0x201A,0x0453,0x201E,0x2026,0x2020,0x2021,
  0x20AC,0x2030,0x0409,0x2039,0x040A,0x040C,0x040B,0x040F,
  0x0452,0x2018,0x2019,0x201C,0x201D,0x2022,0x2013,0x2014,
  0x003F,0x2122,0x0459,0x203A,0x045A,0x045C,0x045B,0x045F,
  0x00A0,0x040E,0x045E,0x0408,0x00A4,0x0490,0x00A6,0x00A7,
  0x0401,0x00A9,0x0404,0x00AB,0x00AC,0x00AD,0x00AE,0x0407,
  0x00B0,0x00B1,0x0406,0x0456,0x0491,0x00B5,0x00B6,0x00B7,
  0x0451,0x2116,0x0454,0x00BB,0x0458,0x0405,0x0455,0x0457,
  // 0xC0–0xCF: А–П
  0x0410,0x0411,0x0412,0x0413,0x0414,0x0415,0x0416,0x0417,
  0x0418,0x0419,0x041A,0x041B,0x041C,0x041D,0x041E,0x041F,
  // 0xD0–0xDF: Р–Я
  0x0420,0x0421,0x0422,0x0423,0x0424,0x0425,0x0426,0x0427,
  0x0428,0x0429,0x042A,0x042B,0x042C,0x042D,0x042E,0x042F,
  // 0xE0–0xEF: а–п
  0x0430,0x0431,0x0432,0x0433,0x0434,0x0435,0x0436,0x0437,
  0x0438,0x0439,0x043A,0x043B,0x043C,0x043D,0x043E,0x043F,
  // 0xF0–0xFF: р–я
  0x0440,0x0441,0x0442,0x0443,0x0444,0x0445,0x0446,0x0447,
  0x0448,0x0449,0x044A,0x044B,0x044C,0x044D,0x044E,0x044F,
];

function decodeCP1251(buf: Buffer): string {
  const chars: string[] = [];
  for (let i = 0; i < buf.length; i++) {
    const b = buf[i];
    chars.push(b < 0x80 ? String.fromCharCode(b) : String.fromCharCode(CP1251_MAP[b - 0x80] ?? b));
  }
  return chars.join("");
}

/**
 * Parses a 1CClientBankExchange file (Windows-1251 encoded).
 *
 * Direction is resolved by comparing the account numbers:
 *   - header РасчСчет = our account
 *   - if ПолучательРасчСчет == ourAccount → CREDIT (money came in)
 *   - otherwise → DEBIT (money went out)
 *
 * Counterparty:
 *   - CREDIT: payer (Плательщик / ПлательщикИНН)
 *   - DEBIT:  recipient (Получатель / ПолучательИНН)
 */
export function parse1CExchange(input: string | Buffer): ParsedBankStatement {
  let text: string;
  if (Buffer.isBuffer(input)) {
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(input);
    } catch {
      text = decodeCP1251(input);
    }
  } else {
    text = input;
  }
  let lineCount = 1;
  for (let newline = text.indexOf("\n"); newline !== -1; newline = text.indexOf("\n", newline + 1)) {
    if (++lineCount > BANK_STATEMENT_MAX_LINES) {
      throw new BankStatementValidationError("Выписка 1С превышает лимит 50000 текстовых строк");
    }
  }
  const lines = text.split(/\r?\n/);
  const transactions: ParsedTransaction[] = [];

  // Statement-level metadata extracted from СекцияРасчСчет
  let ourAccount = "";
  let openingBalance: string | undefined;
  let closingBalance: string | undefined;
  let periodStart: Date | undefined;
  let periodEnd: Date | undefined;
  let currency: string | undefined;

  const recordCurrency = (value: string) => {
    const codes: Record<string, string> = { "860": "UZS", "840": "USD", "978": "EUR", "643": "RUB" };
    const normalized = codes[value] ?? value.toUpperCase();
    if (!/^[A-Z]{3}$/.test(normalized) || (currency && currency !== normalized)) {
      throw new BankStatementValidationError("Неоднозначная или неподдерживаемая валюта выписки 1С");
    }
    currency = normalized;
  };

  const accountNumbers = new Set<string>();
  let scanningDocument = false;
  let documentCount = 0;
  for (const line of lines) {
    const trimmed = line.trim();
    const separator = trimmed.indexOf("=");
    if (separator !== -1 && trimmed.slice(0, separator).trim() === "СекцияДокумент") {
      if (++documentCount > BANK_STATEMENT_MAX_TRANSACTIONS) {
        throw new BankStatementValidationError("Выписка 1С превышает лимит 1000 операций");
      }
      scanningDocument = true;
    }
    if (trimmed === "КонецДокумента") scanningDocument = false;
    if (!scanningDocument && trimmed.startsWith("РасчСчет=")) {
      const account = normalizeBankAccountNumber(trimmed.slice("РасчСчет=".length));
      if (!account) throw new BankStatementValidationError("Некорректный номер счёта в выписке 1С");
      accountNumbers.add(account);
    }
  }
  if (accountNumbers.size !== 1) throw new BankStatementValidationError("Выписка 1С должна содержать ровно один банковский счёт");
  ourAccount = [...accountNumbers][0];

  const parseDate = (value: string): Date => {
    const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(value);
    if (!match) throw new BankStatementValidationError("Некорректная дата в выписке 1С");
    const isoDate = `${match[3]}-${match[2]}-${match[1]}`;
    const date = new Date(`${isoDate}T00:00:00Z`);
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== isoDate) {
      throw new BankStatementValidationError("Невозможная дата в выписке 1С");
    }
    return date;
  };

  let current: Record<string, string> = {};
  let inSection = false;
  let inAccSection = false;
  let accountSectionCount = 0;
  const accountFields = new Set<string>();

  for (const line of lines) {
    const eqIdx = line.indexOf("=");
    if (eqIdx === -1) {
      const k = line.trim();

      // Parse bank account section for opening/closing balances
      if (k === "СекцияРасчСчет") {
        if (inSection || ++accountSectionCount > 1) throw new BankStatementValidationError("Неоднозначные секции счёта в выписке 1С");
        inAccSection = true;
        continue;
      }
      if (k === "КонецРасчСчет" && inAccSection) {
        inAccSection = false;
        continue;
      }

      if (k === "КонецДокумента" && inSection) {
        inSection = false;

        const amount = parseBankStatementMoney(current["Сумма"] || "");
        const dateStr = current["Дата"] || "";
        const date = parseDate(dateStr);

        const recipientAccount = normalizeBankAccountNumber(current["ПолучательРасчСчет"] || current["ПолучательСчет"]);
        const payerAccount = normalizeBankAccountNumber(current["ПлательщикРасчСчет"] || current["ПлательщикСчет"]);
        const isCredit = recipientAccount === ourAccount;
        const isDebit = payerAccount === ourAccount;
        if (!recipientAccount || !payerAccount || isCredit === isDebit) {
          throw new BankStatementValidationError("Нельзя однозначно определить направление операции по счетам выписки 1С");
        }

        const direction: "CREDIT" | "DEBIT" = isCredit ? "CREDIT" : "DEBIT";

        let counterpartyHint: string | undefined;
        let counterpartyInn: string | undefined;

        if (isCredit) {
          // Money came from payer
          counterpartyHint = current["Плательщик"] || undefined;
          counterpartyInn = current["ПлательщикИНН"] || undefined;
        } else {
          // Money went to recipient
          counterpartyHint = current["Получатель"] || undefined;
          counterpartyInn = current["ПолучательИНН"] || undefined;
        }

        // Strip "ИНН 123456789 " prefix that some banks include in the name field
        if (counterpartyHint) {
          counterpartyHint = counterpartyHint.replace(/^ИНН\s+\d+\s+/i, "").trim() || undefined;
        }
        // Normalise INN: digits only, skip all-zeros placeholder
        if (counterpartyInn) {
          counterpartyInn = counterpartyInn.replace(/\D/g, "");
          if (/^0+$/.test(counterpartyInn)) counterpartyInn = undefined;
        }

        const description = current["НазначениеПлатежа"] || current["Назначение"] || "";
        const bankDocumentNumber = current["Номер"];
        if (bankDocumentNumber !== undefined && (!bankDocumentNumber || bankDocumentNumber.length > 128 || /[\u0000-\u001f\u007f]/.test(bankDocumentNumber))) {
          throw new BankStatementValidationError("Некорректный номер документа выписки 1С");
        }

        let finalCounterpartyHint = counterpartyHint || undefined;
        let finalCounterpartyInn = counterpartyInn || undefined;

        // Smart extraction for Transit/Exchange/Treasury
        const innRegex = /(?:ИНН|СТИР|INN)\s*:?\s*(\d{9,14})\b(?:\s*\(([^)]+)\))?/i;
        const match = description.match(innRegex);
        if (match) {
          finalCounterpartyInn = match[1];
          if (match[2]) {
            finalCounterpartyHint = match[2].trim();
          }
        }

        transactions.push({
          date,
          amount,
          direction,
          description,
          counterpartyHint: finalCounterpartyHint,
          counterpartyInn: finalCounterpartyInn,
          bankDocumentNumber,
          payerAccountNumber: payerAccount,
          recipientAccountNumber: recipientAccount,
        });

        current = {};
      }
      continue;
    }

    const k = line.slice(0, eqIdx).trim();
    const v = line.slice(eqIdx + 1).trim();
    if (k === "Валюта" || k === "КодВалюты") recordCurrency(v);

    if (k === "СекцияДокумент") {
      if (inSection || inAccSection) throw new BankStatementValidationError("Незавершённая секция в выписке 1С");
      inSection = true;
      current = {};
    } else if (inAccSection) {
      if (accountFields.has(k)) throw new BankStatementValidationError("Повторный реквизит секции счёта в выписке 1С");
      accountFields.add(k);
      // Balance section: НачальныйОстаток, КонечныйОстаток, ДатаНачала, ДатаКонца
      if (k === "НачальныйОстаток") {
        openingBalance = parseBankStatementMoney(v, true);
      } else if (k === "КонечныйОстаток") {
        closingBalance = parseBankStatementMoney(v, true);
      } else if (k === "ДатаНачала") {
        periodStart = parseDate(v);
      } else if (k === "ДатаКонца") {
        periodEnd = parseDate(v);
      } else if (k === "РасчСчет" && !ourAccount) {
        ourAccount = v;
      }
    } else if (inSection) {
      if (Object.hasOwn(current, k)) throw new BankStatementValidationError("Повторный реквизит документа в выписке 1С");
      current[k] = v;
    }
  }

  if (inSection || inAccSection) throw new BankStatementValidationError("Незавершённая секция в выписке 1С");
  if (!periodStart || !periodEnd || openingBalance === undefined || closingBalance === undefined) {
    throw new BankStatementValidationError("Выписка 1С должна содержать период и оба контрольных остатка");
  }
  if (periodStart && periodEnd && periodStart > periodEnd) throw new BankStatementValidationError("Обратный период выписки 1С");
  if (transactions.some(transaction => (periodStart && transaction.date < periodStart) || (periodEnd && transaction.date > periodEnd))) {
    throw new BankStatementValidationError("Операция находится вне периода выписки 1С");
  }
  let expectedClosing = BigInt(openingBalance.replace(".", ""));
  for (const transaction of transactions) {
    const amountCents = BigInt(String(transaction.amount).replace(".", ""));
    expectedClosing += transaction.direction === "CREDIT" ? amountCents : -amountCents;
  }
  if (expectedClosing !== BigInt(closingBalance.replace(".", ""))) {
    throw new BankStatementValidationError("Контрольные остатки выписки не согласуются с её операциями");
  }
  return { transactions, openingBalance, closingBalance, periodStart, periodEnd, accountNumber: ourAccount || undefined, currency };
}

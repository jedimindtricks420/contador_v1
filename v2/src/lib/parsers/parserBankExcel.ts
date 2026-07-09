import * as XLSX from "xlsx";
import { ParsedBankStatement, ParsedTransaction } from "./types";

function parseExcelDate(val: any): Date | null {
  if (val instanceof Date) return val;
  if (typeof val === "number") {
    // Convert Excel serial date to JS Date
    // Excel bug: considers 1900 a leap year, so there is a 2-day offset depending on epoch
    const date = new Date(Math.round((val - 25569) * 86400 * 1000));
    return date;
  }
  if (typeof val === "string") {
    const trimmed = val.trim();
    // Match DD.MM.YYYY or DD/MM/YYYY
    const dots = trimmed.split(/[\.\/]/);
    if (dots.length === 3) {
      const day = parseInt(dots[0], 10);
      const month = parseInt(dots[1], 10);
      const year = parseInt(dots[2], 10);
      if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
        return new Date(year, month - 1, day);
      }
    }
    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) return parsed;
  }
  return null;
}

function parseExcelAmount(val: any): number {
  if (typeof val === "number") return Math.abs(val);
  if (typeof val === "string") {
    const cleaned = val.replace(/\s/g, "").replace(/,/g, ".").replace(/[^\d\.\-]/g, "");
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : Math.abs(parsed);
  }
  return 0;
}

// Detects a negative amount for direction inference on single-amount-column
// statements. Uses the SAME set of common accounting notations a real bank
// export might use — plain leading/trailing minus, unicode minus variants
// (−/‐/–/—, sometimes produced by Excel autocorrect or non-Latin locales), and
// parenthesised negatives ("(1 234.56)", a standard accounting convention).
// Previously this used a separate, weaker parseFloat() on a less-cleaned string
// than parseExcelAmount() above — any of these notations would silently fail to
// parse as negative and fall through to a DEBIT default regardless of the real sign.
function isNegativeExcelAmount(val: any): boolean {
  if (typeof val === "number") return val < 0;
  if (typeof val === "string") {
    const trimmed = val.trim();
    if (!trimmed) return false;
    if (/^\(.*\)$/.test(trimmed)) return true;
    const normalized = trimmed.replace(/[−‒–—]/g, "-");
    return normalized.startsWith("-") || normalized.endsWith("-");
  }
  return false;
}

export function parseBankExcel(buffer: Buffer): ParsedBankStatement {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

  // Column keywords for mapping
  const dateKeywords = ["дата", "date", "операция куни", "дата док"];
  const descKeywords = ["назначение", "назначение платежа", "детали", "description", "details", "тўлов мақсади"];
  const debitKeywords = ["дебет", "debit", "расход", "выплата", "чиқиш", "списание"];
  const creditKeywords = ["кредит", "credit", "приход", "зачисление", "кириш", "поступление"];
  const amountKeywords = ["сумма", "amount", "сум"];
  const innKeywords = ["инн", "inn", "стир"];
  const partyKeywords = ["контрагент", "наименование", "получатель", "плательщик", "клиент", "counterparty", "name", "мижоз"];

  let headerRowIndex = -1;
  let colIndices = {
    date: -1,
    desc: -1,
    debit: -1,
    credit: -1,
    amount: -1,
    inn: -1,
    party: -1,
  };

  // 1. Search for header row
  for (let i = 0; i < Math.min(rows.length, 50); i++) {
    const row = rows[i];
    if (!row || !Array.isArray(row)) continue;

    let matches = 0;
    const tempColIndices = { date: -1, desc: -1, debit: -1, credit: -1, amount: -1, inn: -1, party: -1 };

    for (let c = 0; c < row.length; c++) {
      const cellVal = String(row[c] || "").toLowerCase().trim();
      if (!cellVal) continue;

      if (dateKeywords.some(k => cellVal.includes(k)) && tempColIndices.date === -1) {
        tempColIndices.date = c;
        matches++;
      } else if (descKeywords.some(k => cellVal.includes(k)) && tempColIndices.desc === -1) {
        tempColIndices.desc = c;
        matches++;
      } else if (debitKeywords.some(k => cellVal.includes(k)) && tempColIndices.debit === -1) {
        tempColIndices.debit = c;
        matches++;
      } else if (creditKeywords.some(k => cellVal.includes(k)) && tempColIndices.credit === -1) {
        tempColIndices.credit = c;
        matches++;
      } else if (amountKeywords.some(k => cellVal.includes(k)) && tempColIndices.amount === -1) {
        tempColIndices.amount = c;
        matches++;
      } else if (innKeywords.some(k => cellVal.includes(k)) && tempColIndices.inn === -1) {
        tempColIndices.inn = c;
        matches++;
      } else if (partyKeywords.some(k => cellVal.includes(k)) && tempColIndices.party === -1) {
        tempColIndices.party = c;
        matches++;
      }
    }

    // If we match Date and at least one amount field or description, we found the header
    if (tempColIndices.date !== -1 && (tempColIndices.amount !== -1 || (tempColIndices.debit !== -1 && tempColIndices.credit !== -1) || tempColIndices.desc !== -1)) {
      headerRowIndex = i;
      colIndices = tempColIndices;
      break;
    }
  }

  // Fallback: If no header found, use default indices
  if (headerRowIndex === -1) {
    headerRowIndex = 0;
    colIndices = {
      date: 0,
      amount: 1,
      debit: 2,
      credit: 3,
      desc: 4,
      inn: 5,
      party: 6,
    };
  }

  const transactions: ParsedTransaction[] = [];
  let openingBalance: number | undefined;
  let closingBalance: number | undefined;

  // Scan pre-header rows for balance lines: "Остаток на начало" / "Остаток на конец" etc.
  const openingKeywords = ["остаток на начало", "начальный остаток", "opening balance", "бошланғич қолдиқ"];
  const closingKeywords = ["остаток на конец", "конечный остаток", "closing balance", "якуний қолдиқ"];
  for (let i = 0; i < Math.min(rows.length, headerRowIndex + 2); i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;
    const firstCell = String(row[0] || "").toLowerCase().trim();
    if (openingKeywords.some(k => firstCell.includes(k))) {
      const amtCell = row.find((c: any) => typeof c === "number" || (typeof c === "string" && parseFloat(c.replace(/\s/g, "").replace(",", ".")) > 0));
      if (amtCell !== undefined) openingBalance = Math.abs(parseFloat(String(amtCell).replace(/\s/g, "").replace(",", ".")));
    } else if (closingKeywords.some(k => firstCell.includes(k))) {
      const amtCell = row.find((c: any) => typeof c === "number" || (typeof c === "string" && parseFloat(c.replace(/\s/g, "").replace(",", ".")) > 0));
      if (amtCell !== undefined) closingBalance = Math.abs(parseFloat(String(amtCell).replace(/\s/g, "").replace(",", ".")));
    }
  }

  // 2. Parse data rows after header row
  for (let i = headerRowIndex + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const dateVal = row[colIndices.date];
    const date = parseExcelDate(dateVal);
    if (!date) continue; // Skip rows without valid dates

    let amount = 0;
    let direction: "CREDIT" | "DEBIT" = "DEBIT";

    if (colIndices.debit !== -1 && colIndices.credit !== -1) {
      // Split debit / credit columns
      const debVal = row[colIndices.debit];
      const credVal = row[colIndices.credit];
      const debAmt = parseExcelAmount(debVal);
      const credAmt = parseExcelAmount(credVal);

      if (credAmt > 0) {
        amount = credAmt;
        direction = "CREDIT";
      } else if (debAmt > 0) {
        amount = debAmt;
        direction = "DEBIT";
      } else {
        // Skip if both are zero/empty
        continue;
      }
    } else if (colIndices.amount !== -1) {
      // Single amount column
      const amtVal = row[colIndices.amount];
      amount = parseExcelAmount(amtVal);
      if (amount === 0) continue;

      // Detect direction by sign — negative (including parentheses/unicode-minus
      // notations) is DEBIT (money out), anything else is CREDIT (money in).
      if (!isNegativeExcelAmount(amtVal)) {
        direction = "CREDIT";
      } else {
        direction = "DEBIT";
      }
    } else {
      // No amount column mapping found
      continue;
    }

    const description = String(colIndices.desc !== -1 ? row[colIndices.desc] || "" : "").trim();
    const counterpartyHint = String(colIndices.party !== -1 ? row[colIndices.party] || "" : "").trim();
    const counterpartyInnVal = colIndices.inn !== -1 ? row[colIndices.inn] : undefined;
    const counterpartyInn = counterpartyInnVal ? String(counterpartyInnVal).trim().replace(/[^\d]/g, "") : undefined;

    let finalCounterpartyHint = counterpartyHint || undefined;
    let finalCounterpartyInn = counterpartyInn || undefined;

    // Smart extraction for Transit/Exchange/Treasury
    // Look for INN/СТИР in description: e.g. "ИНН: 200981397(Министерство иностранных дел РУз)"
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
    });
  }

  return { transactions, openingBalance, closingBalance };
}

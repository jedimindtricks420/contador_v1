import * as XLSX from "xlsx";
import Decimal from "decimal.js";
import { tashkentDate } from "@/lib/accountingDate";

export class SoliqParseError extends Error {}

export interface SoliqEsf {
  date: Date;
  inn: string;
  counterpartyName: string;
  amount: number;     // amount without VAT
  vatAmount: number;
  direction: "EXPENSE" | "REVENUE";
}

export interface SoliqTaxSummary {
  vat: number;         // net VAT payable = outputVat - inputVat
  outputVat: number;   // VAT from sales (list02)
  inputVat: number;    // VAT from purchases (list01)
  turnoverTax: number;
  incomeTax: number;
}

export interface SoliqParsedData {
  expenses: SoliqEsf[];  // list01: purchase invoices (расходы)
  revenues: SoliqEsf[];  // list02: sales invoices (выручка)
  esfItems: SoliqEsf[];  // all items combined (backwards compat)
  taxSummary: SoliqTaxSummary;
  // The Soliq template structure was found (column-number row 1,2,3…) even if
  // no invoice rows carried data — distinguishes an empty registry from an
  // unrecognized file format.
  templateRecognized: boolean;
}

function parseExcelDate(val: any): Date | null {
  let year: number;
  let month: number;
  let day: number;
  if (typeof val === "number") {
    const parts = Number.isFinite(val) && XLSX.SSF.parse_date_code(val);
    if (!parts) return null;
    year = parts.y; month = parts.m; day = parts.d;
  } else if (typeof val === "string") {
    const local = /^(\d{2})[./](\d{2})[./](\d{4})$/.exec(val.trim());
    const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(val.trim());
    if (local) { day = Number(local[1]); month = Number(local[2]); year = Number(local[3]); }
    else if (iso) { year = Number(iso[1]); month = Number(iso[2]); day = Number(iso[3]); }
    else return null;
  } else return null;
  if (year < 1900 || year > 9999 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = tashkentDate(year, month - 1, day);
  const local = new Date(date.getTime() + 5 * 60 * 60 * 1000);
  return local.getUTCFullYear() === year && local.getUTCMonth() + 1 === month && local.getUTCDate() === day ? date : null;
}

function parseExcelAmount(val: any, location: string): number {
  if (val === "" || val === null || val === undefined) return 0;
  const text = typeof val === "string" ? val.trim().replace(/[\s\u00a0]/g, "").replace(/,/g, ".") : String(val);
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) throw new SoliqParseError(`${location}: некорректная сумма`);
  const amount = new Decimal(text);
  if (amount.times(100).gt(Number.MAX_SAFE_INTEGER)) {
    throw new SoliqParseError(`${location}: сумма вне допустимого диапазона`);
  }
  return amount.toNumber();
}

// Find the row that contains sequential column-number labels [1, 2, 3, 4, ...].
// Data rows start after this row. Soliq templates always include this row.
// Returns -1 when the numbering row is absent (file is not a Soliq template).
function findNumberingRow(rows: any[][]): number {
  for (let i = 0; i < Math.min(rows.length, 25); i++) {
    const row = rows[i];
    if (!row || !Array.isArray(row)) continue;
    const nums = row.filter(c => typeof c === "number" && c >= 1 && c <= 20);
    if (nums.length >= 4) {
      const sorted = [...nums].sort((a, b) => a - b);
      if (sorted[0] === 1 && sorted.every((n, j) => n === j + 1)) {
        return i;
      }
    }
  }
  return -1;
}

const FALLBACK_DATA_START = 14; // Soliq header is always 14 rows

interface SheetParseResult {
  items: SoliqEsf[];
  recognized: boolean; // numbering row found — the sheet is a Soliq template
}

// Soliq .xltx files declare a truncated dimension (e.g. "A1:K14") that makes
// XLSX.sheet_to_json stop before the actual data rows (15+). Expand to read everything.
function expandRef(sheet: XLSX.WorkSheet): void {
  const ref = sheet["!ref"];
  if (!ref) return;
  const range = XLSX.utils.decode_range(ref);
  if (range.e.r > 10000 || range.e.c > 100) throw new SoliqParseError("Лист Soliq превышает допустимый размер");
  range.e.r = Math.max(range.e.r, 10000);
  range.e.c = Math.max(range.e.c, 25);
  sheet["!ref"] = XLSX.utils.encode_range(range);
}

// list01 — Приложение 4, Таблица 1: purchase invoices (расходы)
// Range starts at column B. Array offsets:
//   [0]=№  [1]=supplier_name  [2]=supplier_inn  [3]=invoice_no  [4]=date
//   [5]=amount_ex_vat  [6]=vat_amount
function parseExpenseSheet(sheet: XLSX.WorkSheet): SheetParseResult {
  expandRef(sheet);
  const firstRow = sheet["!ref"] ? XLSX.utils.decode_range(sheet["!ref"]).s.r : 0;
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" }) as any[][];
  const numberingRow = findNumberingRow(rows);
  const dataStart = numberingRow !== -1 ? numberingRow + 1 : FALLBACK_DATA_START;
  const items: SoliqEsf[] = [];

  for (let i = dataStart; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !row.some(c => c !== "")) continue;

    // Row number is at index 0; non-numeric means ИТОГО or a subheader — skip
    const num = row[0];
    if (typeof num !== "number" || num < 1) continue;

    if (row.slice(1, 7).every(value => value === "")) continue;
    const location = `list01, строка ${firstRow + i + 1}`;
    const inn = String(row[2] || "").trim();
    if (!/^\d{9}(?:\d{5})?$/.test(inn)) throw new SoliqParseError(`${location}: некорректный ИНН`);
    const date = parseExcelDate(row[4]);
    if (!date) throw new SoliqParseError(`${location}: некорректная дата`);
    const amount = parseExcelAmount(row[5], location);
    const vat = parseExcelAmount(row[6], location);
    if (amount === 0 && vat === 0) continue;

    items.push({
      date,
      inn,
      counterpartyName: String(row[1] || "").trim(),
      amount,
      vatAmount: vat,
      direction: "EXPENSE",
    });
  }
  return { items, recognized: numberingRow !== -1 };
}

// list02 — Приложение 4, Таблица 2: sales invoices (выручка)
// Range starts at column A (col A is always empty). Array offsets:
//   [0]=empty  [1]=№  [2]=buyer_name  [3]=buyer_inn  [4]=invoice_no  [5]=date
//   [6]=amount_ex_vat  [7]=vat_amount  [8]=amount_with_vat
function parseRevenueSheet(sheet: XLSX.WorkSheet): SheetParseResult {
  expandRef(sheet);
  const firstRow = sheet["!ref"] ? XLSX.utils.decode_range(sheet["!ref"]).s.r : 0;
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" }) as any[][];
  const numberingRow = findNumberingRow(rows);
  const dataStart = numberingRow !== -1 ? numberingRow + 1 : FALLBACK_DATA_START;
  const items: SoliqEsf[] = [];

  for (let i = dataStart; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !row.some(c => c !== "")) continue;

    // Row number is at index 1 for list02 (col B)
    const num = row[1];
    if (typeof num !== "number" || num < 1) continue;

    if (row.slice(2, 9).every(value => value === "")) continue;
    const location = `list02, строка ${firstRow + i + 1}`;
    const inn = String(row[3] || "").trim();
    if (!/^\d{9}(?:\d{5})?$/.test(inn)) throw new SoliqParseError(`${location}: некорректный ИНН`);
    const date = parseExcelDate(row[5]);
    if (!date) throw new SoliqParseError(`${location}: некорректная дата`);
    const amount = parseExcelAmount(row[6], location);
    const totalWithVat = parseExcelAmount(row[8], location);
    const suppliedVat = parseExcelAmount(row[7], location);
    const hasTotal = row[8] !== "" && row[8] !== undefined && row[8] !== null;
    const vatDecimal = hasTotal ? new Decimal(totalWithVat).minus(amount) : new Decimal(suppliedVat);
    if (vatDecimal.lt(0) || (row[7] !== "" && row[7] !== undefined && row[7] !== null && !vatDecimal.eq(suppliedVat))) {
      throw new SoliqParseError(`${location}: сумма, НДС и итог не совпадают`);
    }
    const vat = vatDecimal.toNumber();
    if (amount === 0 && vat === 0) continue;

    items.push({
      date,
      inn,
      counterpartyName: String(row[2] || "").trim(),
      amount,
      vatAmount: vat,
      direction: "REVENUE",
    });
  }
  return { items, recognized: numberingRow !== -1 };
}

// Find sheet by canonical name (case-insensitive); fall back to positional index.
function findSheet(workbook: XLSX.WorkBook, name: string, fallbackIndex: number): XLSX.WorkSheet | undefined {
  const match = workbook.SheetNames.find(s => s.toLowerCase() === name.toLowerCase());
  return match ? workbook.Sheets[match] : workbook.Sheets[workbook.SheetNames[fallbackIndex]];
}

export function parseSoliqExcel(buffer: Buffer): SoliqParsedData {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: false });
  if (workbook.Workbook?.WBProps?.date1904) throw new SoliqParseError("Система дат Excel 1904 не поддерживается");

  // my.soliq.uz exports list01 (expenses) and list02 (revenues). Prefer name-based lookup
  // so the order of sheets doesn't matter if Soliq adds extra sheets in future exports.
  const sheet1 = findSheet(workbook, "list01", 0);
  const sheet2 = findSheet(workbook, "list02", 1);

  const expenseResult = sheet1 ? parseExpenseSheet(sheet1) : { items: [], recognized: false };
  const revenueResult = sheet2 ? parseRevenueSheet(sheet2) : { items: [], recognized: false };
  const expenses = expenseResult.items;
  const revenues = revenueResult.items;
  const esfItems = [...expenses, ...revenues];

  const inputVat = expenses.reduce((sum, item) => sum.plus(item.vatAmount), new Decimal(0));
  const outputVat = revenues.reduce((sum, item) => sum.plus(item.vatAmount), new Decimal(0));

  return {
    expenses,
    revenues,
    esfItems,
    templateRecognized: expenseResult.recognized || revenueResult.recognized,
    taxSummary: {
      vat: outputVat.minus(inputVat).toNumber(),
      outputVat: outputVat.toNumber(),
      inputVat: inputVat.toNumber(),
      turnoverTax: 0,
      incomeTax: 0,
    },
  };
}

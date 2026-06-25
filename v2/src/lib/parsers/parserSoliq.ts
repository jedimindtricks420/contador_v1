import * as XLSX from "xlsx";

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
}

function parseExcelDate(val: any): Date | null {
  if (val instanceof Date) return val;
  if (typeof val === "number") {
    return new Date(Math.round((val - 25569) * 86400 * 1000));
  }
  if (typeof val === "string") {
    const trimmed = val.trim();
    const parts = trimmed.split(/[./]/);
    if (parts.length === 3) {
      const [d, m, y] = parts.map(Number);
      if (!isNaN(d) && !isNaN(m) && !isNaN(y)) return new Date(y, m - 1, d);
    }
    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) return parsed;
  }
  return null;
}

function parseExcelAmount(val: any): number {
  if (typeof val === "number") return val;
  if (typeof val === "string") {
    const cleaned = val.replace(/\s/g, "").replace(/,/g, ".").replace(/[^\d.\-]/g, "");
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

// Find the row that contains sequential column-number labels [1, 2, 3, 4, ...].
// Data rows start after this row. Soliq templates always include this row.
function findDataStartRow(rows: any[][]): number {
  for (let i = 0; i < Math.min(rows.length, 25); i++) {
    const row = rows[i];
    if (!row || !Array.isArray(row)) continue;
    const nums = row.filter(c => typeof c === "number" && c >= 1 && c <= 20);
    if (nums.length >= 4) {
      const sorted = [...nums].sort((a, b) => a - b);
      if (sorted[0] === 1 && sorted.every((n, j) => n === j + 1)) {
        return i + 1;
      }
    }
  }
  return 14; // fallback: Soliq header is always 14 rows
}

// Soliq .xltx files declare a truncated dimension (e.g. "A1:K14") that makes
// XLSX.sheet_to_json stop before the actual data rows (15+). Expand to read everything.
function expandRef(sheet: XLSX.WorkSheet): void {
  const ref = sheet["!ref"];
  if (!ref) return;
  const range = XLSX.utils.decode_range(ref);
  range.e.r = Math.max(range.e.r, 10000);
  range.e.c = Math.max(range.e.c, 25);
  sheet["!ref"] = XLSX.utils.encode_range(range);
}

// list01 — Приложение 4, Таблица 1: purchase invoices (расходы)
// Range starts at column B. Array offsets:
//   [0]=№  [1]=supplier_name  [2]=supplier_inn  [3]=invoice_no  [4]=date
//   [5]=amount_ex_vat  [6]=vat_amount
function parseExpenseSheet(sheet: XLSX.WorkSheet): SoliqEsf[] {
  expandRef(sheet);
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" }) as any[][];
  const dataStart = findDataStartRow(rows);
  const items: SoliqEsf[] = [];

  for (let i = dataStart; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !row.some(c => c !== "")) continue;

    // Row number is at index 0; non-numeric means ИТОГО or a subheader — skip
    const num = row[0];
    if (typeof num !== "number" || num < 1) continue;

    const inn = String(row[2] || "").replace(/\D/g, "");
    if (!inn || inn.length < 9) continue;

    const amount = parseExcelAmount(row[5]);
    const vat = parseExcelAmount(row[6]);
    if (amount === 0 && vat === 0) continue;

    items.push({
      date: parseExcelDate(row[4]) || new Date(),
      inn,
      counterpartyName: String(row[1] || "").trim(),
      amount,
      vatAmount: vat,
      direction: "EXPENSE",
    });
  }
  return items;
}

// list02 — Приложение 4, Таблица 2: sales invoices (выручка)
// Range starts at column A (col A is always empty). Array offsets:
//   [0]=empty  [1]=№  [2]=buyer_name  [3]=buyer_inn  [4]=invoice_no  [5]=date
//   [6]=amount_ex_vat  [7]=vat_amount  [8]=amount_with_vat
function parseRevenueSheet(sheet: XLSX.WorkSheet): SoliqEsf[] {
  expandRef(sheet);
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" }) as any[][];
  const dataStart = findDataStartRow(rows);
  const items: SoliqEsf[] = [];

  for (let i = dataStart; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !row.some(c => c !== "")) continue;

    // Row number is at index 1 for list02 (col B)
    const num = row[1];
    if (typeof num !== "number" || num < 1) continue;

    const inn = String(row[3] || "").replace(/\D/g, "");
    if (!inn || inn.length < 9) continue;

    const amount = parseExcelAmount(row[6]);
    // column I [8] = "Стоимость с НДС" — authoritative total; avoids floating-point drift from [6]+[7]
    const totalWithVat = parseExcelAmount(row[8]);
    const vat = totalWithVat > 0 ? totalWithVat - amount : parseExcelAmount(row[7]);
    if (amount === 0 && vat === 0) continue;

    items.push({
      date: parseExcelDate(row[5]) || new Date(),
      inn,
      counterpartyName: String(row[2] || "").trim(),
      amount,
      vatAmount: vat,
      direction: "REVENUE",
    });
  }
  return items;
}

// Find sheet by canonical name (case-insensitive); fall back to positional index.
function findSheet(workbook: XLSX.WorkBook, name: string, fallbackIndex: number): XLSX.WorkSheet | undefined {
  const match = workbook.SheetNames.find(s => s.toLowerCase() === name.toLowerCase());
  return match ? workbook.Sheets[match] : workbook.Sheets[workbook.SheetNames[fallbackIndex]];
}

export function parseSoliqExcel(buffer: Buffer): SoliqParsedData {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });

  // my.soliq.uz exports list01 (expenses) and list02 (revenues). Prefer name-based lookup
  // so the order of sheets doesn't matter if Soliq adds extra sheets in future exports.
  const sheet1 = findSheet(workbook, "list01", 0);
  const sheet2 = findSheet(workbook, "list02", 1);

  const expenses = sheet1 ? parseExpenseSheet(sheet1) : [];
  const revenues = sheet2 ? parseRevenueSheet(sheet2) : [];
  const esfItems = [...expenses, ...revenues];

  const inputVat = expenses.reduce((sum, e) => sum + e.vatAmount, 0);
  const outputVat = revenues.reduce((sum, e) => sum + e.vatAmount, 0);

  return {
    expenses,
    revenues,
    esfItems,
    taxSummary: {
      vat: outputVat - inputVat,
      outputVat,
      inputVat,
      turnoverTax: 0,
      incomeTax: 0,
    },
  };
}

import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { parseSoliqExcel } from "@/lib/parsers/parserSoliq";

// Builds a workbook mimicking the my.soliq.uz template: 14 header rows,
// a column-numbering row (1..10), then data rows.
function buildSoliqWorkbook(opts: {
  expenseRows?: any[][]; // list01 rows starting from col B: [№, name, inn, invoiceNo, date, amount, vat]
  revenueRows?: any[][]; // list02 rows starting from col A: [empty, №, name, inn, invoiceNo, date, amount, vat, total]
}): Buffer {
  const wb = XLSX.utils.book_new();

  const list01: any[][] = [];
  for (let i = 0; i < 13; i++) list01.push([]);
  list01.push([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  for (const r of opts.expenseRows ?? []) list01.push(r);

  const list02: any[][] = [];
  for (let i = 0; i < 13; i++) list02.push([]);
  list02.push(["", 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  for (const r of opts.revenueRows ?? []) list02.push(r);

  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(list01), "list01");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(list02), "list02");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

describe("parseSoliqExcel — empty registry vs unrecognized file", () => {
  it("marks templateRecognized=true for a registry with no data rows at all", () => {
    const buf = buildSoliqWorkbook({});
    const parsed = parseSoliqExcel(buf);
    expect(parsed.templateRecognized).toBe(true);
    expect(parsed.esfItems).toHaveLength(0);
    expect(parsed.taxSummary.vat).toBe(0);
  });

  it("marks templateRecognized=true when rows exist but all amounts are zero (no ЭСФ turnover)", () => {
    const buf = buildSoliqWorkbook({
      revenueRows: [
        ["", 1, "", "308718135", "Marketplace", "22.06.2026", 0, 0, 0],
        ["", 2, "", "308718135", "Marketplace", "30.06.2026", 0, 0, 0],
      ],
    });
    const parsed = parseSoliqExcel(buf);
    expect(parsed.templateRecognized).toBe(true);
    expect(parsed.esfItems).toHaveLength(0);
    expect(parsed.taxSummary.vat).toBe(0);
  });

  it("still parses rows that carry amounts", () => {
    const buf = buildSoliqWorkbook({
      expenseRows: [[1, "MONT CLOUD MCHJ", "306180825", "524", "12.05.2026", 13008835.71, 1561060.29]],
      revenueRows: [["", 1, "BUYER LLC", "308718135", "77", "02.05.2026", 200000, 24000, 224000]],
    });
    const parsed = parseSoliqExcel(buf);
    expect(parsed.templateRecognized).toBe(true);
    expect(parsed.expenses).toHaveLength(1);
    expect(parsed.revenues).toHaveLength(1);
    expect(parsed.taxSummary.inputVat).toBeCloseTo(1561060.29, 2);
  });

  it("marks templateRecognized=false for a workbook without the Soliq numbering row", () => {
    const wb = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet([
      ["Дата", "Контрагент", "Сумма"],
      ["01.06.2026", "ООО Ромашка", 100000],
    ]);
    XLSX.utils.book_append_sheet(wb, sheet, "Sheet1");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

    const parsed = parseSoliqExcel(buf);
    expect(parsed.templateRecognized).toBe(false);
    expect(parsed.esfItems).toHaveLength(0);
  });
});

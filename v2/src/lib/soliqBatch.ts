import Decimal from "decimal.js";
import { z } from "zod";
import type { SoliqEsf } from "@/lib/parsers/parserSoliq";

export const SOLIQ_MAX_ROWS = 2000;
export const SOLIQ_MAX_FILE_BYTES = 5 * 1024 * 1024;

export class SoliqBatchError extends Error {}

const money = z.string().regex(/^\d+\.\d{2}$/).refine(value =>
  new Decimal(value).times(100).lte(Number.MAX_SAFE_INTEGER));
const rowSchema = z.object({
  rowId: z.string().min(1),
  date: z.string().refine(value => {
    const date = new Date(value);
    return Number.isFinite(date.getTime()) && date.toISOString() === value;
  }),
  inn: z.string().regex(/^\d{9}(?:\d{5})?$/),
  counterpartyName: z.string().max(500),
  amount: money,
  vatAmount: money,
  direction: z.enum(["EXPENSE", "REVENUE"]),
}).strict();
export type SoliqBatchRow = z.infer<typeof rowSchema>;

const decisionSchema = z.object({
  rowId: z.string().min(1).max(100),
  openItemId: z.string().trim().min(1).max(100).nullable(),
  receiptKind: z.enum(["goods", "services"]).optional(),
}).strict();
export const soliqCompletionSchema = z.object({
  batchId: z.string().uuid(),
  decisions: z.array(decisionSchema).max(SOLIQ_MAX_ROWS),
}).strict();

export function soliqControlTotals(rows: SoliqBatchRow[]) {
  let net = new Decimal(0);
  let inputVat = new Decimal(0);
  let outputVat = new Decimal(0);
  for (const row of rows) {
    net = net.plus(row.amount);
    if (row.direction === "REVENUE") outputVat = outputVat.plus(row.vatAmount);
    else inputVat = inputVat.plus(row.vatAmount);
  }
  return {
    rowCount: rows.length,
    net: net.toFixed(2),
    gross: net.plus(inputVat).plus(outputVat).toFixed(2),
    inputVat: inputVat.toFixed(2),
    outputVat: outputVat.toFixed(2),
    vat: outputVat.minus(inputVat).toFixed(2),
  };
}

export function validateSoliqRows(value: unknown, period: { year: number; month: number }) {
  const parsed = z.array(rowSchema).max(SOLIQ_MAX_ROWS).safeParse(value);
  if (!parsed.success) throw new SoliqBatchError("Некорректные строки серверного пакета Soliq");
  const seen = new Set<string>();
  for (const row of parsed.data) {
    const localDate = new Date(new Date(row.date).getTime() + 5 * 60 * 60 * 1000);
    if (localDate.getUTCFullYear() !== period.year || localDate.getUTCMonth() + 1 !== period.month) {
      throw new SoliqBatchError(`Строка ${row.rowId}: дата не входит в выбранный период`);
    }
    const gross = new Decimal(row.amount).plus(row.vatAmount);
    if (gross.lte(0) || gross.times(100).gt(Number.MAX_SAFE_INTEGER)) {
      throw new SoliqBatchError(`Строка ${row.rowId}: сумма вне допустимого диапазона`);
    }
    if (seen.has(row.rowId)) throw new SoliqBatchError("Повторный идентификатор строки Soliq");
    seen.add(row.rowId);
  }
  return parsed.data;
}

export function buildSoliqRows(items: SoliqEsf[], period: { year: number; month: number }) {
  const rows = items.map((item, index) => {
    if (!Number.isFinite(item.date.getTime()) ||
        !Number.isFinite(item.amount) || !Number.isFinite(item.vatAmount) ||
        new Decimal(item.amount).decimalPlaces() > 2 || new Decimal(item.vatAmount).decimalPlaces() > 2) {
      throw new SoliqBatchError(`Строка ${index + 1}: некорректная дата или сумма`);
    }
    return {
      rowId: String(index + 1), date: item.date.toISOString(), inn: item.inn.trim(),
      counterpartyName: item.counterpartyName.trim(), direction: item.direction,
      amount: new Decimal(item.amount).toFixed(2), vatAmount: new Decimal(item.vatAmount).toFixed(2),
    };
  });
  return validateSoliqRows(rows, period);
}

export function resolveSoliqDecisions(
  rows: SoliqBatchRow[], totals: unknown,
  decisions: z.infer<typeof decisionSchema>[],
) {
  const calculated = soliqControlTotals(rows);
  const stored = totals as Record<string, unknown> | null;
  if (!stored || Object.entries(calculated).some(([key, value]) => stored[key] !== value)) {
    throw new SoliqBatchError("Контрольные итоги пакета Soliq не совпадают");
  }
  const byRow = new Map(decisions.map(decision => [decision.rowId, decision]));
  if (decisions.length !== rows.length || byRow.size !== rows.length || rows.some(row => !byRow.has(row.rowId))) {
    throw new SoliqBatchError("Решения должны содержать каждую строку пакета ровно один раз");
  }
  const selected = decisions.flatMap(decision => decision.openItemId ? [decision.openItemId] : []);
  if (new Set(selected).size !== selected.length) throw new SoliqBatchError("Аванс выбран более одного раза");
  return rows.map(row => {
    const decision = byRow.get(row.rowId)!;
    return {
      ...row,
      matchStatus: decision.openItemId ? "MATCHED" as const : "UNMATCHED" as const,
      matchedOpenItemId: decision.openItemId,
      matchedAccountCode: row.direction === "REVENUE" ? "6310" : "4310",
      receiptKind: decision.receiptKind,
    };
  });
}
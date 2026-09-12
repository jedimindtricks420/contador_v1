import Decimal from "decimal.js";
import { z } from "zod";

const Money = Decimal.clone({ precision: 40 });
const money = z.union([z.string(), z.number().finite()]).superRefine((value, context) => {
  const text = String(value);
  if (!/^\d{1,18}(?:\.\d{1,2})?$/.test(text) ||
      (typeof value === "number" && new Money(text).mul(100).gt(Number.MAX_SAFE_INTEGER))) {
    context.addIssue({ code: "custom", message: "Сумма должна быть точной неотрицательной строкой с двумя десятичными знаками" });
  }
}).transform(value => new Money(value).toFixed(2));

export const openingBalanceSchema = z.object({
  date: z.iso.date().refine(value => value >= "1900-01-01" && value <= "9999-12-31", "Недопустимая дата"),
  lines: z.array(z.object({
    accountCode: z.string().regex(/^\d{4}$/),
    debit: money,
    credit: money,
  }).strict().refine(line => (line.debit === "0.00") !== (line.credit === "0.00"),
    "Строка должна содержать ненулевую сумму только по одной стороне")).min(2).max(500),
}).strict().superRefine((value, context) => {
  if (value.lines.some(line => !/^\d{1,18}\.\d{2}$/.test(line.debit) || !/^\d{1,18}\.\d{2}$/.test(line.credit))) return;
  const totals = openingBalanceTotals(value.lines);
  if (totals.debit !== totals.credit) {
    context.addIssue({ code: "custom", message: "Дебет и кредит начального баланса должны совпадать" });
  }
  if (new Set(value.lines.map(line => line.accountCode)).size !== value.lines.length) {
    context.addIssue({ code: "custom", message: "Счёт не должен повторяться в начальном балансе" });
  }
});

export function openingBalanceTotals(lines: { debit: string; credit: string }[]) {
  return {
    debit: lines.reduce((total, line) => total.plus(line.debit), new Money(0)).toFixed(2),
    credit: lines.reduce((total, line) => total.plus(line.credit), new Money(0)).toFixed(2),
  };
}

export function isOpeningBalanceAccount(account: { code: string; type: string; isDeprecated: boolean; _count: { children: number } }) {
  return /^\d{4}$/.test(account.code) && !account.code.endsWith("00") &&
    account.code < "9000" && !account.isDeprecated && account._count.children === 0 &&
    ["ASSET", "CONTRA_ASSET", "LIABILITY", "CONTRA_LIABILITY", "ACTIVE_PASSIVE"].includes(account.type);
}
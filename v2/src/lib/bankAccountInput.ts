import Decimal from "decimal.js";
import { z } from "zod";
import { normalizeBankAccountNumber } from "@/lib/bankStatementValidation";

const balance = z.union([z.string().trim().max(64), z.number().finite()]).superRefine((value, context) => {
  const text = String(value);
  if (!/^-?\d{1,18}(?:\.\d{1,2})?$/.test(text)) {
    context.addIssue({ code: "custom", message: "Остаток должен быть десятичной суммой с точностью до двух знаков" });
    return;
  }
  if (typeof value === "number" && new Decimal(text).abs().mul(100).gt(Number.MAX_SAFE_INTEGER)) {
    context.addIssue({ code: "custom", message: "Большой остаток необходимо передать точной строкой" });
  }
}).transform(value => new Decimal(value).toFixed(2));

const fields = z.object({
  name: z.string().trim().min(1).max(200),
  bankName: z.string().trim().max(200).nullable().transform(value => value || null),
  accountNumber: z.string().max(64).transform(normalizeBankAccountNumber).pipe(z.string()),
  currency: z.string().regex(/^[A-Z]{3}$/),
  lastBalance: balance,
}).strict();

export const createBankAccountSchema = fields.extend({
  bankName: fields.shape.bankName.default(null),
  currency: fields.shape.currency.default("UZS"),
  lastBalance: balance.default("0.00"),
});
export const updateBankAccountSchema = fields.partial().refine(value => Object.keys(value).length > 0, {
  message: "Не указаны изменения счёта",
});
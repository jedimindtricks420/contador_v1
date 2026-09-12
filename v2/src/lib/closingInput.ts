import Decimal from "decimal.js";
import { z } from "zod";
import { SALARY_EXPENSE_ACCOUNT_CODES } from "@/lib/constants";

function decimalInput(label: string, signed: boolean, money: boolean) {
  return z.union([z.string().max(64), z.number().finite()]).superRefine((value, context) => {
    const text = String(value);
    const pattern = signed ? /^-?\d+(?:\.\d+)?$/ : /^\d+(?:\.\d+)?$/;
    if (!pattern.test(text)) {
      context.addIssue({ code: "custom", message: `${label}: требуется ${signed ? "" : "неотрицательное "}десятичное число` });
      return;
    }
    const decimal = new Decimal(text);
    if ((money && decimal.decimalPlaces() > 2) ||
        decimal.abs().mul(money ? 100 : 1).gt(Number.MAX_SAFE_INTEGER) ||
        !new Decimal(decimal.toNumber()).equals(decimal)) {
      context.addIssue({ code: "custom", message: `${label}: недопустимая точность или слишком большое значение` });
    }
  }).transform(value => new Decimal(value).toNumber());
}

export const closingAccrualsSchema = z.object({
  salaryAmount: decimalInput("Зарплата", false, true),
  depreciationAmount: decimalInput("Амортизация", false, true),
  rentAmount: decimalInput("Аренда", false, true),
  expenseAccountCode: z.string(),
}).strict().superRefine((value, context) => {
  if ((value.salaryAmount > 0 || value.expenseAccountCode !== "") &&
      !SALARY_EXPENSE_ACCOUNT_CODES.some(code => code === value.expenseAccountCode)) {
    context.addIssue({ code: "custom", path: ["expenseAccountCode"],
      message: `Укажите функцию сотрудника для начисления ЗП. Допустимые счета: ${SALARY_EXPENSE_ACCOUNT_CODES.join(", ")}` });
  }
});

export const closingFxSchema = z.object({
  exchangeRate: decimalInput("Курс", false, false),
  difference: decimalInput("Курсовая разница", true, true),
}).strict().superRefine((value, context) => {
  if (value.difference !== 0 && value.exchangeRate <= 0) {
    context.addIssue({ code: "custom", path: ["exchangeRate"], message: "Для курсовой разницы требуется положительный курс" });
  }
});
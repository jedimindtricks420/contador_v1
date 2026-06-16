import { evaluate } from "./expressionEval";
import { TAX_RATES } from "../constants";

export interface PostingLine {
  accountCode: string;
  side: "debit" | "credit";
  expression: string;
  subcontoType?: "counterparty" | "contract";
  condition?: string;
}

export interface PostingTemplate {
  lines: PostingLine[];
  opensItem?: boolean;
  itemAccountCode?: string;
  requiresCounterparty?: boolean;
  requiresContract?: boolean;
}

/**
 * Validates document posting templates.
 * Returns an array of string error messages. If empty, the template is valid.
 */
export function validateTemplate(template: any): string[] {
  const errors: string[] = [];

  if (!template) {
    return ["Шаблон пуст или не задан"];
  }

  if (typeof template !== "object") {
    return ["Некорректный формат шаблона (должен быть объектом)"];
  }

  if (!Array.isArray(template.lines)) {
    return ["Шаблон должен содержать массив lines"];
  }

  if (template.lines.length === 0) {
    errors.push("Массив lines не должен быть пустым");
  }

  const dummyScope = {
    amount: 1000,
    vatRate: TAX_RATES.VAT,
    grossSalary: 5000,
    netSalary: 4400,
    socialTax: 600,
    incomeTax: 600,
    depreciationAmount: 200
  };

  template.lines.forEach((line: any, idx: number) => {
    const lineNum = idx + 1;

    if (!line.accountCode || typeof line.accountCode !== "string") {
      errors.push(`В строке ${lineNum} отсутствует или некорректен accountCode`);
    }

    if (line.side !== "debit" && line.side !== "credit") {
      errors.push(`В строке ${lineNum} некорректный side (должен быть 'debit' или 'credit')`);
    }

    if (!line.expression || typeof line.expression !== "string") {
      errors.push(`В строке ${lineNum} отсутствует или некорректен expression`);
    } else {
      try {
        evaluate(line.expression, dummyScope);
      } catch (err: any) {
        errors.push(`В строке ${lineNum} синтаксическая ошибка в expression: ${err.message}`);
      }
    }

    if (line.condition !== undefined) {
      if (typeof line.condition !== "string") {
        errors.push(`В строке ${lineNum} некорректный формат condition (должен быть строкой)`);
      } else {
        try {
          evaluate(line.condition, dummyScope);
        } catch (err: any) {
          errors.push(`В строке ${lineNum} синтаксическая ошибка в condition: ${err.message}`);
        }
      }
    }

    if (line.subcontoType !== undefined && !["counterparty", "contract"].includes(line.subcontoType)) {
      errors.push(`В строке ${lineNum} некорректный subcontoType (должен быть 'counterparty' или 'contract')`);
    }
  });

  if (template.opensItem) {
    if (!template.itemAccountCode || typeof template.itemAccountCode !== "string") {
      errors.push("Для шаблонов с opensItem=true необходимо указать корректный itemAccountCode");
    }
  }

  return errors;
}

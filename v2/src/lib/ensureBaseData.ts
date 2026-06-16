import prisma from "./prisma";
import { TAX_RATES, ACCOUNTS } from "./constants";
import { upsertAllAccounts } from "./seed-coa";

const vatDivisor = 1 + TAX_RATES.VAT; // 1.12

const baseDocumentTypes = [
  {
    code: "REVENUE_VAT",
    name: "Поступление от покупателя (с НДС)",
    template: {
      lines: [
        { accountCode: "5110", side: "debit", expression: "amount" },
        { accountCode: "9030", side: "credit", expression: `amount / ${vatDivisor}` },
        { accountCode: "6410", side: "credit", expression: `amount - (amount / ${vatDivisor})` }
      ],
      opensItem: false,
      requiresCounterparty: true
    }
  },
  {
    code: "REVENUE_NO_VAT",
    name: "Поступление от покупателя (без НДС)",
    template: {
      lines: [
        { accountCode: "5110", side: "debit", expression: "amount" },
        { accountCode: "9030", side: "credit", expression: "amount" }
      ],
      opensItem: false,
      requiresCounterparty: true
    }
  },
  {
    code: "ADVANCE_RECEIVED",
    name: "Аванс полученный",
    template: {
      lines: [
        { accountCode: "5110", side: "debit", expression: "amount" },
        { accountCode: "6310", side: "credit", expression: "amount" }
      ],
      opensItem: true,
      itemAccountCode: "6310",
      requiresCounterparty: true
    }
  },
  {
    code: "SUPPLIER_PAYMENT",
    name: "Оплата поставщику",
    template: {
      lines: [
        { accountCode: "6010", side: "debit", expression: "amount" },
        { accountCode: "5110", side: "credit", expression: "amount" }
      ],
      opensItem: false,
      requiresCounterparty: true
    }
  },
  {
    code: "ADVANCE_PAID",
    name: "Аванс выданный",
    template: {
      lines: [
        { accountCode: "4310", side: "debit", expression: "amount" },
        { accountCode: "5110", side: "credit", expression: "amount" }
      ],
      opensItem: true,
      itemAccountCode: "4310",
      requiresCounterparty: true
    }
  },
  {
    code: "SALARY",
    name: "Выплата зарплаты",
    template: {
      lines: [
        { accountCode: "6710", side: "debit", expression: "amount" },
        { accountCode: "5110", side: "credit", expression: "amount" }
      ],
      opensItem: false,
      requiresCounterparty: false
    }
  },
  {
    code: "TAX_PAYMENT",
    name: "Уплата налога",
    template: {
      lines: [
        { accountCode: "6410", side: "debit", expression: "amount" },
        { accountCode: "5110", side: "credit", expression: "amount" }
      ],
      opensItem: false,
      requiresCounterparty: false
    }
  },
  {
    code: "RENT",
    name: "Аренда",
    template: {
      lines: [
        { accountCode: "9420", side: "debit", expression: "amount" },
        { accountCode: "5110", side: "credit", expression: "amount" }
      ],
      opensItem: false,
      requiresCounterparty: true
    }
  },
  {
    code: "ADVERTISING",
    name: "Реклама / маркетинг",
    template: {
      lines: [
        { accountCode: "9410", side: "debit", expression: "amount" },
        { accountCode: "5110", side: "credit", expression: "amount" }
      ],
      opensItem: false,
      requiresCounterparty: true
    }
  },
  {
    code: "OTHER_EXPENSE",
    name: "Прочий расход",
    template: {
      lines: [
        { accountCode: "9430", side: "debit", expression: "amount" },
        { accountCode: "5110", side: "credit", expression: "amount" }
      ],
      opensItem: false,
      requiresCounterparty: false
    }
  },
  {
    code: "ACCOUNTABLE",
    name: "Подотчётные суммы",
    template: {
      lines: [
        { accountCode: "4220", side: "debit", expression: "amount" },
        { accountCode: "5110", side: "credit", expression: "amount" }
      ],
      opensItem: true,
      itemAccountCode: "4220",
      requiresCounterparty: false
    }
  },
  {
    code: "FOUNDER_LOAN",
    name: "Займ от учредителя",
    template: {
      lines: [
        { accountCode: "5110", side: "debit", expression: "amount" },
        { accountCode: "6820", side: "credit", expression: "amount" }
      ],
      opensItem: true,
      itemAccountCode: "6820",
      requiresCounterparty: true
    }
  },
  {
    code: "INTERNAL_TRANSFER",
    name: "Внутренний перевод",
    template: {
      lines: [
        { accountCode: "5710", side: "debit", expression: "amount" },
        { accountCode: "5110", side: "credit", expression: "amount" }
      ],
      opensItem: false,
      requiresCounterparty: false
    }
  },
  {
    code: "REFUND",
    name: "Возврат / корректировка",
    template: {
      lines: [
        { accountCode: "9030", side: "debit", expression: "amount" },
        { accountCode: "5110", side: "credit", expression: "amount" }
      ],
      opensItem: false,
      requiresCounterparty: true
    }
  },
  {
    code: "DEPOSIT",
    name: "Гарантийный депозит",
    template: {
      lines: [
        { accountCode: "5830", side: "debit", expression: "amount" },
        { accountCode: "5110", side: "credit", expression: "amount" }
      ],
      opensItem: true,
      itemAccountCode: "5830",
      requiresCounterparty: true
    }
  },
  {
    code: "SALARY_ACCRUAL",
    name: "Начисление заработной платы и налогов ФОТ",
    template: {
      lines: [
        { accountCode: ACCOUNTS.EXPENSE_ADMIN, side: "debit", expression: "salaryAmount" },
        { accountCode: ACCOUNTS.PAYROLL, side: "credit", expression: "salaryAmount" },
        { accountCode: ACCOUNTS.PAYROLL, side: "debit", expression: `salaryAmount * ${TAX_RATES.NDFL}` },
        { accountCode: ACCOUNTS.TAX_PAYABLE, side: "credit", expression: `salaryAmount * ${TAX_RATES.NDFL}` },
        { accountCode: ACCOUNTS.EXPENSE_ADMIN, side: "debit", expression: `salaryAmount * ${TAX_RATES.SOCIAL_TAX}` },
        { accountCode: ACCOUNTS.SOCIAL_TAX_PAYABLE, side: "credit", expression: `salaryAmount * ${TAX_RATES.SOCIAL_TAX}` }
      ],
      opensItem: false,
      requiresCounterparty: false
    }
  },
  {
    code: "DEPRECIATION_ACCRUAL",
    name: "Начисление амортизации основных средств",
    template: {
      lines: [
        { accountCode: ACCOUNTS.EXPENSE_OTHER, side: "debit", expression: "depreciationAmount" },
        { accountCode: ACCOUNTS.DEPRECIATION_ACCUM, side: "credit", expression: "depreciationAmount" }
      ],
      opensItem: false,
      requiresCounterparty: false
    }
  },
  {
    code: "RENT_ACCRUAL",
    name: "Начисление аренды (неденежное)",
    template: {
      lines: [
        { accountCode: ACCOUNTS.EXPENSE_ADMIN, side: "debit", expression: "rentAmount" },
        { accountCode: ACCOUNTS.PAYABLES, side: "credit", expression: "rentAmount" }
      ],
      opensItem: false,
      requiresCounterparty: false
    }
  },
  {
    code: "FX_DIFFERENCE",
    name: "Курсовая разница валютных счетов",
    template: {
      lines: [
        { accountCode: ACCOUNTS.BANK_USD, side: "debit", expression: "fxDifference", condition: "fxDifference > 0" },
        { accountCode: ACCOUNTS.FX_INCOME, side: "credit", expression: "fxDifference", condition: "fxDifference > 0" },
        { accountCode: ACCOUNTS.FX_EXPENSE, side: "debit", expression: "-fxDifference", condition: "fxDifference < 0" },
        { accountCode: ACCOUNTS.BANK_USD, side: "credit", expression: "-fxDifference", condition: "fxDifference < 0" }
      ],
      opensItem: false,
      requiresCounterparty: false
    }
  },
  {
    code: "SOCIAL_TAX_PAYMENT",
    name: "Уплата социального налога",
    template: {
      lines: [
        { accountCode: "6520", side: "debit", expression: "amount" },
        { accountCode: "5110", side: "credit", expression: "amount" }
      ],
      opensItem: false,
      requiresCounterparty: false
    }
  },
  {
    code: "PROFIT_TAX_ACCRUAL",
    name: "Начисление налога на прибыль",
    template: {
      lines: [
        { accountCode: "9810", side: "debit", expression: "taxAmount" },
        { accountCode: "6410", side: "credit", expression: "taxAmount" }
      ],
      opensItem: false,
      requiresCounterparty: false
    }
  },
  {
    code: "PERIOD_CLOSING",
    name: "Закрытие счетов доходов и расходов (реформация баланса)",
    template: {
      lines: [],
      opensItem: false,
      requiresCounterparty: false
    }
  }
];

export async function ensureBaseData() {
  const seedResult = await upsertAllAccounts(prisma);
  console.log(`[seed] Счета НСБУ: создано ${seedResult.created}, обновлено ${seedResult.updated}, всего ${seedResult.total}`);

  for (const doc of baseDocumentTypes) {
    await prisma.documentType.upsert({
      where: { code: doc.code },
      update: { name: doc.name, postingTemplate: doc.template },
      create: { code: doc.code, name: doc.name, postingTemplate: doc.template }
    });
  }
}

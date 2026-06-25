import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const TAX_RATES = { INPS: 0.001, SOCIAL_TAX: 0.12, NDFL: 0.12 };
const ACCOUNTS = {
  PAYROLL: "6710",
  TAX_PAYABLE: "6410",
  INPS_PAYABLE: "6530",
  SOCIAL_TAX_PAYABLE: "6520",
  ADVANCE_PAID: "4720",
};

const newTypes = [
  {
    code: "INPS_PAYMENT",
    name: "Уплата ИНПС (накопительная пенсия)",
    mode: "BANK_AUTO",
    template: {
      lines: [
        { accountCode: ACCOUNTS.INPS_PAYABLE, side: "debit", expression: "amount" },
        { accountCode: "5110", side: "credit", expression: "amount" }
      ],
      opensItem: false,
      requiresCounterparty: false
    }
  },
  {
    code: "SALARY_OFFSET",
    name: "Зачёт аванса (4720 → 6710)",
    mode: "MANUAL_ONLY",
    template: {
      lines: [
        { accountCode: ACCOUNTS.PAYROLL, side: "debit", expression: "amount" },
        { accountCode: ACCOUNTS.ADVANCE_PAID, side: "credit", expression: "amount" }
      ],
      opensItem: false,
      requiresCounterparty: false
    }
  },
  {
    code: "ADVANCE_RETURN_SENT",
    name: "Возврат аванса клиенту",
    mode: "BANK_AUTO",
    template: {
      lines: [
        { accountCode: "6310", side: "debit", expression: "amount" },
        { accountCode: "5110", side: "credit", expression: "amount" }
      ],
      opensItem: false,
      requiresCounterparty: true
    }
  },
  {
    code: "FOUNDER_LOAN_REPAYMENT",
    name: "Возврат займа учредителю",
    mode: "BANK_AUTO",
    template: {
      lines: [
        { accountCode: "6820", side: "debit", expression: "amount" },
        { accountCode: "5110", side: "credit", expression: "amount" }
      ],
      opensItem: false,
      requiresCounterparty: true
    }
  }
];

for (const doc of newTypes) {
  const result = await prisma.documentType.upsert({
    where: { code: doc.code },
    update: { name: doc.name, postingTemplate: doc.template, mode: doc.mode },
    create: { code: doc.code, name: doc.name, postingTemplate: doc.template, mode: doc.mode }
  });
  console.log(`[seed] ${doc.code}: ${result.id}`);
}

// Also fix SALARY_ACCRUAL to 8-line template
const salaryAccrualTemplate = {
  lines: [
    { accountCode: "9420", side: "debit", expression: "salaryAmount" },
    { accountCode: "6710", side: "credit", expression: "salaryAmount" },
    { accountCode: "6710", side: "debit", expression: `salaryAmount * ${TAX_RATES.INPS}` },
    { accountCode: "6530", side: "credit", expression: `salaryAmount * ${TAX_RATES.INPS}` },
    { accountCode: "6710", side: "debit", expression: `salaryAmount * 0.119` },
    { accountCode: "6410", side: "credit", expression: `salaryAmount * 0.119` },
    { accountCode: "9420", side: "debit", expression: `salaryAmount * ${TAX_RATES.SOCIAL_TAX}` },
    { accountCode: "6520", side: "credit", expression: `salaryAmount * ${TAX_RATES.SOCIAL_TAX}` }
  ],
  opensItem: false,
  requiresCounterparty: false
};
const sa = await prisma.documentType.upsert({
  where: { code: "SALARY_ACCRUAL" },
  update: { postingTemplate: salaryAccrualTemplate, requiresCounterparty: false },
  create: { code: "SALARY_ACCRUAL", name: "Начисление заработной платы и налогов ФОТ", postingTemplate: salaryAccrualTemplate, mode: "MANUAL_ONLY" }
});
console.log(`[seed] SALARY_ACCRUAL updated: ${sa.id}`);

// Fix SALARY_OFFSET requiresCounterparty
await prisma.documentType.updateMany({
  where: { code: "SALARY_OFFSET" },
  data: { requiresCounterparty: false }
});
console.log("[seed] SALARY_OFFSET requiresCounterparty fixed");

await prisma.$disconnect();
console.log("[seed] Done!");

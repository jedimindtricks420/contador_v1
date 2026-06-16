// Uzbekistan tax rates (NSBU / Tax Code)
export const TAX_RATES = {
  NDFL: 0.12,          // Personal income tax (НДФЛ)
  SOCIAL_TAX: 0.12,    // Social tax (соцналог)
  VAT: 0.12,           // Value-added tax (НДС)
  PROFIT_TAX: 0.15,    // Corporate profit tax
  TURNOVER_TAX: 0.04,  // Turnover tax (налог с оборота)
} as const;

// Uzbekistan NSBU chart-of-accounts codes used in business logic
export const ACCOUNTS = {
  BANK_UZS: "5110",
  BANK_USD: "5210",
  TRANSIT: "5710",
  DEPOSIT: "5830",
  RECEIVABLES: "4010",
  ADVANCE_PAID_GOODS: "4310",
  ADVANCE_PAID_TRAVEL: "4220",
  PAYABLES: "6010",
  ADVANCE_RECEIVED: "6310",
  TAX_PAYABLE: "6410",
  PAYROLL: "6710",
  FOUNDER_LOAN: "6820",
  UNIDENTIFIED: "6990",
  REVENUE_GOODS: "9010",
  REVENUE_TRADE: "9020",
  REVENUE_SERVICES: "9030",
  COGS_PRODUCTION: "9110",
  COGS_TRADE: "9120",
  COGS_SERVICES: "9130",
  EXPENSE_SALES: "9410",
  EXPENSE_ADMIN: "9420",
  EXPENSE_OTHER: "9430",
  DEPRECIATION_ACCUM: "0200",
  FX_INCOME: "9540",
  FX_EXPENSE: "9620",
  SOCIAL_TAX_PAYABLE: "6520",
  FINAL_RESULT: "9910",
} as const;

export const BANK_ACCOUNT_CODES = [ACCOUNTS.BANK_UZS, ACCOUNTS.BANK_USD, ACCOUNTS.TRANSIT];
export const BANK_USD_CODES = [ACCOUNTS.BANK_USD];
export const BANK_UZS_CODES = [ACCOUNTS.BANK_UZS, ACCOUNTS.TRANSIT];

export const REVENUE_ACCOUNT_CODES = [
  ACCOUNTS.REVENUE_GOODS,
  ACCOUNTS.REVENUE_TRADE,
  ACCOUNTS.REVENUE_SERVICES,
];

export const COGS_ACCOUNT_CODES = [
  ACCOUNTS.COGS_PRODUCTION,
  ACCOUNTS.COGS_TRADE,
  ACCOUNTS.COGS_SERVICES,
];

export const EXPENSE_ACCOUNT_CODES = [
  ACCOUNTS.EXPENSE_SALES,
  ACCOUNTS.EXPENSE_ADMIN,
  ACCOUNTS.EXPENSE_OTHER,
];

// Open-item risk deadlines (days)
export const RISK_DAYS = {
  ACCOUNTABLE: 10,        // 4220 — travel advances
  DEFAULT: 30,            // 4310, 6310, 6990 — trade advances / unidentified
  LONG_TERM: 365,         // 5830, 6820 — deposits, founder loans
} as const;

// Month-closing defaults
export const CLOSING = {
  ACCRUAL_DAY: 28,        // day of month used for accrual documents
  TAX_DUE_DAY: 20,        // payroll/VAT taxes due on 20th of next month
} as const;

// AI classification
export const AI = {
  CONFIDENCE_THRESHOLD: 70,
  BATCH_SIZE: 20,
  MODEL: "gpt-4o-mini",
} as const;

// Dashboard
export const DASHBOARD = {
  UPCOMING_TAX_DAYS: 30,
  RISK_ITEMS_LIMIT: 5,
  UPCOMING_TAX_LIMIT: 5,
} as const;

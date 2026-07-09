// Uzbekistan tax rates (NSBU / Tax Code)
export const TAX_RATES = {
  NDFL: 0.12,          // Personal income tax total (НДФЛ = НДФЛ_BUDGET + INPS)
  NDFL_BUDGET: 0.119,  // НДФЛ to state budget (11.9%)
  INPS: 0.001,         // Individual pension savings (ИНПС 0.1% → Народный банк)
  SOCIAL_TAX: 0.12,    // Social tax paid by employer (соцналог)
  VAT: 0.12,           // Value-added tax (НДС)
  PROFIT_TAX: 0.15,    // Corporate profit tax
  TURNOVER_TAX: 0.04,  // Turnover tax (налог с оборота)
  DIVIDEND_TAX: 0.05,  // Dividend withholding tax (налог у источника при выплате дивидендов)
} as const;

// Allowed range for an organization's own turnover tax rate (settings/org). The
// upper bound is the same value as TAX_RATES.TURNOVER_TAX (the statutory default) —
// orgs can only choose a lower preferential rate, never a higher one.
export const TURNOVER_TAX_RATE_MIN = 0.01;
export const TURNOVER_TAX_RATE_MAX = TAX_RATES.TURNOVER_TAX;

// Uzbekistan NSBU chart-of-accounts codes used in business logic
export const ACCOUNTS = {
  BANK_UZS: "5110",
  BANK_USD: "5210",
  TRANSIT: "5710",
  DEPOSIT: "4890",
  RECEIVABLES: "4010",
  ADVANCE_PAID_GOODS: "4310",
  ADVANCE_PAID_TRAVEL: "4220",
  ADVANCE_PAID_GENERAL: "4230",
  VAT_INPUT: "4410",        // Входящий НДС (НДС к зачёту / аванс по налогам)
  EMPLOYEE_LOAN_RECEIVABLE: "4720", // Задолженность персонала по займам
  FIXED_ASSET_ACQUISITION: "0820",  // Приобретение ОС (кап. вложения)
  BANK_LOAN_SHORT: "6810",          // Краткосрочные банковские кредиты
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
  INPS_PAYABLE: "6530",
  FINAL_RESULT: "9910",
  PROFIT_TAX_EXPENSE: "9810",    // Расходы по налогу на прибыль/налогу с оборота (Форма №2, стр. 250 — общий счёт для обоих режимов)
  RETAINED_EARNINGS: "8710",     // Нераспределённая прибыль (непокрытый убыток)
  OPENING_BALANCE_EQUITY: "8890", // Сальдо при открытии / балансирующий счёт
  ASSET_DISPOSAL: "9210",        // Выбытие основных средств
  OTHER_ASSET_DISPOSAL: "9220",  // Выбытие прочих активов
  SHARE_CAPITAL: "8330",         // Уставный капитал
  INTEREST_EXPENSE: "9610",      // Расходы по процентам
  FIXED_ASSET: "0100",           // Основные средства (первоначальная стоимость)
  INTANGIBLE_ACQUISITION: "0830", // Приобретение нематериальных активов (кап. вложения)
  DIVIDENDS_PAYABLE: "6610",     // Дивиденды к оплате (начислены, но не выплачены)
} as const;

export const MARKETPLACE_INNS = ["302179836", "302061230", "309532578", "205370258"];

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

// Valid targets for SALARY_ACCRUAL's payload.expenseAccountCode — which P&L line an
// employee's gross salary + employer social tax belongs to, based on their function.
export const SALARY_EXPENSE_ACCOUNT_CODES = [
  ACCOUNTS.COGS_PRODUCTION,
  ACCOUNTS.EXPENSE_SALES,
  ACCOUNTS.EXPENSE_ADMIN,
  ACCOUNTS.EXPENSE_OTHER,
];

// Open-item risk deadlines (days).
// Single source of truth for default risk windows per buffer account — consumed by
// getRiskDeadline() (lib/openItems.ts), the settings API (api/settings/open-item-deadlines)
// and the settings UI (settings/open-items-deadlines). Org-specific overrides are stored
// in org.settings.openItemDeadlines and take precedence over these defaults at runtime —
// see getRiskDeadline(). Accounts not listed here fall back to RISK_DAYS_DEFAULT.
export const RISK_DAYS_DEFAULT = 30;
export const RISK_DAYS_BY_ACCOUNT: Record<string, number> = {
  [ACCOUNTS.ADVANCE_PAID_TRAVEL]: 10,   // 4220 — командировочные подотчётные
  [ACCOUNTS.ADVANCE_PAID_GENERAL]: 10,  // 4230 — общехозяйственные подотчётные
  [ACCOUNTS.DEPOSIT]: 365,              // 4890 — депозиты / расчёты с агрегаторами
  [ACCOUNTS.FOUNDER_LOAN]: 365,         // 6820 — краткосрочные займы (от учредителей и от партнёрских компаний)
  [ACCOUNTS.DIVIDENDS_PAYABLE]: 365,    // 6610 — дивиденды к оплате
};

// Month-closing defaults
export const CLOSING = {
  ACCRUAL_DAY: 28,        // day of month used for accrual documents
  TAX_DUE_DAY: 20,        // payroll/VAT taxes due on 20th of next month
} as const;

// Rounding/materiality tolerances shared by report balance checks and posting
// validation — a single named value instead of the literal "1"/"0.01" repeated
// independently in balance/route.ts, import/bank/route.ts and postingEngine.ts.
export const AMOUNT_TOLERANCE = 0.01;
export const BALANCE_SHEET_TOLERANCE = 1; // допустимое расхождение Актив/Пассив, сум

// Transit INNs: payments routed through these accounts do not identify
// the real payer — the actual counterparty is encoded in the description.
// Never create INN-based classification rules for these INNs.
export const TRANSIT_INNS = new Set([
  "302179836", // Казначейство МФ РУз (центральное)
  "207680039", // Казначейство (региональные управления)
  "201116085", // НБУ — Национальный банк ВЭД
  "207004110", // Узбекфинансы
  "200892596", // Центральный банк РУз
  "303245419", // Биржа (УзРЦБ)
]);

// AI classification
export const AI = {
  CONFIDENCE_THRESHOLD: 70,
  BATCH_SIZE: 100,
  get MODEL() { return process.env.OPENAI_MODEL || "gpt-4o-mini"; },
} as const;

// Import / reconciliation thresholds
export const IMPORT = {
  MARKETPLACE_COMMISSION_TOLERANCE: 0.15, // max gap between ESF gross and bank amount (marketplace platform commission)
  FUZZY_NAME_THRESHOLD: 0.5,              // min bigram similarity to treat two names as same counterparty
  MARKETPLACE_NAME_KEYWORDS: ["click", "payme", "uzum", "paynet", "inspired"] as string[],
} as const;

// Dashboard
export const DASHBOARD = {
  UPCOMING_TAX_DAYS: 30,
  RISK_ITEMS_LIMIT: 5,
  UPCOMING_TAX_LIMIT: 5,
} as const;

// Billing — fallback values used only when the admin billing service is
// unreachable (display-only degrade, e.g. subscription info page). The real
// price/duration always comes from the admin API when it's up; these are not
// used to actually charge anyone.
export const BILLING = {
  DEFAULT_PRO_PRICE_YEARLY: 299000,
  DEFAULT_PRO_DURATION_DAYS: 365,
} as const;

// Session cookie / JWT lifetime — single source of truth for both the JWT's own
// expiration and every route that sets the session cookie's maxAge. If these
// drift apart, a cookie can outlive its JWT (rejected despite the cookie still
// being present) or vice versa.
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

// ─── Direction guards ──────────────────────────────────────────────────────────
// Single source of truth for "which document-type codes are only valid for a
// CREDIT (money in) vs DEBIT (money out) bank transaction" — ground truth for
// every code path that assigns a category to a bank-derived StagedTransaction:
// aiClassifier.ts (catalog filtering + post-hoc guard), rulesEngine.ts (deterministic
// rule matching), clarification/answer + transactions/[id]/category (manual
// confirmation), rules/[id]/apply (manual rule application). A code absent from
// both sets (e.g. CURRENCY_EXCHANGE) is treated as direction-unconstrained.
export const CREDIT_ONLY_CODES = new Set([
  "ADVANCE_RECEIVED", "REVENUE_COLLECTION", "MARKETPLACE_INCOME",
  "FOUNDER_LOAN", "CAPITAL_CONTRIBUTION", "BANK_LOAN_RECEIVED",
  "EMPLOYEE_LOAN_REPAYMENT", "FIXED_ASSET_SALE", "SUPPLIER_REFUND",
  "REVENUE_VAT", "REVENUE_NO_VAT",
  "DEPOSIT_RETURN",             // 5110 Дт — 4890 Кт, депозит возвращён арендодателем
  "ACCOUNTABLE_RETURN",         // 5110 Дт — 4220 Кт, остаток подотчётных сумм возвращён
  "ACCOUNTABLE_GENERAL_RETURN", // 5110 Дт — 4230 Кт, остаток подотчётных сумм возвращён
  "INTERNAL_TRANSFER_RECEIVED", // $destinationAccountCode Дт — 5710 Кт, приёмная сторона (счёт параметризуемый)
  "CASH_DEPOSIT",               // 5110 Дт — 5010 Кт, взнос наличных
  "VAT_REFUND_FROM_BUDGET",     // 5110 Дт — 4410 Кт, возврат НДС
  "RENTAL_INCOME_RECEIVED",     // 5110 Дт — 9350 Кт, доход от аренды
  "INTEREST_INCOME_RECEIVED",   // 5110 Дт — 9530 Кт, процентный доход
  "LONG_TERM_LOAN_RECEIVED",    // 5110 Дт — 7810/7820 Кт, получение займа
  "DIVIDEND_INCOME_RECEIVED",   // 5110 Дт — 9520 Кт, дивидендный доход
  "CAPITAL_INCREASE_PENDING", // 5110 Дт — 6630 Кт, довзнос учредителя сверх устава
  "GRANT_RECEIVED",           // 5110 Дт — 4890 Кт, получение гранта
  "SUBSIDY_RECEIVED",         // 5110 Дт — 4890 Кт, получение субсидии
  "TARGET_RECEIPTS",          // 5110 Дт — 8830/8890 Кт, целевые поступления
  "ROYALTY_INCOME",           // 5110 Дт — 9510 Кт, роялти получены
  "PENALTY_INCOME",            // 5110 Дт — 9330 Кт, неустойка от партнёра получена
  "INSURANCE_CLAIM_RECEIVED",  // 5110 Дт — 9390 Кт, страховое возмещение получено
  "TAX_REFUND_OTHER",          // 5110 Дт — 6410 Кт, возврат переплаты налога (не НДС)
  "FACTORING_RECEIVED",        // 5110 Дт — 4010 Кт, деньги по факторингу получены
  "PARTNER_LOAN_RECEIVED",     // 5110 Дт — 6820 Кт, займ от другой компании получен
  "PARTNER_LOAN_RETURNED",     // 5110 Дт — 4890 Кт, другая компания вернула займ
  "TENANT_UTILITIES_RECEIVED", // 5110 Дт — 6310 Кт, коммунальные от арендатора
  // CURRENCY_EXCHANGE намеренно НЕ включён — система пока работает в одной
  // валюте, поддержка обмена валют отложена на будущую итерацию.
]);

export const DEBIT_ONLY_CODES = new Set([
  "SUPPLIER_PAYMENT_GOODS", "SUPPLIER_PAYMENT_SERVICES",
  "SUPPLIER_PAYMENT_OTHER", "SUPPLIER_PAYMENT_VAT", "ADVANCE_PAID",
  "SALARY", "TAX_PAYMENT", "SOCIAL_TAX_PAYMENT", "INPS_PAYMENT", "RENT", "ADVERTISING",
  "OTHER_EXPENSE", "ACCOUNTABLE", "FIXED_ASSET_PURCHASE", "BANK_COMMISSION",
  "BANK_LOAN_REPAYMENT", "FOUNDER_LOAN_REPAYMENT", "EMPLOYEE_LOAN", "INTEREST_PAYMENT",
  "DIVIDEND_PAYMENT", "FINE_PENALTY", "INSURANCE_PAYMENT", "UTILITY_PAYMENT",
  "SUBSCRIPTION", "CUSTOMS_DUTY", "DEPOSIT", "REFUND",
  "ADVANCE_RETURN_SENT", // 6310 Дт — 5110 Кт, деньги уходят
  // INTERNAL_TRANSFER шаблон: Дт5710/Кт5110 — только исходящий (DEBIT).
  // Входящий перевод (CREDIT) на другой счёт — см. INTERNAL_TRANSFER_RECEIVED выше.
  "INTERNAL_TRANSFER",
  "RENT_PAYMENT",        // 6010 Дт — 5110 Кт, оплата аренды после начисления
  "ACCOUNTABLE_GENERAL", // 4230 Дт — 5110 Кт, подотчётные (общехозяйственные)
  "INTANGIBLE_ASSET_PURCHASE", // 0830 Дт — 5110 Кт, покупка НМА (лицензии, ПО, товарный знак)
  // SUPPLIER_PAYMENT — устаревший тип, mode=MANUAL_ONLY, AI больше его не предлагает.
  "CASH_WITHDRAWAL",          // 5010 Дт — 5110 Кт, снятие наличных
  "IMPORT_VAT_PAYMENT",       // 4410 Дт — 5110 Кт, уплата импортного НДС
  "PREPAID_RENT_PAYMENT",     // 3110 Дт — 5110 Кт, предоплата аренды
  "SALARY_ADVANCE",           // 4210 Дт — 5110 Кт, аванс по зарплате
  "GOODS_IN_TRANSIT",         // 2970 Дт — 5110/4310 Кт, товары в пути
  "LONG_TERM_LOAN_REPAYMENT", // 7810/7820 Дт — 5110 Кт, погашение займа
  "ROYALTY_PAYMENT",          // 9430 Дт — 5110 Кт, выплата роялти
  "FINANCE_LEASE_PAYMENT",    // 7910 Дт — 5110 Кт, платёж по лизингу (тело)
  "FINANCE_LEASE_INTEREST",   // 9610 Дт — 5110 Кт, проценты по лизингу
  "LETTER_OF_CREDIT_OPEN",    // 5510 Дт — 5110 Кт, открытие аккредитива
  "SALARY_DEPOSIT_PAYMENT",   // 6720 Дт — 5110 Кт, выплата депонированной ЗП
  "STATE_DUTY",               // 9430 Дт — 5110 Кт, оплата госпошлины
  "EMPLOYEE_TRAINING",        // 9420 Дт — 5110 Кт, обучение сотрудников
  "MEMBERSHIP_FEE",           // 9430 Дт — 5110 Кт, членский взнос
  "CHARITY_PAYMENT",          // 9430 Дт — 5110 Кт, благотворительный взнос
  "SELF_EMPLOYED_PAYMENT",    // 9420 Дт — 5110 Кт, оплата самозанятому
  "CIVIL_CONTRACT_PAYMENT",   // 6710 Дт — 5110 Кт, оплата по договору ГПХ
  "PROFESSIONAL_SERVICES",    // 9420 Дт — 5110 Кт, юрист/аудит/консультант
  "FUEL_PURCHASE",            // 1030 Дт — 5110 Кт, закупка ГСМ
  "TAXI_BUSINESS",            // 9420 Дт — 5110 Кт, такси/транспорт для бизнеса
  "TRANSLATION_SERVICES",     // 9420 Дт — 5110 Кт, перевод документов
  "WARRANTY_REPAIR",          // 9430 Дт — 5110 Кт, гарантийный ремонт клиенту
  "PARTNER_LOAN_ISSUED",      // 4890 Дт — 5110 Кт, займ выдан другой компании
  "PARTNER_LOAN_REPAID",      // 6820 Дт — 5110 Кт, возврат займа другой компании
  "ACQUIRING_COMMISSION",     // 9430 Дт — 5110 Кт, комиссия эквайринга
  "DELIVERY_TO_CUSTOMER",     // 9410 Дт — 5110 Кт, доставка товара покупателю
  "PACKAGING_COST",           // 9410 Дт — 5110 Кт, упаковка и тара
  "CUSTOMS_BROKER",           // 2910 Дт — 5110 Кт, оплата таможенному брокеру
  "PRODUCT_CERTIFICATION",    // 9430 Дт — 5110 Кт, сертификация товара/продукции
  "CASH_COLLECTION_SERVICE",  // 9430 Дт — 5110 Кт, инкассация
  "SECURITY_SERVICES",        // 9420 Дт — 5110 Кт, охрана / ЧОП
  "MARKETPLACE_PROMOTION",    // 9410 Дт — 5110 Кт, продвижение на маркетплейсе
  "REFERRAL_COMMISSION",      // 9410 Дт — 5110 Кт, реферальная комиссия партнёру
  "MOBILE_COMMUNICATION",     // 9420 Дт — 5110 Кт, мобильная связь сотрудников
  "CONFERENCE_FEE",           // 9420 Дт — 5110 Кт, участие в конференции
  "RAW_MATERIALS_PURCHASE",   // 1010 Дт — 5110 Кт, прямая закупка сырья
  "PERMITS_APPROVALS",        // 9430 Дт — 5110 Кт, разрешения и согласования
  "MUSIC_LICENSE",            // 9430 Дт — 5110 Кт, лицензия на музыку
  "ROAD_TOLLS",               // 9430 Дт — 5110 Кт, платные дороги и парковки
  "MEDICAL_LICENSE",          // 9430 Дт — 5110 Кт, медицинская лицензия
]);

// True when documentTypeCode is direction-compatible with txDirection — either the
// code is explicitly listed for that direction, or it's unconstrained (in neither
// set, e.g. CURRENCY_EXCHANGE). Used by every code path that assigns a category to
// a StagedTransaction (AI, deterministic rules, manual clarification/category edit).
export function isDirectionCompatible(documentTypeCode: string, txDirection: string): boolean {
  const isCreditOnly = CREDIT_ONLY_CODES.has(documentTypeCode);
  const isDebitOnly = DEBIT_ONLY_CODES.has(documentTypeCode);
  if (!isCreditOnly && !isDebitOnly) return true; // unconstrained
  return isCreditOnly ? txDirection === "CREDIT" : txDirection === "DEBIT";
}

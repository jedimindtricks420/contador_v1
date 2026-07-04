import prisma from "./prisma";
import { TAX_RATES, ACCOUNTS } from "./constants";
import { upsertAllAccounts } from "./seed-coa";

const vatDivisor = 1 + TAX_RATES.VAT; // 1.12

export const baseDocumentTypes = [
  {
    code: "REVENUE_VAT",
    name: "Поступление от покупателя (с НДС)",
    mode: "MANUAL_ONLY",
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
    mode: "MANUAL_ONLY",
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
    mode: "BANK_AUTO",
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
    code: "REVENUE_COLLECTION",
    name: "Поступление оплаты за отгруженные товары/услуги (постоплата)",
    mode: "BANK_AUTO",
    template: {
      lines: [
        { accountCode: "5110", side: "debit", expression: "amount" },
        { accountCode: "4010", side: "credit", expression: "amount" }
      ],
      opensItem: false,
      closesOpenItemByAccount: "4010",
      requiresCounterparty: true
    }
  },
  {
    // Устаревший код — оставлен только для проведения/миграции исторических документов
    // и старых Rule-записей (см. миграцию ниже в ensureBaseData()). Не предлагается
    // ни AI-классификатору, ни в списке ручного создания документов для банковских
    // операций (mode !== BANK_AUTO). Новые операции используйте SUPPLIER_PAYMENT_SERVICES/
    // _GOODS/_OTHER/_VAT.
    code: "SUPPLIER_PAYMENT",
    name: "Оплата поставщику (погашение долга, устаревший тип)",
    mode: "MANUAL_ONLY",
    template: {
      lines: [
        { accountCode: "6010", side: "debit", expression: "amount" },
        { accountCode: "5110", side: "credit", expression: "amount" }
      ],
      opensItem: false,
      closesOpenItemByAccount: "6010",
      requiresCounterparty: true
    }
  },
  {
    code: "SUPPLIER_PAYMENT_GOODS",
    name: "Закупка товаров (погашение долга)",
    mode: "BANK_AUTO",
    template: {
      lines: [
        { accountCode: "6010", side: "debit", expression: "amount" },
        { accountCode: "5110", side: "credit", expression: "amount" }
      ],
      opensItem: false,
      closesOpenItemByAccount: "6010",
      requiresCounterparty: true
    }
  },
  {
    code: "SUPPLIER_PAYMENT_SERVICES",
    name: "Оплата за услуги (погашение долга)",
    mode: "BANK_AUTO",
    template: {
      lines: [
        { accountCode: "6010", side: "debit", expression: "amount" },
        { accountCode: "5110", side: "credit", expression: "amount" }
      ],
      opensItem: false,
      closesOpenItemByAccount: "6010",
      requiresCounterparty: true
    }
  },
  {
    code: "SUPPLIER_PAYMENT_OTHER",
    name: "Прочая закупка (погашение долга)",
    mode: "BANK_AUTO",
    template: {
      lines: [
        { accountCode: "6010", side: "debit", expression: "amount" },
        { accountCode: "5110", side: "credit", expression: "amount" }
      ],
      opensItem: false,
      closesOpenItemByAccount: "6010",
      requiresCounterparty: true
    }
  },
  {
    code: "SUPPLIER_PAYMENT_VAT",
    name: "Оплата поставщику (погашение долга)",
    mode: "BANK_AUTO",
    template: {
      lines: [
        { accountCode: "6010", side: "debit", expression: "amount" },
        { accountCode: "5110", side: "credit", expression: "amount" }
      ],
      opensItem: false,
      closesOpenItemByAccount: "6010",
      requiresCounterparty: true
    }
  },
  {
    code: "ADVANCE_PAID",
    name: "Аванс выданный",
    mode: "BANK_AUTO",
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
    mode: "BANK_AUTO",
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
    mode: "BANK_AUTO",
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
    mode: "BANK_AUTO",
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
    mode: "BANK_AUTO",
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
    mode: "BANK_AUTO",
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
    mode: "BANK_AUTO",
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
    mode: "BANK_AUTO",
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
    name: "Внутренний перевод (исходящий)",
    mode: "BANK_AUTO",
    template: {
      lines: [
        { accountCode: "5710", side: "debit", expression: "amount" },
        { accountCode: "5110", side: "credit", expression: "amount" }
      ],
      opensItem: true,
      itemAccountCode: "5710",
      requiresCounterparty: false
    }
  },
  {
    code: "REFUND",
    name: "Возврат / корректировка",
    mode: "BANK_AUTO",
    template: {
      lines: [
        { accountCode: "9040", side: "debit", expression: "amount" },
        { accountCode: "5110", side: "credit", expression: "amount" }
      ],
      opensItem: false,
      requiresCounterparty: true
    }
  },
  {
    code: "DEPOSIT",
    name: "Гарантийный депозит",
    mode: "BANK_AUTO",
    template: {
      lines: [
        { accountCode: "4890", side: "debit", expression: "amount" },
        { accountCode: "5110", side: "credit", expression: "amount" }
      ],
      opensItem: true,
      itemAccountCode: "4890",
      requiresCounterparty: true
    }
  },
  {
    code: "SALARY_ACCRUAL",
    name: "Начисление заработной платы и налогов ФОТ",
    mode: "MANUAL_ONLY",
    template: {
      lines: [
        // Брутто ЗП: Дт 9420 — Кт 6710
        { accountCode: ACCOUNTS.EXPENSE_ADMIN, side: "debit", expression: "salaryAmount" },
        { accountCode: ACCOUNTS.PAYROLL, side: "credit", expression: "salaryAmount" },
        // ИНПС 0.1% (из зарплаты работника): Дт 6710 — Кт 6530
        { accountCode: ACCOUNTS.PAYROLL, side: "debit", expression: `salaryAmount * ${TAX_RATES.INPS}` },
        { accountCode: ACCOUNTS.INPS_PAYABLE, side: "credit", expression: `salaryAmount * ${TAX_RATES.INPS}` },
        // НДФЛ в бюджет 11.9% (из зарплаты работника): Дт 6710 — Кт 6410
        { accountCode: ACCOUNTS.PAYROLL, side: "debit", expression: `salaryAmount * ${TAX_RATES.NDFL_BUDGET}` },
        { accountCode: ACCOUNTS.TAX_PAYABLE, side: "credit", expression: `salaryAmount * ${TAX_RATES.NDFL_BUDGET}` },
        // Соцналог 12% (расход работодателя): Дт 9420 — Кт 6520
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
    mode: "MANUAL_ONLY",
    template: {
      lines: [
        { accountCode: ACCOUNTS.EXPENSE_ADMIN, side: "debit", expression: "depreciationAmount" },
        { accountCode: ACCOUNTS.DEPRECIATION_ACCUM, side: "credit", expression: "depreciationAmount" }
      ],
      opensItem: false,
      requiresCounterparty: false
    }
  },
  {
    code: "RENT_ACCRUAL",
    name: "Начисление аренды (неденежное)",
    mode: "MANUAL_ONLY",
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
    // $fxAccountCode — код переоцениваемого валютного счёта из payload: 5210 (валютный банк.
    // счёт), но также применимо к 4010/4310/6010/6820 и т.д., если по ним ведётся учёт в
    // иностранной валюте. Знак fxDifference — это эффект переоценки на капитал (+ прибыль,
    // − убыток), а не просто "курс вырос/упал": для дебетовых (активных) статей рост курса
    // обычно даёт +, для кредитовых (пассивных, напр. 6010/6820) рост курса даёт − (мы
    // должны больше) — расчёт знака выполняется вручную при подготовке проводки.
    code: "FX_DIFFERENCE",
    name: "Курсовая разница валютных счетов",
    mode: "MANUAL_ONLY",
    template: {
      lines: [
        { accountCode: "$fxAccountCode", side: "debit", expression: "fxDifference", condition: "fxDifference > 0" },
        { accountCode: ACCOUNTS.FX_INCOME, side: "credit", expression: "fxDifference", condition: "fxDifference > 0" },
        { accountCode: ACCOUNTS.FX_EXPENSE, side: "debit", expression: "-fxDifference", condition: "fxDifference < 0" },
        { accountCode: "$fxAccountCode", side: "credit", expression: "-fxDifference", condition: "fxDifference < 0" }
      ],
      opensItem: false,
      requiresCounterparty: false
    }
  },
  {
    code: "SOCIAL_TAX_PAYMENT",
    name: "Уплата социального налога",
    mode: "BANK_AUTO",
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
    code: "INPS_PAYMENT",
    name: "Уплата ИНПС (накопительная пенсия)",
    mode: "BANK_AUTO",
    template: {
      lines: [
        { accountCode: "6530", side: "debit", expression: "amount" },
        { accountCode: "5110", side: "credit", expression: "amount" }
      ],
      opensItem: false,
      requiresCounterparty: false
    }
  },
  {
    code: "SALARY_OFFSET",
    name: "Зачёт займа сотруднику в счёт зарплаты",
    mode: "MANUAL_ONLY",
    template: {
      lines: [
        { accountCode: "6710", side: "debit", expression: "amount" },
        { accountCode: "4720", side: "credit", expression: "amount" }
      ],
      opensItem: false,
      requiresCounterparty: false
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
      closesOpenItemByAccount: "6820",
      requiresCounterparty: true
    }
  },
  {
    code: "PROFIT_TAX_ACCRUAL",
    name: "Начисление налога на прибыль",
    mode: "MANUAL_ONLY",
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
    mode: "MANUAL_ONLY",
    template: {
      lines: [],
      opensItem: false,
      requiresCounterparty: false
    }
  },
  {
    code: "TURNOVER_TAX_ACCRUAL",
    name: "Начисление налога с оборота",
    mode: "MANUAL_ONLY",
    template: {
      lines: [
        { accountCode: "9810", side: "debit", expression: "taxAmount" },
        { accountCode: "6410", side: "credit", expression: "taxAmount" }
      ],
      opensItem: false,
      requiresCounterparty: false
    }
  },

  // ────────────────────────────────────────────────────────────────
  // НАЧИСЛЕНЧЕСКИЕ ТИПЫ (mode: "MANUAL_ONLY")
  // ────────────────────────────────────────────────────────────────
  {
    code: "GOODS_RECEIVED",
    name: "Поступление товаров (начисление постоплаты)",
    mode: "MANUAL_ONLY",
    template: {
      lines: [
        { accountCode: "2910", side: "debit", expression: "amount - vatAmount" },
        { accountCode: "4410", side: "debit", expression: "vatAmount", condition: "vatAmount > 0" },
        { accountCode: "6010", side: "credit", expression: "amount" }
      ],
      opensItem: true,
      itemAccountCode: "6010",
      requiresCounterparty: true
    }
  },
  {
    code: "GOODS_RECEIVED_PREPAID",
    name: "Поступление товаров (зачет аванса)",
    mode: "MANUAL_ONLY",
    template: {
      lines: [
        { accountCode: "2910", side: "debit", expression: "amount - vatAmount" },
        { accountCode: "4410", side: "debit", expression: "vatAmount", condition: "vatAmount > 0" },
        { accountCode: "4310", side: "credit", expression: "amount" }
      ],
      opensItem: false,
      closesOpenItemByAccount: "4310",
      requiresCounterparty: true
    }
  },
  {
    code: "SERVICE_RECEIVED",
    name: "Получение услуги (начисление постоплаты)",
    mode: "MANUAL_ONLY",
    template: {
      // 9130 — себестоимость услуг, ПРОДАВАЕМЫХ клиентам, а не купленных у поставщика.
      // Покупка услуги (юр./IT/консалтинг) — административный/прочий операционный расход.
      lines: [
        { accountCode: "9420", side: "debit", expression: "amount - vatAmount" },
        { accountCode: "4410", side: "debit", expression: "vatAmount", condition: "vatAmount > 0" },
        { accountCode: "6010", side: "credit", expression: "amount" }
      ],
      opensItem: true,
      itemAccountCode: "6010",
      requiresCounterparty: true
    }
  },
  {
    code: "SERVICE_RECEIVED_PREPAID",
    name: "Получение услуги (зачет аванса)",
    mode: "MANUAL_ONLY",
    template: {
      lines: [
        { accountCode: "9420", side: "debit", expression: "amount - vatAmount" },
        { accountCode: "4410", side: "debit", expression: "vatAmount", condition: "vatAmount > 0" },
        { accountCode: "4310", side: "credit", expression: "amount" }
      ],
      opensItem: false,
      closesOpenItemByAccount: "4310",
      requiresCounterparty: true
    }
  },
  {
    code: "INVOICE_CONFIRMED",
    name: "Подтверждение ЭСФ покупателем (начисление постоплаты)",
    mode: "MANUAL_ONLY",
    template: {
      lines: [
        { accountCode: "4010", side: "debit", expression: "amount" },
        { accountCode: "9030", side: "credit", expression: "amount - vatAmount" },
        { accountCode: "6410", side: "credit", expression: "vatAmount", condition: "vatAmount > 0" }
      ],
      opensItem: true,
      itemAccountCode: "4010",
      requiresCounterparty: true
    }
  },
  {
    code: "INVOICE_CONFIRMED_PREPAID",
    name: "Подтверждение ЭСФ покупателем (зачет аванса)",
    mode: "MANUAL_ONLY",
    template: {
      lines: [
        { accountCode: "6310", side: "debit", expression: "amount" },
        { accountCode: "9030", side: "credit", expression: "amount - vatAmount" },
        { accountCode: "6410", side: "credit", expression: "vatAmount", condition: "vatAmount > 0" }
      ],
      opensItem: false,
      requiresCounterparty: true
    }
  },

  // ────────────────────────────────────────────────────────────────
  // БАНКОВСКИЕ ТИПЫ — КАПИТАЛЬНЫЕ И ПРОЧИЕ
  // ────────────────────────────────────────────────────────────────
  {
    code: "FIXED_ASSET_PURCHASE",
    name: "Приобретение основного средства",
    mode: "BANK_AUTO",
    template: {
      lines: [
        { accountCode: "0820", side: "debit", expression: "amount" },
        { accountCode: "5110", side: "credit", expression: "amount" }
      ],
      opensItem: false,
      requiresCounterparty: true
    }
  },
  {
    code: "BANK_COMMISSION",
    name: "Комиссия банка",
    mode: "BANK_AUTO",
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
    code: "SUPPLIER_REFUND",
    name: "Возврат от поставщика",
    mode: "BANK_AUTO",
    template: {
      lines: [
        { accountCode: "5110", side: "debit", expression: "amount" },
        { accountCode: "4310", side: "credit", expression: "amount" }
      ],
      opensItem: false,
      // When the supplier returns our advance, the 4310 OpenItem should be closed
      closesOpenItemByAccount: "4310",
      requiresCounterparty: true
    }
  },
  {
    code: "ADVANCE_RETURN_SENT",
    name: "Возврат ошибочно полученного аванса покупателю",
    mode: "BANK_AUTO",
    template: {
      lines: [
        { accountCode: "6310", side: "debit", expression: "amount" },
        { accountCode: "5110", side: "credit", expression: "amount" }
      ],
      opensItem: false,
      // When we return an erroneous advance, the 6310 OpenItem should be closed
      closesOpenItemByAccount: "6310",
      requiresCounterparty: true
    }
  },
  {
    code: "BANK_LOAN_RECEIVED",
    name: "Получение банковского кредита",
    mode: "BANK_AUTO",
    template: {
      lines: [
        { accountCode: "5110", side: "debit", expression: "amount" },
        { accountCode: "6810", side: "credit", expression: "amount" }
      ],
      opensItem: true,
      itemAccountCode: "6810",
      requiresCounterparty: true
    }
  },
  {
    code: "BANK_LOAN_REPAYMENT",
    name: "Погашение банковского кредита",
    mode: "BANK_AUTO",
    template: {
      lines: [
        { accountCode: "6810", side: "debit", expression: "amount" },
        { accountCode: "5110", side: "credit", expression: "amount" }
      ],
      opensItem: false,
      closesOpenItemByAccount: "6810",
      requiresCounterparty: true
    }
  },
  {
    code: "EMPLOYEE_LOAN",
    name: "Займ сотруднику",
    mode: "BANK_AUTO",
    template: {
      lines: [
        { accountCode: "4720", side: "debit", expression: "amount" },
        { accountCode: "5110", side: "credit", expression: "amount" }
      ],
      opensItem: true,
      itemAccountCode: "4720",
      requiresCounterparty: false
    }
  },
  {
    code: "EMPLOYEE_LOAN_REPAYMENT",
    name: "Возврат займа сотрудником",
    mode: "BANK_AUTO",
    template: {
      lines: [
        { accountCode: "5110", side: "debit", expression: "amount" },
        { accountCode: "4720", side: "credit", expression: "amount" }
      ],
      opensItem: false,
      requiresCounterparty: false
    }
  },
  {
    // НСБУ-21 §344, §348: 8330 увеличивается только через декларационную проводку
    // (см. OPENING_CAPITAL_DECLARATION), а фактическая оплата гасит долг учредителя
    // на счёте 4610 — она НЕ создаёт капитал напрямую.
    code: "CAPITAL_CONTRIBUTION",
    name: "Оплата доли в уставном капитале",
    mode: "BANK_AUTO",
    template: {
      lines: [
        { accountCode: "5110", side: "debit", expression: "amount" },
        { accountCode: "4610", side: "credit", expression: "amount" }
      ],
      opensItem: false,
      closesOpenItemByAccount: "4610",
      requiresCounterparty: true
    }
  },
  {
    // Довзнос учредителя сверх зарегистрированного устава — до регистрации
    // изменений устава это обязательство компании перед учредителем (6630),
    // а не капитал. Реклассифицируется в 8330 вручную через
    // CAPITAL_INCREASE_REGISTERED после регистрации изменений.
    code: "CAPITAL_INCREASE_PENDING",
    name: "Довзнос учредителя сверх устава (до регистрации изменений)",
    mode: "BANK_AUTO",
    template: {
      lines: [
        { accountCode: "5110", side: "debit", expression: "amount" },
        { accountCode: "6630", side: "credit", expression: "amount" }
      ],
      opensItem: true,
      itemAccountCode: "6630",
      requiresCounterparty: true
    }
  },
  {
    code: "CAPITAL_INCREASE_REGISTERED",
    name: "Реклассификация довзноса в уставный капитал (после регистрации устава)",
    mode: "MANUAL_ONLY",
    template: {
      lines: [
        { accountCode: "6630", side: "debit", expression: "amount" },
        { accountCode: "8330", side: "credit", expression: "amount" }
      ],
      opensItem: false,
      closesOpenItemByAccount: "6630",
      requiresCounterparty: true
    }
  },
  {
    // Разовый декларационный документ, создаётся POST /api/settings/charter-capital
    // при первом указании уставного капитала (и повторно — при регистрации его
    // увеличения). Условные строки покрывают все 4 варианта fundingType из ТЗ;
    // строки с нулевой суммой/невыполненным условием пропускаются движком проводок.
    code: "OPENING_CAPITAL_DECLARATION",
    name: "Декларация уставного капитала",
    mode: "MANUAL_ONLY",
    template: {
      lines: [
        { accountCode: "4610", side: "debit", expression: "amount" },
        { accountCode: "8330", side: "credit", expression: "amount" },
        { accountCode: "5110", side: "debit", expression: "amount", condition: "fundingType == 'FULLY_PAID_CASH'" },
        { accountCode: "4610", side: "credit", expression: "amount", condition: "fundingType == 'FULLY_PAID_CASH'" },
        { accountCode: "5110", side: "debit", expression: "paidAmount", condition: "fundingType == 'PARTIALLY_PAID'" },
        { accountCode: "4610", side: "credit", expression: "paidAmount", condition: "fundingType == 'PARTIALLY_PAID'" },
        { accountCode: "$fundedAccountCode", side: "debit", expression: "paidAmount", condition: "fundingType == 'PAID_IN_KIND'" },
        { accountCode: "4610", side: "credit", expression: "paidAmount", condition: "fundingType == 'PAID_IN_KIND'" }
      ],
      opensItem: false,
      requiresCounterparty: false
    }
  },

  // ────────────────────────────────────────────────────────────────
  // МАРКЕТПЛЕЙС / ЭКВАЙРИНГ
  // ────────────────────────────────────────────────────────────────
  {
    code: "MARKETPLACE_INCOME",
    name: "Поступление от маркетплейса (расчёты с агрегатором)",
    mode: "BANK_AUTO",
    template: {
      lines: [
        { accountCode: "5110", side: "debit", expression: "amount" },
        { accountCode: "4890", side: "credit", expression: "amount" }
      ],
      opensItem: true,
      itemAccountCode: "4890",
      requiresCounterparty: true
    }
  },
  // ────────────────────────────────────────────────────────────────
  // ВЫБЫТИЕ ОСНОВНЫХ СРЕДСТВ
  // ────────────────────────────────────────────────────────────────
  {
    code: "FIXED_ASSET_DISPOSAL",
    name: "Выбытие (списание) основного средства",
    mode: "MANUAL_ONLY",
    template: {
      lines: [
        // Снимаем накопленный износ (Дт контрсчёт 0200 / Кт счёт ОС из payload.assetAccountCode)
        { accountCode: "0200", side: "debit", expression: "accumulatedDepreciation" },
        // Снимаем остаточную стоимость на счёт выбытия 9210
        { accountCode: "9210", side: "debit", expression: "acquisitionCost - accumulatedDepreciation", condition: "acquisitionCost > accumulatedDepreciation" },
        // Кредитуем фактический счёт ОС (0140/0150/0160/0190 — передаётся в payload.assetAccountCode)
        { accountCode: "$assetAccountCode", side: "credit", expression: "acquisitionCost" }
      ],
      opensItem: false,
      requiresCounterparty: false
    }
  },

  // ────────────────────────────────────────────────────────────────
  // ПРОДАЖА ОСНОВНОГО СРЕДСТВА (банковское поступление)
  // ────────────────────────────────────────────────────────────────
  {
    code: "FIXED_ASSET_SALE",
    name: "Поступление от продажи основного средства",
    mode: "BANK_AUTO",
    template: {
      lines: [
        // Дебет 5110 всегда на полную сумму поступления
        { accountCode: "5110", side: "debit", expression: "amount" },
        // Если НДС: 9210 Кт = amount / 1.12, иначе 9210 Кт = amount
        { accountCode: "9210", side: "credit", expression: `amount / ${vatDivisor}`, condition: "isVatPayer" },
        { accountCode: "9210", side: "credit", expression: "amount", condition: "isVatPayer == 0" },
        // Если НДС: 6410 Кт = amount - amount / 1.12
        { accountCode: "6410", side: "credit", expression: `amount - (amount / ${vatDivisor})`, condition: "isVatPayer" }
      ],
      opensItem: false,
      requiresCounterparty: true
    }
  },

  // ────────────────────────────────────────────────────────────────
  // ФИНАНСОВЫЕ РАСХОДЫ
  // ────────────────────────────────────────────────────────────────
  {
    code: "INTEREST_PAYMENT",
    name: "Выплата процентов по кредиту / займу",
    mode: "BANK_AUTO",
    template: {
      lines: [
        { accountCode: "9610", side: "debit", expression: "amount" },
        { accountCode: "5110", side: "credit", expression: "amount" }
      ],
      opensItem: false,
      requiresCounterparty: true
    }
  },
  {
    // Двухшаговая операция по НСБУ: сначала начисление (DIVIDEND_ACCRUAL, 8710→6610),
    // затем оплата отсюда (6610→5110). Прямая проводка 8710→5110 пропускала
    // промежуточное обязательство перед учредителем на счёте 6610.
    // При выплате удерживается налог 5% (DIVIDEND_TAX) в бюджет.
    code: "DIVIDEND_PAYMENT",
    name: "Выплата дивидендов учредителям",
    mode: "BANK_AUTO",
    template: {
      lines: [
        // Налог у источника 5%: Дт 6610 — Кт 6410
        { accountCode: "6610", side: "debit", expression: `amount * ${TAX_RATES.DIVIDEND_TAX}` },
        { accountCode: "6410", side: "credit", expression: `amount * ${TAX_RATES.DIVIDEND_TAX}` },
        // Чистая выплата учредителю 95%: Дт 6610 — Кт 5110
        { accountCode: "6610", side: "debit", expression: `amount * (1 - ${TAX_RATES.DIVIDEND_TAX})` },
        { accountCode: "5110", side: "credit", expression: `amount * (1 - ${TAX_RATES.DIVIDEND_TAX})` }
      ],
      opensItem: false,
      closesOpenItemByAccount: "6610",
      requiresCounterparty: true
    }
  },
  {
    code: "DIVIDEND_ACCRUAL",
    name: "Начисление дивидендов учредителям",
    mode: "MANUAL_ONLY",
    template: {
      lines: [
        { accountCode: "8710", side: "debit", expression: "amount" },
        { accountCode: "6610", side: "credit", expression: "amount" }
      ],
      opensItem: true,
      itemAccountCode: "6610",
      requiresCounterparty: true
    }
  },

  // ────────────────────────────────────────────────────────────────
  // ПРОЧИЕ ОПЕРАЦИОННЫЕ РАСХОДЫ
  // ────────────────────────────────────────────────────────────────
  {
    code: "FINE_PENALTY",
    name: "Штраф, пеня, неустойка (уплата)",
    mode: "BANK_AUTO",
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
    code: "INSURANCE_PAYMENT",
    name: "Страховой взнос (предоплата)",
    mode: "BANK_AUTO",
    template: {
      lines: [
        { accountCode: "3120", side: "debit", expression: "amount" },
        { accountCode: "5110", side: "credit", expression: "amount" }
      ],
      opensItem: false,
      requiresCounterparty: true
    }
  },
  {
    code: "UTILITY_PAYMENT",
    name: "Коммунальные услуги (электроэнергия, вода, газ, тепло)",
    mode: "BANK_AUTO",
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
    code: "SUBSCRIPTION",
    name: "Подписка, лицензия, SaaS-сервис",
    mode: "BANK_AUTO",
    template: {
      lines: [
        // monthly: прямое списание в расходы (9420)
        { accountCode: "9420", side: "debit", expression: "amount", condition: "subscriptionPeriod == 'monthly'" },
        // annual / multi-month: расходы будущих периодов (3120)
        { accountCode: "3120", side: "debit", expression: "amount", condition: "subscriptionPeriod != 'monthly'" },
        { accountCode: "5110", side: "credit", expression: "amount" }
      ],
      opensItem: false,
      requiresCounterparty: true
    }
  },
  {
    code: "SUBSCRIPTION_WRITEOFF",
    name: "Списание расходов будущих периодов (подписка)",
    mode: "MANUAL_ONLY",
    template: {
      lines: [
        { accountCode: "9420", side: "debit", expression: "amount" },
        { accountCode: "3120", side: "credit", expression: "amount" }
      ],
      opensItem: false,
      requiresCounterparty: false
    }
  },
  {
    code: "CUSTOMS_DUTY",
    name: "Таможенные платежи и пошлины",
    mode: "BANK_AUTO",
    template: {
      lines: [
        // import_goods: пошлина включается в стоимость ТМЗ (2910)
        { accountCode: "2910", side: "debit", expression: "amount", condition: "customsType == 'import_goods'" },
        // import_asset: пошлина включается в стоимость ОС (0820)
        { accountCode: "0820", side: "debit", expression: "amount", condition: "customsType == 'import_asset'" },
        // other / default: пошлина в прочие расходы (9430)
        { accountCode: "9430", side: "debit", expression: "amount", condition: "customsType != 'import_goods' && customsType != 'import_asset'" },
        { accountCode: "5110", side: "credit", expression: "amount" }
      ],
      opensItem: false,
      requiresCounterparty: false
    }
  },

  {
    code: "RENT_PAYMENT",
    name: "Оплата аренды (после начисления)",
    mode: "BANK_AUTO",
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
    code: "ACCOUNTABLE_GENERAL",
    name: "Подотчётные суммы (общехозяйственные расходы)",
    mode: "BANK_AUTO",
    template: {
      lines: [
        { accountCode: "4230", side: "debit", expression: "amount" },
        { accountCode: "5110", side: "credit", expression: "amount" }
      ],
      opensItem: true,
      itemAccountCode: "4230",
      requiresCounterparty: false
    }
  },
  // ────────────────────────────────────────────────────────────────
  // СКЛАДСКОЙ УЧЁТ ТОВАРОВ
  // ────────────────────────────────────────────────────────────────
  {
    code: "GOODS_SOLD",
    name: "Списание себестоимости реализованных товаров",
    mode: "MANUAL_ONLY",
    template: {
      lines: [
        { accountCode: "9120", side: "debit", expression: "amount" },
        { accountCode: "2910", side: "credit", expression: "amount" }
      ],
      opensItem: false,
      requiresCounterparty: false
    }
  },

  // ────────────────────────────────────────────────────────────────
  // ВВОД ОС В ЭКСПЛУАТАЦИЮ
  // ────────────────────────────────────────────────────────────────
  {
    code: "FIXED_ASSET_COMMISSIONING",
    name: "Ввод основного средства в эксплуатацию",
    mode: "MANUAL_ONLY",
    template: {
      lines: [
        // assetAccountCode из payload: 0130/0140/0150/0160/0190 и т.д.
        { accountCode: "$assetAccountCode", side: "debit", expression: "acquisitionCost" },
        { accountCode: "0820", side: "credit", expression: "acquisitionCost" }
      ],
      opensItem: false,
      requiresCounterparty: false
    }
  },

  // ────────────────────────────────────────────────────────────────
  // ПРИЗНАНИЕ РЕЗУЛЬТАТА ОТ ВЫБЫТИЯ ОС
  // ────────────────────────────────────────────────────────────────
  {
    code: "FIXED_ASSET_DISPOSAL_RESULT",
    name: "Признание прибыли/убытка от выбытия ОС (закрытие 9210)",
    mode: "MANUAL_ONLY",
    template: {
      lines: [
        // Прибыль: выручка > остаточная стоимость → Дт 9210 — Кт 9310
        { accountCode: "9210", side: "debit",  expression: "profit", condition: "profit > 0" },
        { accountCode: "9310", side: "credit", expression: "profit", condition: "profit > 0" },
        // Убыток: остаточная стоимость > выручка → Дт 9320 — Кт 9210
        { accountCode: "9320", side: "debit",  expression: "loss",   condition: "loss > 0" },
        { accountCode: "9210", side: "credit", expression: "loss",   condition: "loss > 0" }
      ],
      opensItem: false,
      requiresCounterparty: false
    }
  },

  // ────────────────────────────────────────────────────────────────
  // ЗАЧЁТ НДС
  // ────────────────────────────────────────────────────────────────
  {
    code: "VAT_OFFSET",
    name: "Зачёт входящего НДС в счёт исходящего (4410 → 6410)",
    mode: "MANUAL_ONLY",
    template: {
      lines: [
        { accountCode: "6410", side: "debit",  expression: "vatAmount" },
        { accountCode: "4410", side: "credit", expression: "vatAmount" }
      ],
      opensItem: false,
      requiresCounterparty: false
    }
  },

  // ────────────────────────────────────────────────────────────────
  // ЕЖЕМЕСЯЧНОЕ СПИСАНИЕ СТРАХОВКИ
  // ────────────────────────────────────────────────────────────────
  {
    code: "INSURANCE_WRITEOFF",
    name: "Списание предоплаченной страховки по периодам",
    mode: "MANUAL_ONLY",
    template: {
      lines: [
        { accountCode: "9420", side: "debit",  expression: "amount" },
        { accountCode: "3120", side: "credit", expression: "amount" }
      ],
      opensItem: false,
      requiresCounterparty: false
    }
  },

  {
    // Payload:
    //   amount            — полная сумма продажи клиенту (с НДС, до удержания комиссии)
    //   netAmount         — сумма, фактически поступившая от агрегатора (после комиссии)
    //   commissionAmount  — удержанная комиссия агрегатора
    // Инвариант баланса проводки: netAmount + commissionAmount == amount
    // (иначе postDocument выбросит ошибку "Несбалансированная проводка").
    code: "MARKETPLACE_REVENUE",
    name: "Выручка маркетплейса (зачет расчётов с агрегатором и комиссия)",
    mode: "MANUAL_ONLY",
    template: {
      lines: [
        { accountCode: "4890", side: "debit", expression: "netAmount" },
        { accountCode: "9430", side: "debit", expression: "commissionAmount" },
        { accountCode: "9030", side: "credit", expression: "amount - vatAmount" },
        { accountCode: "6410", side: "credit", expression: "vatAmount", condition: "vatAmount > 0" }
      ],
      opensItem: false,
      requiresCounterparty: true
    }
  },

  // ────────────────────────────────────────────────────────────────
  // ЗАКРЫТИЕ ПОДОТЧЁТНЫХ СУММ (авансовый отчёт сотрудника)
  // ────────────────────────────────────────────────────────────────
  {
    code: "ACCOUNTABLE_WRITEOFF",
    name: "Списание подотчётных сумм (командировочные, авансовый отчёт)",
    mode: "MANUAL_ONLY",
    template: {
      lines: [
        { accountCode: "9420", side: "debit", expression: "amount" },
        { accountCode: "4220", side: "credit", expression: "amount" }
      ],
      opensItem: false,
      closesOpenItemByAccount: "4220",
      requiresCounterparty: true
    }
  },
  {
    code: "ACCOUNTABLE_RETURN",
    name: "Возврат неизрасходованного остатка подотчётных сумм (командировочные)",
    mode: "BANK_AUTO",
    template: {
      lines: [
        { accountCode: "5110", side: "debit", expression: "amount" },
        { accountCode: "4220", side: "credit", expression: "amount" }
      ],
      opensItem: false,
      closesOpenItemByAccount: "4220",
      requiresCounterparty: true
    }
  },
  {
    code: "ACCOUNTABLE_GENERAL_WRITEOFF",
    name: "Списание подотчётных сумм (общехозяйственные расходы)",
    mode: "MANUAL_ONLY",
    template: {
      lines: [
        { accountCode: "9430", side: "debit", expression: "amount" },
        { accountCode: "4230", side: "credit", expression: "amount" }
      ],
      opensItem: false,
      closesOpenItemByAccount: "4230",
      requiresCounterparty: true
    }
  },
  {
    code: "ACCOUNTABLE_GENERAL_RETURN",
    name: "Возврат неизрасходованного остатка подотчётных сумм (общехозяйственные)",
    mode: "BANK_AUTO",
    template: {
      lines: [
        { accountCode: "5110", side: "debit", expression: "amount" },
        { accountCode: "4230", side: "credit", expression: "amount" }
      ],
      opensItem: false,
      closesOpenItemByAccount: "4230",
      requiresCounterparty: true
    }
  },

  // ────────────────────────────────────────────────────────────────
  // ВОЗВРАТ ГАРАНТИЙНОГО ДЕПОЗИТА
  // ────────────────────────────────────────────────────────────────
  {
    code: "DEPOSIT_RETURN",
    name: "Возврат гарантийного депозита",
    mode: "BANK_AUTO",
    template: {
      lines: [
        { accountCode: "5110", side: "debit", expression: "amount" },
        { accountCode: "4890", side: "credit", expression: "amount" }
      ],
      opensItem: false,
      closesOpenItemByAccount: "4890",
      requiresCounterparty: true
    }
  },

  // ────────────────────────────────────────────────────────────────
  // ВНУТРЕННИЙ ПЕРЕВОД — ВХОДЯЩАЯ СТОРОНА
  // ────────────────────────────────────────────────────────────────
  {
    // Закрывает (нетто по дебету/кредиту) транзитный счёт 5710, открытый исходящей
    // стороной перевода (см. INTERNAL_TRANSFER: Дт 5710 — Кт 5110). Счёт назначения
    // параметризуется через payload.destinationAccountCode (по умолчанию 5210).
    code: "INTERNAL_TRANSFER_RECEIVED",
    name: "Внутренний перевод (поступление)",
    mode: "BANK_AUTO",
    template: {
      lines: [
        { accountCode: "$destinationAccountCode", side: "debit", expression: "amount" },
        { accountCode: "5710", side: "credit", expression: "amount" }
      ],
      opensItem: false,
      closesOpenItemByAccount: "5710",
      requiresCounterparty: false
    }
  },

  // ────────────────────────────────────────────────────────────────
  // НЕМАТЕРИАЛЬНЫЕ АКТИВЫ (лицензии, товарные знаки, патенты, SaaS на срок > 1 года)
  // ────────────────────────────────────────────────────────────────
  {
    code: "INTANGIBLE_ASSET_PURCHASE",
    name: "Приобретение нематериального актива",
    mode: "BANK_AUTO",
    template: {
      lines: [
        { accountCode: "0830", side: "debit", expression: "amount" },
        { accountCode: "5110", side: "credit", expression: "amount" }
      ],
      opensItem: false,
      requiresCounterparty: true
    }
  },
  {
    // $assetAccountCode из payload: 0410 (патенты/лицензии/ноу-хау), 0420 (товарные знаки),
    // 0430 (программное обеспечение) и т.д.
    code: "INTANGIBLE_ASSET_COMMISSIONING",
    name: "Ввод нематериального актива в эксплуатацию",
    mode: "MANUAL_ONLY",
    template: {
      lines: [
        { accountCode: "$assetAccountCode", side: "debit", expression: "acquisitionCost" },
        { accountCode: "0830", side: "credit", expression: "acquisitionCost" }
      ],
      opensItem: false,
      requiresCounterparty: false
    }
  },

  // ─── STAGE 2: NEW-01..NEW-16 ─────────────────────────────────────────────

  // NEW-01: Начисление амортизации НМА
  {
    code: "NMA_AMORTIZATION",
    name: "Начисление амортизации НМА",
    mode: "MANUAL_ONLY",
    template: {
      lines: [
        { accountCode: "$expenseAccountCode", side: "debit", expression: "amount" },
        { accountCode: "$amortizationAccountCode", side: "credit", expression: "amount" }
      ],
      opensItem: false,
      requiresCounterparty: false
    }
  },

  // NEW-02: Снятие наличных с расчётного счёта
  {
    code: "CASH_WITHDRAWAL",
    name: "Снятие наличных с расчётного счёта",
    mode: "BANK_AUTO",
    template: {
      lines: [
        { accountCode: "5010", side: "debit", expression: "amount" },
        { accountCode: "5110", side: "credit", expression: "amount" }
      ],
      opensItem: false,
      requiresCounterparty: false
    }
  },

  // NEW-03: Взнос наличных на расчётный счёт
  {
    code: "CASH_DEPOSIT",
    name: "Взнос наличных на расчётный счёт",
    mode: "BANK_AUTO",
    template: {
      lines: [
        { accountCode: "5110", side: "debit", expression: "amount" },
        { accountCode: "5010", side: "credit", expression: "amount" }
      ],
      opensItem: false,
      requiresCounterparty: false
    }
  },

  // NEW-04: Уплата импортного НДС
  {
    code: "IMPORT_VAT_PAYMENT",
    name: "Уплата импортного НДС",
    mode: "BANK_AUTO",
    template: {
      lines: [
        { accountCode: "4410", side: "debit", expression: "amount" },
        { accountCode: "5110", side: "credit", expression: "amount" }
      ],
      opensItem: false,
      requiresCounterparty: false
    }
  },

  // NEW-05: Предоплата аренды
  {
    code: "PREPAID_RENT_PAYMENT",
    name: "Предоплата аренды",
    mode: "BANK_AUTO",
    template: {
      lines: [
        { accountCode: "3110", side: "debit", expression: "amount" },
        { accountCode: "5110", side: "credit", expression: "amount" }
      ],
      opensItem: false,
      requiresCounterparty: false
    }
  },

  // NEW-06: Признание предоплаченной аренды (ежемесячное списание)
  {
    code: "PREPAID_RENT_RECOGNITION",
    name: "Признание предоплаченной аренды",
    mode: "MANUAL_ONLY",
    template: {
      lines: [
        { accountCode: "9420", side: "debit", expression: "amount" },
        { accountCode: "3110", side: "credit", expression: "amount" }
      ],
      opensItem: false,
      requiresCounterparty: false
    }
  },

  // NEW-07: Возврат товара от покупателя
  {
    code: "GOODS_RETURNED_FROM_CUSTOMER",
    name: "Возврат товара от покупателя",
    mode: "MANUAL_ONLY",
    template: {
      lines: [
        // Сторно выручки: Дт 9040 — Кт settlementAccountCode
        { accountCode: "9040", side: "debit", expression: "amount" },
        { accountCode: "$settlementAccountCode", side: "credit", expression: "amount" },
        // Корректировка НДС: Дт 6410 — Кт settlementAccountCode (сторно НДС с выручки)
        { accountCode: "6410", side: "debit", expression: "vatAmount" },
        { accountCode: "$settlementAccountCode", side: "credit", expression: "vatAmount" },
        // Восстановление себестоимости: Дт 2910 — Кт 9120
        { accountCode: "2910", side: "debit", expression: "costAmount" },
        { accountCode: "9120", side: "credit", expression: "costAmount" }
      ],
      opensItem: false,
      requiresCounterparty: true
    }
  },

  // NEW-08: Взаимозачёт с контрагентом
  {
    code: "COUNTERPARTY_SETOFF",
    name: "Взаимозачёт с контрагентом",
    mode: "MANUAL_ONLY",
    template: {
      lines: [
        { accountCode: "6010", side: "debit", expression: "amount" },
        { accountCode: "4010", side: "credit", expression: "amount" }
      ],
      opensItem: false,
      requiresCounterparty: true
    }
  },

  // NEW-09: Возврат НДС из бюджета
  {
    code: "VAT_REFUND_FROM_BUDGET",
    name: "Возврат НДС из бюджета",
    mode: "BANK_AUTO",
    template: {
      lines: [
        { accountCode: "5110", side: "debit", expression: "amount" },
        { accountCode: "4410", side: "credit", expression: "amount" }
      ],
      opensItem: false,
      requiresCounterparty: false
    }
  },

  // NEW-10: Оприходование годных остатков после выбытия ОС
  {
    code: "FIXED_ASSET_SALVAGE",
    name: "Оприходование годных остатков после выбытия ОС",
    mode: "MANUAL_ONLY",
    template: {
      lines: [
        { accountCode: "1090", side: "debit", expression: "amount" },
        { accountCode: "9210", side: "credit", expression: "amount" }
      ],
      opensItem: false,
      requiresCounterparty: false
    }
  },

  // NEW-11: Списание кредиторской задолженности
  {
    code: "WRITE_OFF_CREDITORS",
    name: "Списание кредиторской задолженности",
    mode: "MANUAL_ONLY",
    template: {
      lines: [
        { accountCode: "6010", side: "debit", expression: "amount" },
        { accountCode: "9360", side: "credit", expression: "amount" }
      ],
      opensItem: false,
      requiresCounterparty: true
    }
  },

  // NEW-12: Корректировочный счёт-фактура выданный (уменьшение)
  {
    code: "CORRECTIVE_INVOICE_ISSUED",
    name: "Корректировочный счёт-фактура выданный",
    mode: "MANUAL_ONLY",
    template: {
      lines: [
        // Сторно выручки
        { accountCode: "9030", side: "debit", expression: "correctionAmount" },
        // Сторно НДС
        { accountCode: "6410", side: "debit", expression: "vatCorrection" },
        // Уменьшение дебиторки
        { accountCode: "$settlementAccountCode", side: "credit", expression: "correctionAmount + vatCorrection" }
      ],
      opensItem: false,
      requiresCounterparty: true
    }
  },

  // NEW-13: Корректировочный счёт-фактура полученный (уменьшение)
  {
    code: "CORRECTIVE_INVOICE_RECEIVED",
    name: "Корректировочный счёт-фактура полученный",
    mode: "MANUAL_ONLY",
    template: {
      lines: [
        // Уменьшение кредиторки
        { accountCode: "6010", side: "debit", expression: "correctionAmount + vatCorrection" },
        // Сторно расхода/актива
        { accountCode: "$expenseOrAssetAccountCode", side: "credit", expression: "correctionAmount" },
        // Сторно входящего НДС
        { accountCode: "4410", side: "credit", expression: "vatCorrection" }
      ],
      opensItem: false,
      requiresCounterparty: true
    }
  },

  // NEW-14: Доход от аренды
  {
    code: "RENTAL_INCOME_RECEIVED",
    name: "Доход от аренды",
    mode: "BANK_AUTO",
    template: {
      lines: [
        { accountCode: "5110", side: "debit", expression: "amount" },
        { accountCode: "9350", side: "credit", expression: "amount" }
      ],
      opensItem: false,
      requiresCounterparty: false
    }
  },

  // NEW-15: Процентный доход полученный
  {
    code: "INTEREST_INCOME_RECEIVED",
    name: "Процентный доход полученный",
    mode: "BANK_AUTO",
    template: {
      lines: [
        { accountCode: "5110", side: "debit", expression: "amount" },
        { accountCode: "9530", side: "credit", expression: "amount" }
      ],
      opensItem: false,
      requiresCounterparty: false
    }
  },

  // NEW-16: Аванс по зарплате
  {
    code: "SALARY_ADVANCE",
    name: "Аванс по заработной плате",
    mode: "BANK_AUTO",
    template: {
      lines: [
        { accountCode: "4210", side: "debit", expression: "amount" },
        { accountCode: "5110", side: "credit", expression: "amount" }
      ],
      opensItem: false,
      requiresCounterparty: false
    }
  },

  // ─── STAGE 3: NEW-17..NEW-24 ─────────────────────────────────────────────

  // NEW-17: Резерв по сомнительным долгам
  {
    code: "PROVISION_FOR_DOUBTFUL_DEBTS",
    name: "Резерв по сомнительным долгам",
    mode: "MANUAL_ONLY",
    template: {
      lines: [
        { accountCode: "9430", side: "debit", expression: "amount" },
        { accountCode: "4910", side: "credit", expression: "amount" }
      ],
      opensItem: false,
      requiresCounterparty: false
    }
  },

  // NEW-18: Списание безнадёжной дебиторской задолженности
  {
    code: "BAD_DEBT_WRITEOFF",
    name: "Списание безнадёжной дебиторской задолженности",
    mode: "MANUAL_ONLY",
    template: {
      lines: [
        // При наличии резерва: 4910 Дт — 4010 Кт
        { accountCode: "4910", side: "debit", expression: "amount", condition: "useReserve" },
        // Без резерва: 9430 Дт — 4010 Кт
        { accountCode: "9430", side: "debit", expression: "amount", condition: "!useReserve" },
        { accountCode: "4010", side: "credit", expression: "amount" }
      ],
      opensItem: false,
      requiresCounterparty: true
    }
  },

  // NEW-19: Товары в пути
  {
    code: "GOODS_IN_TRANSIT",
    name: "Товары в пути",
    mode: "BANK_AUTO",
    template: {
      lines: [
        { accountCode: "2970", side: "debit", expression: "amount" },
        { accountCode: "$creditAccountCode", side: "credit", expression: "amount" }
      ],
      opensItem: true,
      itemAccountCode: "2970",
      requiresCounterparty: true
    }
  },

  // NEW-20: Списание ТМЗ
  {
    code: "INVENTORY_WRITEOFF",
    name: "Списание товарно-материальных запасов",
    mode: "MANUAL_ONLY",
    template: {
      lines: [
        { accountCode: "$expenseAccountCode", side: "debit", expression: "amount" },
        { accountCode: "$inventoryAccountCode", side: "credit", expression: "amount" }
      ],
      opensItem: false,
      requiresCounterparty: false
    }
  },

  // NEW-21: Переоценка основных средств
  {
    code: "FIXED_ASSET_REVALUATION",
    name: "Переоценка основных средств",
    mode: "MANUAL_ONLY",
    template: {
      lines: [
        // Дооценка: Дт 01xx — Кт 8510
        { accountCode: "$assetAccountCode", side: "debit", expression: "increaseAmount", condition: "increaseAmount > 0" },
        { accountCode: "8510", side: "credit", expression: "increaseAmount", condition: "increaseAmount > 0" },
        // Корректировка амортизации при дооценке: Дт 8510 — Кт 0200
        { accountCode: "8510", side: "debit", expression: "deprAdjustment", condition: "deprAdjustment > 0" },
        { accountCode: "0200", side: "credit", expression: "deprAdjustment", condition: "deprAdjustment > 0" },
        // Уценка: Дт 9430 — Кт 01xx
        { accountCode: "9430", side: "debit", expression: "decreaseAmount", condition: "decreaseAmount > 0" },
        { accountCode: "$assetAccountCode", side: "credit", expression: "decreaseAmount", condition: "decreaseAmount > 0" }
      ],
      opensItem: false,
      requiresCounterparty: false
    }
  },

  // NEW-22: Получение долгосрочного займа
  {
    code: "LONG_TERM_LOAN_RECEIVED",
    name: "Получение долгосрочного займа",
    mode: "BANK_AUTO",
    template: {
      lines: [
        { accountCode: "5110", side: "debit", expression: "amount" },
        { accountCode: "$loanAccountCode", side: "credit", expression: "amount" }
      ],
      opensItem: true,
      itemAccountCode: "$loanAccountCode",
      requiresCounterparty: false
    }
  },

  // NEW-23: Погашение долгосрочного займа
  {
    code: "LONG_TERM_LOAN_REPAYMENT",
    name: "Погашение долгосрочного займа",
    mode: "BANK_AUTO",
    template: {
      lines: [
        { accountCode: "$loanAccountCode", side: "debit", expression: "amount" },
        { accountCode: "5110", side: "credit", expression: "amount" }
      ],
      opensItem: false,
      closesOpenItemByAccount: "$loanAccountCode",
      requiresCounterparty: false
    }
  },

  // NEW-24: Дивидендный доход полученный
  {
    code: "DIVIDEND_INCOME_RECEIVED",
    name: "Дивидендный доход полученный",
    mode: "BANK_AUTO",
    template: {
      lines: [
        { accountCode: "5110", side: "debit", expression: "amount" },
        { accountCode: "9520", side: "credit", expression: "amount" }
      ],
      opensItem: false,
      requiresCounterparty: false
    }
  },

  // ─── STAGE 4: NEW-25..NEW-44 — операции, предписанные НСБУ-21 через корреспонденцию
  // счетов, для которых план счетов (seed-coa.ts) уже содержит нужные счета, но
  // не было шаблонов проводки. Ссылки на пункты НСБУ-21 — в комментариях по операциям.
  // ────────────────────────────────────────────────────────────────

  // NEW-25: Безвозмездное получение основных средств (НСБУ-21, п. 9, 358)
  {
    code: "GRATUITOUS_RECEIPT_FA",
    name: "Безвозмездное получение основных средств",
    mode: "MANUAL_ONLY",
    template: {
      lines: [
        { accountCode: "$assetAccountCode", side: "debit", expression: "amount" },
        { accountCode: "8530", side: "credit", expression: "amount" }
      ],
      opensItem: false,
      requiresCounterparty: false
    }
  },

  // NEW-26: Безвозмездное получение нематериальных активов (НСБУ-21, п. 44, 419)
  {
    code: "GRATUITOUS_RECEIPT_IA",
    name: "Безвозмездное получение нематериальных активов",
    mode: "MANUAL_ONLY",
    template: {
      lines: [
        { accountCode: "$assetAccountCode", side: "debit", expression: "amount" },
        { accountCode: "8530", side: "credit", expression: "amount" }
      ],
      opensItem: false,
      requiresCounterparty: false
    }
  },

  // NEW-27: Безвозмездное получение материалов (НСБУ-21, п. 731)
  {
    code: "GRATUITOUS_RECEIPT_MATERIALS",
    name: "Безвозмездное получение материалов",
    mode: "MANUAL_ONLY",
    template: {
      lines: [
        { accountCode: "1010", side: "debit", expression: "amount" },
        { accountCode: "8530", side: "credit", expression: "amount" }
      ],
      opensItem: false,
      requiresCounterparty: false
    }
  },

  // NEW-28: Безвозмездное получение товаров (НСБУ-21, п. 1029)
  {
    code: "GRATUITOUS_RECEIPT_GOODS",
    name: "Безвозмездное получение товаров",
    mode: "MANUAL_ONLY",
    template: {
      lines: [
        { accountCode: "2910", side: "debit", expression: "amount" },
        { accountCode: "8530", side: "credit", expression: "amount" }
      ],
      opensItem: false,
      requiresCounterparty: false
    }
  },

  // NEW-29: Безвозмездное получение ценных бумаг (НСБУ-21, п. 485)
  {
    code: "GRATUITOUS_RECEIPT_SECURITIES",
    name: "Безвозмездное получение ценных бумаг",
    mode: "MANUAL_ONLY",
    template: {
      lines: [
        { accountCode: "0610", side: "debit", expression: "amount" },
        { accountCode: "8530", side: "credit", expression: "amount" }
      ],
      opensItem: false,
      requiresCounterparty: false
    }
  },

  // NEW-30: Оприходование излишков при инвентаризации (НСБУ-21, п. 241, 419, 509, 731, 813, 827, 867, 1029)
  {
    code: "INVENTORY_SURPLUS",
    name: "Оприходование излишков, выявленных при инвентаризации",
    mode: "MANUAL_ONLY",
    template: {
      lines: [
        { accountCode: "$assetAccountCode", side: "debit", expression: "amount" },
        { accountCode: "9390", side: "credit", expression: "amount" }
      ],
      opensItem: false,
      requiresCounterparty: false
    }
  },

  // NEW-31: Выявление недостачи при инвентаризации (НСБУ-21, п. 246-247, 1549)
  {
    code: "INVENTORY_SHORTAGE",
    name: "Недостачи, выявленные при инвентаризации",
    mode: "MANUAL_ONLY",
    template: {
      lines: [
        { accountCode: "5910", side: "debit", expression: "amount" },
        { accountCode: "$assetAccountCode", side: "credit", expression: "amount" }
      ],
      opensItem: false,
      requiresCounterparty: false
    }
  },

  // NEW-32: Отнесение недостачи — на виновного или в убыток (НСБУ-21, п. 247, 1549)
  {
    code: "INVENTORY_SHORTAGE_RESOLUTION",
    name: "Отнесение недостачи (на виновного / в убыток)",
    mode: "MANUAL_ONLY",
    template: {
      lines: [
        // Виновный установлен: Дт 4730 — Кт 5910
        { accountCode: "4730", side: "debit", expression: "amount", condition: "hasCulprit" },
        // Виновный не найден / суд отказал: Дт 9430 — Кт 5910
        { accountCode: "9430", side: "debit", expression: "amount", condition: "!hasCulprit" },
        { accountCode: "5910", side: "credit", expression: "amount" }
      ],
      opensItem: false,
      requiresCounterparty: false
    }
  },

  // NEW-33: Формирование резервного капитала из прибыли (НСБУ-21, п. 356, 358)
  {
    code: "RESERVE_CAPITAL_FORMATION",
    name: "Формирование резервного капитала",
    mode: "MANUAL_ONLY",
    template: {
      lines: [
        { accountCode: "8710", side: "debit", expression: "amount" },
        { accountCode: "8520", side: "credit", expression: "amount" }
      ],
      opensItem: false,
      requiresCounterparty: false
    }
  },

  // NEW-34: Создание резерва предстоящих расходов и платежей (НСБУ-21, п. 375-376, 2229)
  {
    code: "PROVISION_FUTURE_EXPENSES",
    name: "Создание резерва предстоящих расходов и платежей",
    mode: "MANUAL_ONLY",
    template: {
      lines: [
        { accountCode: "$expenseAccountCode", side: "debit", expression: "amount" },
        { accountCode: "8910", side: "credit", expression: "amount" }
      ],
      opensItem: false,
      requiresCounterparty: false
    }
  },

  // NEW-35: Использование резерва предстоящих расходов (НСБУ-21, п. 376, 2229)
  {
    code: "PROVISION_FUTURE_EXPENSES_USE",
    name: "Использование резерва предстоящих расходов",
    mode: "MANUAL_ONLY",
    template: {
      lines: [
        { accountCode: "8910", side: "debit", expression: "amount" },
        { accountCode: "$targetAccountCode", side: "credit", expression: "amount" }
      ],
      opensItem: false,
      requiresCounterparty: false
    }
  },

  // NEW-36: Восстановление неиспользованного резерва в доход (НСБУ-21, п. 376, 2229)
  {
    code: "PROVISION_UNUSED_TO_INCOME",
    name: "Восстановление неиспользованного резерва в доход",
    mode: "MANUAL_ONLY",
    template: {
      lines: [
        { accountCode: "8910", side: "debit", expression: "amount" },
        { accountCode: "9390", side: "credit", expression: "amount" }
      ],
      opensItem: false,
      requiresCounterparty: false
    }
  },

  // NEW-37: Признание гранта — уведомление получено (НСБУ-21, п. 369, 2213)
  {
    code: "GRANT_RECEIVABLE",
    name: "Признание гранта (получено уведомление)",
    mode: "MANUAL_ONLY",
    template: {
      lines: [
        { accountCode: "4890", side: "debit", expression: "amount" },
        { accountCode: "8810", side: "credit", expression: "amount" }
      ],
      opensItem: true,
      itemAccountCode: "4890",
      requiresCounterparty: false
    }
  },

  // NEW-38: Получение гранта (деньги / имущество) (НСБУ-21, п. 369, 2213)
  {
    code: "GRANT_RECEIVED",
    name: "Получение гранта",
    mode: "BANK_AUTO",
    template: {
      lines: [
        { accountCode: "5110", side: "debit", expression: "amount" },
        { accountCode: "4890", side: "credit", expression: "amount" }
      ],
      opensItem: false,
      closesOpenItemByAccount: "4890",
      requiresCounterparty: false
    }
  },

  // NEW-39: Признание субсидии — уведомление получено (НСБУ-21, п. 370, 2213)
  {
    code: "SUBSIDY_RECEIVABLE",
    name: "Признание субсидии (получено уведомление)",
    mode: "MANUAL_ONLY",
    template: {
      lines: [
        { accountCode: "4890", side: "debit", expression: "amount" },
        { accountCode: "8820", side: "credit", expression: "amount" }
      ],
      opensItem: true,
      itemAccountCode: "4890",
      requiresCounterparty: false
    }
  },

  // NEW-40: Получение субсидии (НСБУ-21, п. 370, 2213)
  {
    code: "SUBSIDY_RECEIVED",
    name: "Получение субсидии",
    mode: "BANK_AUTO",
    template: {
      lines: [
        { accountCode: "5110", side: "debit", expression: "amount" },
        { accountCode: "4890", side: "credit", expression: "amount" }
      ],
      opensItem: false,
      closesOpenItemByAccount: "4890",
      requiresCounterparty: false
    }
  },

  // NEW-41: Целевые поступления — членские взносы / прочие (НСБУ-21, п. 373, 2213)
  {
    code: "TARGET_RECEIPTS",
    name: "Целевые поступления (членские взносы / прочие)",
    mode: "BANK_AUTO",
    template: {
      lines: [
        { accountCode: "5110", side: "debit", expression: "amount" },
        { accountCode: "8830", side: "credit", expression: "amount", condition: "receiptType == 'membership'" },
        { accountCode: "8890", side: "credit", expression: "amount", condition: "receiptType != 'membership'" }
      ],
      opensItem: false,
      requiresCounterparty: false
    }
  },

  // NEW-42: Признание целевых налоговых льгот (НСБУ-21, п. 372, 2213)
  {
    code: "TAX_EXEMPTION_RECOGNITION",
    name: "Признание целевых налоговых льгот",
    mode: "MANUAL_ONLY",
    template: {
      lines: [
        { accountCode: "6410", side: "debit", expression: "amount" },
        { accountCode: "8840", side: "credit", expression: "amount" }
      ],
      opensItem: false,
      requiresCounterparty: false
    }
  },

  // NEW-43: Переоценка товаров — дооценка/уценка (НСБУ-21, п. 1029)
  {
    code: "GOODS_REVALUATION",
    name: "Переоценка товаров",
    mode: "MANUAL_ONLY",
    template: {
      lines: [
        // Дооценка: Дт 2910 — Кт 6230
        { accountCode: "2910", side: "debit", expression: "increaseAmount", condition: "increaseAmount > 0" },
        { accountCode: "6230", side: "credit", expression: "increaseAmount", condition: "increaseAmount > 0" },
        // Уценка: Дт 3190 — Кт 2910
        { accountCode: "3190", side: "debit", expression: "decreaseAmount", condition: "decreaseAmount > 0" },
        { accountCode: "2910", side: "credit", expression: "decreaseAmount", condition: "decreaseAmount > 0" }
      ],
      opensItem: false,
      requiresCounterparty: false
    }
  },

  // NEW-44: Оприходование товаров в пути на склад (НСБУ-21, п. 1001; закрывает NEW-19 GOODS_IN_TRANSIT)
  {
    code: "GOODS_IN_TRANSIT_RECEIVED",
    name: "Оприходование товаров в пути на склад",
    mode: "MANUAL_ONLY",
    template: {
      lines: [
        { accountCode: "2910", side: "debit", expression: "amount" },
        { accountCode: "2970", side: "credit", expression: "amount" }
      ],
      opensItem: false,
      closesOpenItemByAccount: "2970",
      requiresCounterparty: false
    }
  },

  // ─── STAGE 5: NEW-45..NEW-62 — производство, лизинг и прочие операции, счета
  // для которых уже присутствуют в плане счетов, но проводки не были реализованы.
  // ────────────────────────────────────────────────────────────────

  // NEW-45: Поступление материалов от поставщика
  {
    code: "MATERIALS_RECEIVED",
    name: "Поступление материалов от поставщика",
    mode: "MANUAL_ONLY",
    template: {
      lines: [
        { accountCode: "1010", side: "debit", expression: "amount" },
        { accountCode: "4410", side: "debit", expression: "vatAmount", condition: "vatAmount > 0" },
        { accountCode: "6010", side: "credit", expression: "amount + vatAmount" }
      ],
      opensItem: true,
      itemAccountCode: "6010",
      requiresCounterparty: true
    }
  },

  // NEW-46: Передача материалов в производство
  {
    code: "MATERIALS_TO_PRODUCTION",
    name: "Передача материалов в производство",
    mode: "MANUAL_ONLY",
    template: {
      lines: [
        { accountCode: "2010", side: "debit", expression: "amount" },
        { accountCode: "1010", side: "credit", expression: "amount" }
      ],
      opensItem: false,
      requiresCounterparty: false
    }
  },

  // NEW-47: Выпуск готовой продукции
  {
    code: "FINISHED_GOODS_OUTPUT",
    name: "Выпуск готовой продукции",
    mode: "MANUAL_ONLY",
    template: {
      lines: [
        { accountCode: "2810", side: "debit", expression: "amount" },
        { accountCode: "2010", side: "credit", expression: "amount" }
      ],
      opensItem: false,
      requiresCounterparty: false
    }
  },

  // NEW-48: Списание себестоимости реализованной готовой продукции
  {
    code: "FINISHED_GOODS_SOLD",
    name: "Списание себестоимости реализованной готовой продукции",
    mode: "MANUAL_ONLY",
    template: {
      lines: [
        { accountCode: "9110", side: "debit", expression: "amount" },
        { accountCode: "2810", side: "credit", expression: "amount" }
      ],
      opensItem: false,
      requiresCounterparty: false
    }
  },

  // NEW-49: Возврат материалов поставщику
  {
    code: "MATERIALS_RETURNED_TO_SUPPLIER",
    name: "Возврат материалов поставщику",
    mode: "MANUAL_ONLY",
    template: {
      lines: [
        { accountCode: "6010", side: "debit", expression: "amount" },
        { accountCode: "1010", side: "credit", expression: "amount" }
      ],
      opensItem: false,
      requiresCounterparty: true
    }
  },

  // NEW-50: Получение ОС по финансовой аренде (лизинг) (НСБУ-6)
  {
    code: "FINANCE_LEASE_ASSET_RECEIVED",
    name: "Получение основных средств по финансовой аренде",
    mode: "MANUAL_ONLY",
    template: {
      lines: [
        { accountCode: "0310", side: "debit", expression: "amount" },
        { accountCode: "7910", side: "credit", expression: "amount" }
      ],
      opensItem: true,
      itemAccountCode: "7910",
      requiresCounterparty: true
    }
  },

  // NEW-51: Начисление амортизации по лизинговому имуществу
  {
    code: "FINANCE_LEASE_DEPRECIATION",
    name: "Амортизация имущества по финансовой аренде",
    mode: "MANUAL_ONLY",
    template: {
      lines: [
        { accountCode: "9420", side: "debit", expression: "amount" },
        { accountCode: "0299", side: "credit", expression: "amount" }
      ],
      opensItem: false,
      requiresCounterparty: false
    }
  },

  // NEW-52: Лизинговый платёж (погашение основной суммы)
  {
    code: "FINANCE_LEASE_PAYMENT",
    name: "Платёж по финансовой аренде (основная сумма)",
    mode: "BANK_AUTO",
    template: {
      lines: [
        { accountCode: "7910", side: "debit", expression: "amount" },
        { accountCode: "5110", side: "credit", expression: "amount" }
      ],
      opensItem: false,
      closesOpenItemByAccount: "7910",
      requiresCounterparty: false
    }
  },

  // NEW-53: Проценты по финансовой аренде
  {
    code: "FINANCE_LEASE_INTEREST",
    name: "Проценты по финансовой аренде",
    mode: "BANK_AUTO",
    template: {
      lines: [
        { accountCode: "9610", side: "debit", expression: "amount" },
        { accountCode: "5110", side: "credit", expression: "amount" }
      ],
      opensItem: false,
      requiresCounterparty: false
    }
  },

  // NEW-54: Доход от роялти получен
  {
    code: "ROYALTY_INCOME",
    name: "Доход от роялти получен",
    mode: "BANK_AUTO",
    template: {
      lines: [
        { accountCode: "5110", side: "debit", expression: "amount" },
        { accountCode: "9510", side: "credit", expression: "amount" }
      ],
      opensItem: false,
      requiresCounterparty: true
    }
  },

  // NEW-55: Выплата роялти
  {
    code: "ROYALTY_PAYMENT",
    name: "Выплата роялти",
    mode: "BANK_AUTO",
    template: {
      lines: [
        { accountCode: "9430", side: "debit", expression: "amount" },
        { accountCode: "5110", side: "credit", expression: "amount" }
      ],
      opensItem: false,
      requiresCounterparty: true
    }
  },

  // NEW-56: Открытие аккредитива
  {
    code: "LETTER_OF_CREDIT_OPEN",
    name: "Открытие аккредитива",
    mode: "BANK_AUTO",
    template: {
      lines: [
        { accountCode: "5510", side: "debit", expression: "amount" },
        { accountCode: "5110", side: "credit", expression: "amount" }
      ],
      opensItem: true,
      itemAccountCode: "5510",
      requiresCounterparty: true
    }
  },

  // NEW-57: Исполнение (закрытие) аккредитива
  {
    code: "LETTER_OF_CREDIT_EXECUTION",
    name: "Исполнение аккредитива",
    mode: "MANUAL_ONLY",
    template: {
      lines: [
        { accountCode: "6010", side: "debit", expression: "amount" },
        { accountCode: "5510", side: "credit", expression: "amount" }
      ],
      opensItem: false,
      closesOpenItemByAccount: "5510",
      requiresCounterparty: true
    }
  },

  // NEW-58: Депонирование невыплаченной заработной платы
  {
    code: "SALARY_DEPOSIT",
    name: "Депонирование заработной платы",
    mode: "MANUAL_ONLY",
    template: {
      lines: [
        { accountCode: "6710", side: "debit", expression: "amount" },
        { accountCode: "6720", side: "credit", expression: "amount" }
      ],
      opensItem: true,
      itemAccountCode: "6720",
      requiresCounterparty: false
    }
  },

  // NEW-59: Выплата депонированной заработной платы
  {
    code: "SALARY_DEPOSIT_PAYMENT",
    name: "Выплата депонированной заработной платы",
    mode: "BANK_AUTO",
    template: {
      lines: [
        { accountCode: "6720", side: "debit", expression: "amount" },
        { accountCode: "5110", side: "credit", expression: "amount" }
      ],
      opensItem: false,
      closesOpenItemByAccount: "6720",
      requiresCounterparty: false
    }
  },

  // NEW-60: Начисление процентов по депозиту
  {
    code: "DEPOSIT_INTEREST_ACCRUAL",
    name: "Начисление процентов по депозиту",
    mode: "MANUAL_ONLY",
    template: {
      lines: [
        { accountCode: "4830", side: "debit", expression: "amount" },
        { accountCode: "9530", side: "credit", expression: "amount" }
      ],
      opensItem: false,
      requiresCounterparty: false
    }
  },

  // NEW-61: Возврат товаров поставщику (ранее оплаченных, сторно поступления)
  {
    code: "GOODS_RETURNED_TO_SUPPLIER",
    name: "Возврат товаров поставщику",
    mode: "MANUAL_ONLY",
    template: {
      lines: [
        { accountCode: "6010", side: "debit", expression: "amount" },
        { accountCode: "2910", side: "credit", expression: "amount" }
      ],
      opensItem: false,
      requiresCounterparty: true
    }
  },

  // NEW-62: Перевод долгосрочной задолженности в краткосрочную часть
  {
    code: "LONG_TERM_TO_CURRENT_RECLASS",
    name: "Перевод долгосрочной задолженности в краткосрочную часть",
    mode: "MANUAL_ONLY",
    template: {
      lines: [
        { accountCode: "7810", side: "debit", expression: "amount" },
        { accountCode: "6950", side: "credit", expression: "amount" }
      ],
      opensItem: false,
      requiresCounterparty: false
    }
  },

  // NEW-63: Чрезвычайные доходы/расходы (форс-мажор)
  {
    code: "EXTRAORDINARY_GAIN_LOSS",
    name: "Чрезвычайные доходы/расходы",
    mode: "MANUAL_ONLY",
    template: {
      lines: [
        // Чрезвычайный доход: Дт $accountCode — Кт 9710
        { accountCode: "$accountCode", side: "debit", expression: "gainAmount", condition: "gainAmount > 0" },
        { accountCode: "9710", side: "credit", expression: "gainAmount", condition: "gainAmount > 0" },
        // Чрезвычайный убыток: Дт 9720 — Кт $accountCode
        { accountCode: "9720", side: "debit", expression: "lossAmount", condition: "lossAmount > 0" },
        { accountCode: "$accountCode", side: "credit", expression: "lossAmount", condition: "lossAmount > 0" }
      ],
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
      update: { name: doc.name, postingTemplate: doc.template, mode: doc.mode },
      create: { code: doc.code, name: doc.name, postingTemplate: doc.template, mode: doc.mode }
    });
  }

  // Migrate any old rules using the legacy 'SUPPLIER_PAYMENT' to the new 'SUPPLIER_PAYMENT_SERVICES'
  const supplierPaymentType = await prisma.documentType.findUnique({
    where: { code: "SUPPLIER_PAYMENT" }
  });
  const supplierPaymentServicesType = await prisma.documentType.findUnique({
    where: { code: "SUPPLIER_PAYMENT_SERVICES" }
  });

  if (supplierPaymentType && supplierPaymentServicesType) {
    const updatedRules = await prisma.rule.updateMany({
      where: { categoryId: supplierPaymentType.id },
      data: { categoryId: supplierPaymentServicesType.id }
    });
    if (updatedRules.count > 0) {
      console.log(`[migration] Migrated ${updatedRules.count} rules from SUPPLIER_PAYMENT to SUPPLIER_PAYMENT_SERVICES`);
    }
  }

}

/**
 * Single source of truth for "which GL accounts act as OpenItem buffers" — derived directly
 * from baseDocumentTypes instead of being maintained as a separate hardcoded list. Consumed
 * by the risk-deadline settings API/UI and can be reused anywhere else that needs to enumerate
 * buffer accounts without duplicating the list.
 */
export function getOpenItemBufferAccountCodes(): string[] {
  const codes = new Set<string>();
  for (const doc of baseDocumentTypes) {
    const template = doc.template as { opensItem?: boolean; itemAccountCode?: string };
    if (template.opensItem && template.itemAccountCode) {
      codes.add(template.itemAccountCode);
    }
  }
  return Array.from(codes).sort();
}

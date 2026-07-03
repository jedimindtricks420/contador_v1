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
    name: "Внутренний перевод",
    mode: "BANK_AUTO",
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
        // НДФЛ в бюджет 12% (из зарплаты работника): Дт 6710 — Кт 6410
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
        { accountCode: "9820", side: "debit", expression: "taxAmount" },
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
    code: "CAPITAL_CONTRIBUTION",
    name: "Пополнение уставного фонда учредителем",
    mode: "BANK_AUTO",
    template: {
      lines: [
        { accountCode: "5110", side: "debit", expression: "amount" },
        { accountCode: "8330", side: "credit", expression: "amount" }
      ],
      opensItem: false,
      requiresCounterparty: true
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
        { accountCode: "5110", side: "debit", expression: "amount" },
        { accountCode: "9210", side: "credit", expression: "amount" }
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
    code: "DIVIDEND_PAYMENT",
    name: "Выплата дивидендов учредителям",
    mode: "BANK_AUTO",
    template: {
      lines: [
        { accountCode: "6610", side: "debit", expression: "amount" },
        { accountCode: "5110", side: "credit", expression: "amount" }
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
        { accountCode: "9420", side: "debit", expression: "amount" },
        { accountCode: "5110", side: "credit", expression: "amount" }
      ],
      opensItem: false,
      requiresCounterparty: true
    }
  },
  {
    code: "CUSTOMS_DUTY",
    name: "Таможенные платежи и пошлины",
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
    // Payload использует три отдельных явных поля вместо перегруженного "amount":
    //   grossSaleAmount — полная сумма продажи клиенту (с НДС, до удержания комиссии)
    //   netAmount       — сумма, фактически поступившая от агрегатора (после комиссии)
    //   commissionAmount — удержанная комиссия агрегатора
    // Инвариант баланса проводки: netAmount + commissionAmount == grossSaleAmount
    // (иначе postDocument выбросит ошибку "Несбалансированная проводка").
    code: "MARKETPLACE_REVENUE",
    name: "Выручка маркетплейса (зачет расчётов с агрегатором и комиссия)",
    mode: "MANUAL_ONLY",
    template: {
      lines: [
        { accountCode: "4890", side: "debit", expression: "netAmount" },
        { accountCode: "9430", side: "debit", expression: "commissionAmount" },
        { accountCode: "9030", side: "credit", expression: "grossSaleAmount - vatAmount" },
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
    // стороной перевода (см. INTERNAL_TRANSFER: Дт 5710 — Кт 5110). Обычная приёмная
    // сторона межбанковских переводов данной организации — валютный счёт 5210.
    code: "INTERNAL_TRANSFER_RECEIVED",
    name: "Внутренний перевод (поступление на валютный счёт)",
    mode: "BANK_AUTO",
    template: {
      lines: [
        { accountCode: "5210", side: "debit", expression: "amount" },
        { accountCode: "5710", side: "credit", expression: "amount" }
      ],
      opensItem: false,
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

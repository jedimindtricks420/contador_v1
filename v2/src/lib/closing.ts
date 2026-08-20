import prisma from "./prisma";
import Decimal from "decimal.js";
import { postDocument } from "./posting/postingEngine";
import {
  TAX_RATES, ACCOUNTS,
  REVENUE_ACCOUNT_CODES, COGS_ACCOUNT_CODES, EXPENSE_ACCOUNT_CODES, SALARY_EXPENSE_ACCOUNT_CODES, CLOSING
} from "./constants";

// Net salary multiplier: employee receives gross minus NDFL_BUDGET (11.9%) minus INPS (0.1%)
const NET_SALARY_RATE = 1 - TAX_RATES.NDFL_BUDGET - TAX_RATES.INPS; // 0.88

// Thrown by H0b pre-close validation (товарная выручка без списания себестоимости)
// so the API route can tell this specific, overridable case apart from other
// pre-close failures and offer the UI an explicit "confirm anyway" action.
export class MissingCogsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MissingCogsError";
  }
}

// ── ClosingJob helpers (DB-backed, replaces globalThis.closingStates) ──

function defaultState() {
  return {
    currentStep: 1,
    // expenseAccountCode defaults to EXPENSE_ADMIN for backward compatibility with
    // closing sessions started before the per-function salary split existed.
    accruals: { salaryAmount: 0, depreciationAmount: 0, rentAmount: 0, expenseAccountCode: ACCOUNTS.EXPENSE_ADMIN },
    fxDiff: { exchangeRate: 0, difference: 0 },
    soliqMatched: { matched: 0, unmatched: 0 }
  };
}

export async function clearClosingState(periodId: string, orgId: string) {
  await prisma.closingJob.deleteMany({ where: { periodId, orgId } });
}

export async function getClosingState(periodId: string, orgId: string) {
  let job = await prisma.closingJob.findUnique({ where: { periodId_orgId: { periodId, orgId } } });
  if (job) return { ...(job.data as any), currentStep: job.step, status: job.status, error: job.error };

  const period = await prisma.period.findUnique({ where: { id: periodId } });
  const state = (period?.closingData as any) ?? defaultState();
  // Create a DRAFT job to persist the initial state
  job = await prisma.closingJob.create({
    data: {
      periodId, orgId,
      status: "DRAFT",
      step: state.currentStep ?? 1,
      data: state
    }
  });
  return { ...state, currentStep: job.step, status: job.status, error: job.error };
}

export async function saveClosingState(periodId: string, patch: any, orgId?: string) {
  if (!orgId) throw new Error("orgId is required for saveClosingState");
  const period = await prisma.period.findFirst({ where: { id: periodId, orgId } });
  if (!period) throw new Error("Period not found or access denied");

  const existing = await prisma.closingJob.findUnique({ where: { periodId_orgId: { periodId, orgId } } });
  const current = existing ? (existing.data as any) : defaultState();
  const updated = { ...current, ...patch };

  await prisma.closingJob.upsert({
    where: { periodId_orgId: { periodId, orgId } },
    create: {
      periodId, orgId,
      status: "DRAFT",
      step: updated.currentStep ?? 1,
      data: updated
    },
    update: {
      step: updated.currentStep ?? existing?.step ?? 1,
      data: updated
    }
  });
}

// Кумулятивная бухгалтерская прибыль нарастающим итогом (ст. 296 ч.4, ст. 339 ч.2 НК).
// Формула та же, что месячный netProfit в блоке E finalizePeriod, но по диапазону дат,
// а не по periodId. Документы PERIOD_CLOSING исключаются: реформация — техническое
// закрытие транзитных счетов, её дебеты по 93xx исказили бы otherIncome.
export async function computeCumulativeNetProfit(
  orgId: string, from: Date, to: Date, tx: any
): Promise<Decimal> {
  const docFilter = {
    orgId,
    status: "POSTED",
    date: { gte: from, lte: to },
    type: { code: { notIn: ["PERIOD_CLOSING"] } }
  };

  const sumBy = (entries: any[], field: "debit" | "credit") =>
    entries.reduce((s: Decimal, e: any) => s.plus(new Decimal(e[field].toString())), new Decimal(0));

  const revenueEntries = await tx.journalEntry.findMany({
    where: { document: docFilter, account: { code: { in: REVENUE_ACCOUNT_CODES } } }
  });
  const otherIncomeEntries = await tx.journalEntry.findMany({
    where: { document: docFilter, account: { code: { startsWith: "93" } } }
  });
  const fxIncomeEntries = await tx.journalEntry.findMany({
    where: { document: docFilter, account: { code: ACCOUNTS.FX_INCOME } }
  });
  const fxExpenseEntries = await tx.journalEntry.findMany({
    where: { document: docFilter, account: { code: ACCOUNTS.FX_EXPENSE } }
  });
  const expenseEntries = await tx.journalEntry.findMany({
    where: {
      document: docFilter,
      account: { code: { in: [...COGS_ACCOUNT_CODES, ...EXPENSE_ACCOUNT_CODES, ACCOUNTS.INTEREST_EXPENSE] } }
    }
  });

  return sumBy(revenueEntries, "credit")
    .plus(sumBy(otherIncomeEntries, "credit").minus(sumBy(otherIncomeEntries, "debit")))
    .plus(sumBy(fxIncomeEntries, "credit"))
    .minus(sumBy(expenseEntries, "debit"))
    .minus(sumBy(fxExpenseEntries, "debit"));
}

export async function finalizePeriod(
  periodId: string,
  orgId: string,
  userId: string,
  overrideAccruals?: { salaryAmount?: number; depreciationAmount?: number; rentAmount?: number; expenseAccountCode?: string },
  options?: { confirmMissingCogs?: boolean }
) {
  const period = await prisma.period.findUnique({
    where: { id: periodId },
    include: { org: true }
  });
  if (!period) throw new Error("Период не найден");
  if (period.status === "CLOSED") throw new Error("Период уже закрыт");

  const org = period.org;

  // ── State machine: ensure idempotency ──
  const existingJob = await prisma.closingJob.findUnique({
    where: { periodId_orgId: { periodId, orgId } }
  });
  if (existingJob?.status === "COMPLETED") {
    // Already completed — return existing result
    return { period, taxEvents: [], warnings: [] };
  }
  if (existingJob?.status === "RUNNING") {
    throw new Error("Закрытие периода уже выполняется. Дождитесь завершения или отмените предыдущую попытку.");
  }

  // Mark as RUNNING. On first run (no ClosingJob yet), seed data from any
  // legacy Period.closingData rather than defaultState() — otherwise accruals
  // saved before the ClosingJob table existed would be silently discarded.
  await prisma.closingJob.upsert({
    where: { periodId_orgId: { periodId, orgId } },
    create: {
      periodId, orgId,
      status: "RUNNING",
      step: 1,
      data: (period.closingData as any) ?? defaultState(),
      startedAt: new Date()
    },
    update: {
      status: "RUNNING",
      startedAt: new Date(),
      error: null
    }
  });

  const state = await getClosingState(periodId, orgId);

  try {
    const result = await prisma.$transaction(async (tx) => {
      const baseAccruals = state.accruals || { salaryAmount: 0, depreciationAmount: 0, rentAmount: 0, expenseAccountCode: ACCOUNTS.EXPENSE_ADMIN };
      const accruals = overrideAccruals
        ? {
            salaryAmount: overrideAccruals.salaryAmount ?? baseAccruals.salaryAmount,
            depreciationAmount: overrideAccruals.depreciationAmount ?? baseAccruals.depreciationAmount,
            rentAmount: overrideAccruals.rentAmount ?? baseAccruals.rentAmount,
            expenseAccountCode: overrideAccruals.expenseAccountCode ?? baseAccruals.expenseAccountCode ?? ACCOUNTS.EXPENSE_ADMIN
          }
        : baseAccruals;
      const accrualDate = new Date(period.year, period.month - 1, CLOSING.ACCRUAL_DAY);

    // A. Начисление заработной платы и налогов ФОТ
    const existingSalary = await tx.document.findFirst({
      where: { orgId, periodId, type: { code: "SALARY_ACCRUAL" }, status: "POSTED" }
    });
    if (!existingSalary && Number(accruals.salaryAmount) > 0) {
      // Defense in depth: the step-4 API route already rejects an invalid
      // expenseAccountCode at input time, but ClosingState is a loosely-typed JSON
      // blob (could pre-date this field, or be edited directly) — never let a bad
      // value silently fall through to a POSTED document.
      const expenseAccountCode = accruals.expenseAccountCode ?? ACCOUNTS.EXPENSE_ADMIN;
      if (!SALARY_EXPENSE_ACCOUNT_CODES.includes(expenseAccountCode as any)) {
        throw new Error(`Некорректный счёт расхода для начисления ЗП: ${expenseAccountCode}. Допустимые: ${SALARY_EXPENSE_ACCOUNT_CODES.join(", ")}`);
      }

      const salaryType = await tx.documentType.findUniqueOrThrow({ where: { code: "SALARY_ACCRUAL" } });
      const salaryDoc = await tx.document.create({
        data: {
          orgId, periodId, typeId: salaryType.id, date: accrualDate, status: "POSTED",
          payload: { salaryAmount: Number(accruals.salaryAmount), expenseAccountCode } as any
        }
      });
      await postDocument(salaryDoc.id, tx, userId);

      // A2. SALARY_OFFSET — зачёт нетто-зарплаты в счёт займов сотрудникам (если займы есть)
      const loanBalance = await tx.journalEntry.aggregate({
        where: { document: { orgId, status: "POSTED" }, account: { code: ACCOUNTS.EMPLOYEE_LOAN_RECEIVABLE } },
        _sum: { debit: true, credit: true }
      });
      const balance4720 = new Decimal(loanBalance._sum.debit?.toString() || "0")
        .minus(new Decimal(loanBalance._sum.credit?.toString() || "0"));

      if (balance4720.gt(0)) {
        const netSalary = new Decimal(accruals.salaryAmount).mul(NET_SALARY_RATE);
        const offsetAmount = Decimal.min(netSalary, balance4720);

        const existingOffset = await tx.document.findFirst({
          where: { orgId, periodId, type: { code: "SALARY_OFFSET" }, status: "POSTED" }
        });
        if (!existingOffset && offsetAmount.gt(0)) {
          const offsetType = await tx.documentType.findUnique({ where: { code: "SALARY_OFFSET" } });
          if (offsetType) {
            const offsetDoc = await tx.document.create({
              data: {
                orgId, periodId, typeId: offsetType.id, date: accrualDate, status: "POSTED",
                payload: { amount: offsetAmount.toNumber(), description: "Зачёт нетто-зарплаты в счёт займов" } as any
              }
            });
            await postDocument(offsetDoc.id, tx, userId);
          }
        }
      }
    }

    // B. Начисление амортизации ОС: Дт 9430 — Кт 0200
    const existingDep = await tx.document.findFirst({
      where: { orgId, periodId, type: { code: "DEPRECIATION_ACCRUAL" }, status: "POSTED" }
    });
    if (!existingDep && Number(accruals.depreciationAmount) > 0) {
      const depType = await tx.documentType.findUniqueOrThrow({ where: { code: "DEPRECIATION_ACCRUAL" } });
      const depDoc = await tx.document.create({
        data: {
          orgId, periodId, typeId: depType.id, date: accrualDate, status: "POSTED",
          payload: { depreciationAmount: Number(accruals.depreciationAmount) } as any
        }
      });
      await postDocument(depDoc.id, tx, userId);
    }

    // C. Начисление аренды: Дт 9420 — Кт 6010 (административные расходы — аренда офиса)
    const existingRent = await tx.document.findFirst({
      where: { orgId, periodId, type: { code: "RENT_ACCRUAL" }, status: "POSTED" }
    });
    if (!existingRent && Number(accruals.rentAmount) > 0) {
      const rentType = await tx.documentType.findUniqueOrThrow({ where: { code: "RENT_ACCRUAL" } });
      const rentDoc = await tx.document.create({
        data: {
          orgId, periodId, typeId: rentType.id, date: accrualDate, status: "POSTED",
          payload: { rentAmount: Number(accruals.rentAmount) } as any
        }
      });
      await postDocument(rentDoc.id, tx, userId);
    }

    // D. Курсовые разницы: пользователь вводит курс ЦБ и сумму разницы вручную
    // на шаге 5 wizard'а (Step5FxDiff.tsx), сверяясь с банковской выпиской.
    // Backend больше не пересчитывает свою implied-разницу по остаткам счетов —
    // раньше это игнорировало введённое пользователем число и могло давать
    // неверный знак для пассивных валютных статей (6010/6820). Теперь backend
    // доверяет пользователю и просто проводит то, что он ввёл, по счёту 5210
    // (валютный банковский счёт — единственный, по которому UI считает оценку).
    const fxDiff = state.fxDiff || { exchangeRate: 0, difference: 0 };
    const wizardRate = new Decimal(fxDiff.exchangeRate || 0);
    const userDifference = new Decimal(fxDiff.difference || 0);

    if (wizardRate.gt(0) && !userDifference.isZero()) {
      const fxType = await tx.documentType.findUniqueOrThrow({ where: { code: "FX_DIFFERENCE" } });
      const account = await tx.account.findUnique({ where: { code: ACCOUNTS.BANK_USD } });

      if (account) {
        const existingFx = await tx.document.findFirst({
          where: {
            orgId, periodId,
            type: { code: "FX_DIFFERENCE" },
            status: "POSTED",
            payload: { path: ["fxAccountCode"], equals: ACCOUNTS.BANK_USD }
          }
        });

        if (!existingFx) {
          const fxDoc = await tx.document.create({
            data: {
              orgId, periodId, typeId: fxType.id, date: accrualDate, status: "POSTED",
              payload: {
                fxDifference: userDifference.toNumber(),
                fxAccountCode: ACCOUNTS.BANK_USD,
                exchangeRate: wizardRate.toNumber()
              } as any
            }
          });
          await postDocument(fxDoc.id, tx, userId);
        }
      }
    }

    // E. Расчёт налогов
    // Выручка: 9010/9020/9030 + прочие доходы 93xx + курсовые доходы 9540
    const revenueEntries = await tx.journalEntry.findMany({
      where: { document: { periodId, orgId }, account: { code: { in: REVENUE_ACCOUNT_CODES } } }
    });
    const totalRevenue = revenueEntries.reduce(
      (s: Decimal, e: any) => s.plus(new Decimal(e.credit.toString())), new Decimal(0)
    );

    // Clear pending events for this period to avoid duplicates
    await tx.taxCalendarEvent.deleteMany({
      where: { orgId, periodId, status: "PENDING" }
    });

    const taxes: { type: string; amount: Decimal; dueDate: Date }[] = [];
    const nextMonth20th = new Date(period.year, period.month, CLOSING.TAX_DUE_DAY);

    if (Number(accruals.salaryAmount) > 0) {
      const sal = new Decimal(accruals.salaryAmount);
      taxes.push({ type: "PERSONAL_INCOME_TAX", amount: sal.mul(TAX_RATES.NDFL_BUDGET), dueDate: nextMonth20th });
      taxes.push({ type: "INPS",                amount: sal.mul(TAX_RATES.INPS),         dueDate: nextMonth20th });
      taxes.push({ type: "SOCIAL_TAX",          amount: sal.mul(TAX_RATES.SOCIAL_TAX),   dueDate: nextMonth20th });
    }

    if (org.taxRegime === "VAT") {
      // E2. Налог на прибыль — нарастающим итогом с начала года (ст. 296 ч.4,
      // ст. 339 ч.2 НК), начисление только по итогам отчётного периода — квартала
      // (ст. 338). delta = кумулятивный налог года − уже начисленное за год:
      // положительная — PROFIT_TAX_ACCRUAL (Дт 9810/Кт 6410), отрицательная
      // (накопленная база упала после убыточного квартала) — PROFIT_TAX_REVERSAL
      // (Дт 6410/Кт 9810). Убыточные месяцы поглощаются нарастающим итогом сами;
      // перенос убытков прошлых лет — только в годовом расчёте (ст. 333 ч.6, Фаза 2).
      // Проводки управляются org.autoAccrueProfitTax; календарное событие
      // создаётся всегда, в т.ч. с суммой 0 — фиксирует факт расчёта.
      const isQuarterEnd = period.month % 3 === 0;
      const existingPtax = await tx.document.findFirst({
        where: {
          orgId, periodId, status: "POSTED",
          type: { code: { in: ["PROFIT_TAX_ACCRUAL", "PROFIT_TAX_REVERSAL"] } }
        }
      });
      if (isQuarterEnd && !existingPtax) {
        const yearStart = new Date(period.year, 0, 1);
        const quarterEnd = new Date(period.year, period.month, 0, 23, 59, 59, 999);

        const cumulativeProfit = await computeCumulativeNetProfit(orgId, yearStart, quarterEnd, tx);
        const cumulativeBase = Decimal.max(cumulativeProfit, 0);
        const rate = new Decimal((org as any).profitTaxRate ?? TAX_RATES.PROFIT_TAX);
        const cumulativeTaxDue = cumulativeBase.mul(rate);

        const accruedDocs = await tx.document.findMany({
          where: {
            orgId, status: "POSTED",
            date: { gte: yearStart, lte: quarterEnd },
            type: { code: { in: ["PROFIT_TAX_ACCRUAL", "PROFIT_TAX_REVERSAL"] } }
          },
          include: { type: { select: { code: true } } }
        });
        let accruedSoFar = new Decimal(0);
        for (const d of accruedDocs) {
          const amt = new Decimal((d.payload as any)?.taxAmount ?? 0);
          accruedSoFar = d.type.code === "PROFIT_TAX_ACCRUAL"
            ? accruedSoFar.plus(amt)
            : accruedSoFar.minus(amt);
        }

        const delta = cumulativeTaxDue.minus(accruedSoFar);

        // Срок отчётности/уплаты: за квартал — 20-е число следующего месяца
        // (ст. 339 ч.5 п.1, ст. 340 ч.1); за год (Q4) — 1 марта (ст. 339 ч.5 п.2).
        // К доплате не бывает отрицательной суммы (ст. 340 ч.7).
        const profitTaxDueDate = period.month === 12
          ? new Date(period.year + 1, 2, 1)
          : new Date(period.year, period.month, CLOSING.TAX_DUE_DAY);
        taxes.push({ type: "PROFIT_TAX", amount: Decimal.max(delta, 0), dueDate: profitTaxDueDate });

        if (org.autoAccrueProfitTax && !delta.isZero()) {
          const typeCode = delta.gt(0) ? "PROFIT_TAX_ACCRUAL" : "PROFIT_TAX_REVERSAL";
          const ptaxType = await tx.documentType.findUniqueOrThrow({ where: { code: typeCode } });
          const ptaxDoc = await tx.document.create({
            data: {
              orgId, periodId, typeId: ptaxType.id, date: accrualDate, status: "POSTED",
              payload: {
                taxAmount: delta.abs().toNumber(),
                year: period.year,
                quarter: period.month / 3,
                cumulativeBase: cumulativeBase.toNumber(),
                cumulativeTaxDue: cumulativeTaxDue.toNumber(),
                accruedBefore: accruedSoFar.toNumber()
              } as any
            }
          });
          await postDocument(ptaxDoc.id, tx, userId);
        }
      }
    } else {
      // E3. Налог с оборота: проводка Дт 9810 — Кт 6410
      const rate = new Decimal((org as any).turnoverTaxRate ?? TAX_RATES.TURNOVER_TAX);
      const turnoverTaxAmt = totalRevenue.mul(rate);
      taxes.push({ type: "TURNOVER_TAX", amount: turnoverTaxAmt, dueDate: nextMonth20th });

      const existingTtax = await tx.document.findFirst({
        where: { orgId, periodId, type: { code: "TURNOVER_TAX_ACCRUAL" }, status: "POSTED" }
      });
      if (!existingTtax && turnoverTaxAmt.gt(0)) {
        const ttaxType = await tx.documentType.findUniqueOrThrow({ where: { code: "TURNOVER_TAX_ACCRUAL" } });
        const ttaxDoc = await tx.document.create({
          data: {
            orgId, periodId, typeId: ttaxType.id, date: accrualDate, status: "POSTED",
            payload: { taxAmount: turnoverTaxAmt.toNumber() } as any
          }
        });
        await postDocument(ttaxDoc.id, tx, userId);
      }
    }

    // F. Налоговый календарь
    const createdEvents = [];
    for (const t of taxes) {
      const ev = await tx.taxCalendarEvent.create({
        data: {
          orgId, periodId, type: t.type as any, dueDate: t.dueDate,
          estimatedAmount: t.amount, status: "PENDING",
          note: `Рассчитано при закрытии ${period.month}/${period.year}`
        }
      });
      createdEvents.push(ev);
    }

    // G. Вызов динамического пересчета для НДС и налога с оборота
    await upsertTaxCalendarEventsForPeriod(periodId, orgId, tx);

    // H. Реформация баланса: перенос всех TRANSIT-счетов на 9910
    const transitEntries = await tx.journalEntry.findMany({
      where: {
        document: { periodId, orgId, status: "POSTED" },
        account: { type: "TRANSIT" }
      },
      include: { account: { select: { id: true, code: true } } }
    });

    // Агрегируем чистый оборот по каждому TRANSIT-счёту
    const netMap = new Map<string, { accountId: string; net: Decimal }>();
    for (const je of transitEntries) {
      const key = je.accountId;
      const prev = netMap.get(key) ?? { accountId: key, net: new Decimal(0) };
      prev.net = prev.net.plus(new Decimal(je.debit.toString())).minus(new Decimal(je.credit.toString()));
      netMap.set(key, prev);
    }

    // H0. Pre-close validation: 9210/9220 (счета выбытия активов) не должны иметь остатка
    // на момент реформации — их закрывает FIXED_ASSET_DISPOSAL_RESULT (прибыль/убыток
    // от выбытия). Ненулевой остаток означает, что выбытие было списано (FIXED_ASSET_DISPOSAL),
    // но результат от выбытия не признан.
    const warnings: string[] = [];
    const disposalAccounts = await tx.account.findMany({
      where: { code: { in: [ACCOUNTS.ASSET_DISPOSAL, ACCOUNTS.OTHER_ASSET_DISPOSAL] } }
    });
    const disposalErrors: string[] = [];
    for (const acc of disposalAccounts) {
      const entry = netMap.get(acc.id);
      if (entry && !entry.net.isZero()) {
        disposalErrors.push(
          `Счёт ${acc.code} (${acc.name}) имеет ненулевой остаток ${entry.net.abs().toFixed(2)} перед реформацией баланса. ` +
          `Создайте документ FIXED_ASSET_DISPOSAL_RESULT для всех выбытий за период.`
        );
      }
    }
    if (disposalErrors.length > 0) {
      throw new Error("Pre-close validation failed:\n" + disposalErrors.join("\n"));
    }

    // H0b. Pre-close block: товарная выручка без единого списания себестоимости.
    // GOODS_SOLD (Дт 9120 / Кт 2910) — ручной документ; если за период есть
    // Кт-обороты 9020 (реализация товаров), но ни одного GOODS_SOLD не создано,
    // строка 020 Приложения №2 «Расчёта налога на прибыль» останется нулевой,
    // а проданный товар — числиться на складе. Проверяем именно ФАКТ списания,
    // а не полное совпадение сумм: себестоимость по определению меньше выручки
    // при нормальной марже (revenue - COGS = прибыль), поэтому сравнение сумм
    // ложно сработало бы на любой прибыльной продаже (see profit-tax-two-year-audit
    // fixture: 8 000 000 выручки / 5 000 000 себестоимости — здоровая маржа 37.5%,
    // не пропущенный расход). Раньше это было предупреждением (не блокировало
    // закрытие) — именно так GP TECH UNION закрыла период с ~380 млн выручки и
    // без единой проводки себестоимости, и никто не заметил. Теперь это блокирует
    // закрытие, если явно не подтверждено options.confirmMissingCogs (например,
    // продажа была с нулевой маржой по факту, или списание сознательно отложено).
    const revenue9020 = await tx.journalEntry.aggregate({
      where: {
        document: { periodId, orgId, status: "POSTED" },
        account: { code: ACCOUNTS.REVENUE_TRADE },
        credit: { gt: 0 }
      },
      _sum: { credit: true }
    });
    const trade = new Decimal(revenue9020._sum.credit?.toString() || "0");
    if (trade.gt(0)) {
      const goodsSold = await tx.document.findFirst({
        where: { orgId, periodId, type: { code: "GOODS_SOLD" }, status: "POSTED" }
      });
      if (!goodsSold) {
        const message =
          `За период есть выручка от реализации товаров (Кт 9020: ${trade.toFixed(2)}), ` +
          `но нет ни одного документа GOODS_SOLD — себестоимость проданных товаров не списана со склада ` +
          `(${ACCOUNTS.INVENTORY_TRADE_GOODS}). Создайте GOODS_SOLD (Дт 9120 / Кт ${ACCOUNTS.INVENTORY_TRADE_GOODS}), ` +
          `иначе расходы будут занижены, а строка 020 Приложения №2 «Расчёта налога на прибыль» останется нулевой.`;
        if (!options?.confirmMissingCogs) {
          throw new MissingCogsError(message);
        }
        warnings.push(message + " (закрытие подтверждено вручную, несмотря на отсутствие списания себестоимости.)");
      }
    }

    const acc9910 = await tx.account.findUnique({ where: { code: ACCOUNTS.FINAL_RESULT } });
    if (!acc9910) throw new Error("Счёт 9910 не найден — выполните seed счетов");

    const nonZeroTransit = [...netMap.values()].filter(v => !v.net.isZero());

    if (nonZeroTransit.length > 0) {
      let closingType = await tx.documentType.findUnique({ where: { code: "PERIOD_CLOSING" } });
      if (!closingType) {
        closingType = await tx.documentType.create({
          data: {
            code: "PERIOD_CLOSING",
            name: "Закрытие счетов доходов и расходов (реформация баланса)",
            postingTemplate: { lines: [], opensItem: false }
          }
        });
      }
      const closingDoc = await tx.document.create({
        data: {
          orgId, periodId, typeId: closingType.id, date: accrualDate, status: "POSTED",
          payload: { type: "period_closing", year: period.year, month: period.month } as any
        }
      });

      for (const item of nonZeroTransit) {
        if (item.net.lt(0)) {
          // Кредитовый остаток (доходный счёт): Дт [доходный] — Кт 9910
          const amt = item.net.abs();
          await tx.journalEntry.createMany({
            data: [
              { documentId: closingDoc.id, accountId: item.accountId, debit: amt, credit: new Decimal(0), date: accrualDate },
              { documentId: closingDoc.id, accountId: acc9910.id, debit: new Decimal(0), credit: amt, date: accrualDate }
            ]
          });
        } else {
          // Дебетовый остаток (расходный счёт): Дт 9910 — Кт [расходный]
          await tx.journalEntry.createMany({
            data: [
              { documentId: closingDoc.id, accountId: acc9910.id, debit: item.net, credit: new Decimal(0), date: accrualDate },
              { documentId: closingDoc.id, accountId: item.accountId, debit: new Decimal(0), credit: item.net, date: accrualDate }
            ]
          });
        }
      }
    }

    // H2. Автоматический перенос 9910 → 8710 при закрытии декабря (реформация года)
    if (period.month === 12) {
      // Pre-close validation: проверка ожидаемого остатка 8710
      const acc8710 = await tx.account.findUnique({ where: { code: ACCOUNTS.RETAINED_EARNINGS } });
      if (acc8710) {
        const net8710Rows = await tx.$queryRaw<{ net: string }[]>`
          SELECT COALESCE(SUM(je.credit - je.debit), 0)::text AS net
          FROM "JournalEntry" je
          JOIN "Document" d ON d.id = je."documentId"
          JOIN "Account" a ON a.id = je."accountId"
          WHERE d."orgId" = ${orgId} AND d.status = 'POSTED'
            AND EXTRACT(YEAR FROM d.date) <= ${period.year}
            AND a.code = '8710'
        `;
        const net8710 = new Decimal(net8710Rows[0]?.net || "0");
        // 8710 should normally have a credit balance (retained earnings).
        // A debit balance (net8710 < 0) signals accumulated losses — warn but don't block.
        if (net8710.lt(0)) {
          warnings.push(
            `Счёт 8710 (Нераспределённая прибыль) имеет дебетовый остаток ${net8710.abs().toFixed(2)} ` +
            `перед реформацией года. Это означает накопленный убыток. Проверьте корректность данных.`
          );
        }
      }

      // Advisory lock scoped to this period, auto-released on commit/rollback —
      // serialises concurrent finalizePeriod() runs for the SAME December period
      // (e.g. a retried "close period" request) so the existence check right below
      // can't race and double-create YEAR_END_CLOSE (same fix as the explicit
      // POST /api/closing/year-end endpoint, which shares this account pair).
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('YEAR_END_CLOSE'), hashtext(${periodId}))`;

      const existingYE = await tx.document.findFirst({
        where: { orgId, periodId, type: { code: "YEAR_END_CLOSE" } }
      });
      if (!existingYE) {
        // Знак: net9910 = Σ(credit − debit) → ПРИБЫЛЬ при net9910 > 0 (интуитивная конвенция).
        // Счёт 9910 копит доходы по кредиту и расходы по дебету, поэтому кредитовый остаток
        // (net9910 > 0) — это прибыль. Раньше здесь использовался обратный знак
        // (debit − credit, прибыль при < 0), что уже приводило к ошибке в реализации.
        const net9910Rows = await tx.$queryRaw<{ net: string }[]>`
          SELECT COALESCE(SUM(je.credit - je.debit), 0)::text AS net
          FROM "JournalEntry" je
          JOIN "Document" d ON d.id = je."documentId"
          JOIN "Account" a ON a.id = je."accountId"
          WHERE d."orgId" = ${orgId} AND d.status = 'POSTED'
            AND EXTRACT(YEAR FROM d.date) = ${period.year}
            AND a.code = '9910'
        `;
        const net9910 = new Decimal(net9910Rows[0]?.net || "0");
        if (!net9910.isZero()) {
          if (acc9910 && acc8710) {
            let yearEndType = await tx.documentType.findUnique({ where: { code: "YEAR_END_CLOSE" } });
            if (!yearEndType) {
              yearEndType = await tx.documentType.create({
                data: {
                  code: "YEAR_END_CLOSE",
                  name: "Перенос финансового результата в нераспределённую прибыль",
                  postingTemplate: { lines: [], opensItem: false }
                }
              });
            }
            const yeDate = new Date(period.year, 11, 31);
            const yeDoc = await tx.document.create({
              data: {
                orgId, periodId, typeId: yearEndType.id,
                date: yeDate, status: "POSTED",
                payload: { type: "year_end_close", year: period.year, net9910: net9910.toNumber() } as any
              }
            });
            const amt = net9910.abs();
            if (net9910.lt(0)) {
              // Дебетовый остаток 9910 (net9910 < 0) = убыток: Дт 8710 — Кт 9910
              await tx.journalEntry.createMany({
                data: [
                  { documentId: yeDoc.id, accountId: acc8710.id, debit: amt, credit: new Decimal(0), date: yeDate },
                  { documentId: yeDoc.id, accountId: acc9910.id, debit: new Decimal(0), credit: amt, date: yeDate }
                ]
              });
            } else {
              // Кредитовый остаток 9910 (net9910 > 0) = прибыль: Дт 9910 — Кт 8710
              await tx.journalEntry.createMany({
                data: [
                  { documentId: yeDoc.id, accountId: acc9910.id, debit: amt, credit: new Decimal(0), date: yeDate },
                  { documentId: yeDoc.id, accountId: acc8710.id, debit: new Decimal(0), credit: amt, date: yeDate }
                ]
              });
            }
          }
        }
      }
    }

    // I. Заблокировать период
    const lastDay = new Date(period.year, period.month, 0);
    const updatedPeriod = await tx.period.update({
      where: { id: periodId },
      data: { status: "CLOSED", lockDate: lastDay }
    });

    // Mark ClosingJob as COMPLETED
    await tx.closingJob.update({
      where: { periodId_orgId: { periodId, orgId } },
      data: { status: "COMPLETED", completedAt: new Date(), error: null }
    });

    return { period: updatedPeriod, taxEvents: createdEvents, warnings };
  });

    return result;
  } catch (err: any) {
    // Mark as FAILED with error
    await prisma.closingJob.update({
      where: { periodId_orgId: { periodId, orgId } },
      data: { status: "FAILED", error: err?.message ?? String(err), completedAt: new Date() }
    });
    throw err;
  }
}

export async function upsertTaxCalendarEventsForPeriod(periodId: string, orgId: string, tx: any = prisma) {
  const period = await tx.period.findUnique({
    where: { id: periodId },
    include: { org: true }
  });
  if (!period) return;
  const org = period.org;

  const nextMonth20th = new Date(period.year, period.month, CLOSING.TAX_DUE_DAY);

  if (org.taxRegime === "VAT") {
    // 1. VAT calculation
    // Outgoing VAT (credit entries on account 6410 except from SALARY_ACCRUAL and PROFIT_TAX_ACCRUAL)
    const vatOutEntries = await tx.journalEntry.findMany({
      where: {
        document: {
          periodId,
          orgId,
          type: { code: { notIn: ["SALARY_ACCRUAL", "PROFIT_TAX_ACCRUAL", "PROFIT_TAX_REVERSAL", "TURNOVER_TAX_ACCRUAL"] } }
        },
        account: { code: ACCOUNTS.TAX_PAYABLE },
        credit: { gt: 0 }
      }
    });
    const vatOut = vatOutEntries.reduce(
      (s: Decimal, e: any) => s.plus(new Decimal(e.credit.toString())), new Decimal(0)
    );

    // Incoming VAT (debit entries on account 4410)
    const vatInEntries = await tx.journalEntry.findMany({
      where: {
        document: { periodId, orgId },
        account: { code: ACCOUNTS.VAT_INPUT },
        debit: { gt: 0 }
      }
    });
    const vatIn = vatInEntries.reduce(
      (s: Decimal, e: any) => s.plus(new Decimal(e.debit.toString())), new Decimal(0)
    );

    const vatAmount = vatOut.minus(vatIn);

    if (vatAmount.gt(0)) {
      const existing = await tx.taxCalendarEvent.findFirst({
        where: { orgId, periodId, type: "VAT", status: "PENDING" }
      });
      if (existing) {
        await tx.taxCalendarEvent.update({
          where: { id: existing.id },
          data: {
            estimatedAmount: vatAmount,
            dueDate: nextMonth20th,
            note: `Обновлено динамически: исходящий НДС ${vatOut.toFixed(2)}, входящий ${vatIn.toFixed(2)}`
          }
        });
      } else {
        await tx.taxCalendarEvent.create({
          data: {
            orgId,
            periodId,
            type: "VAT",
            dueDate: nextMonth20th,
            estimatedAmount: vatAmount,
            status: "PENDING",
            note: `Создано динамически: исходящий НДС ${vatOut.toFixed(2)}, входящий ${vatIn.toFixed(2)}`
          }
        });
      }
    } else {
      await tx.taxCalendarEvent.deleteMany({
        where: { orgId, periodId, type: "VAT", status: "PENDING" }
      });
    }
  } else {
    // 2. Turnover Tax calculation
    const revenueEntries = await tx.journalEntry.findMany({
      where: {
        document: { periodId, orgId },
        account: { code: { in: REVENUE_ACCOUNT_CODES } }
      }
    });
    const totalRevenue = revenueEntries.reduce(
      (s: Decimal, e: any) => s.plus(new Decimal(e.credit.toString())), new Decimal(0)
    );

    const rate = new Decimal((org as any).turnoverTaxRate ?? TAX_RATES.TURNOVER_TAX);
    const turnoverTaxAmt = totalRevenue.mul(rate);

    if (turnoverTaxAmt.gt(0)) {
      const existing = await tx.taxCalendarEvent.findFirst({
        where: { orgId, periodId, type: "TURNOVER_TAX", status: "PENDING" }
      });
      if (existing) {
        await tx.taxCalendarEvent.update({
          where: { id: existing.id },
          data: {
            estimatedAmount: turnoverTaxAmt,
            dueDate: nextMonth20th,
            note: `Обновлено динамически по выручке: ${totalRevenue.toFixed(2)}`
          }
        });
      } else {
        await tx.taxCalendarEvent.create({
          data: {
            orgId,
            periodId,
            type: "TURNOVER_TAX",
            dueDate: nextMonth20th,
            estimatedAmount: turnoverTaxAmt,
            status: "PENDING",
            note: `Создано динамически по выручке: ${totalRevenue.toFixed(2)}`
          }
        });
      }
    } else {
      await tx.taxCalendarEvent.deleteMany({
        where: { orgId, periodId, type: "TURNOVER_TAX", status: "PENDING" }
      });
    }
  }
}

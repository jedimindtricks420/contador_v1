import prisma from "./prisma";
import Decimal from "decimal.js";
import { postDocument } from "./posting/postingEngine";
import {
  TAX_RATES, ACCOUNTS,
  REVENUE_ACCOUNT_CODES, COGS_ACCOUNT_CODES, EXPENSE_ACCOUNT_CODES, CLOSING
} from "./constants";

// Net salary multiplier: employee receives (1 - NDFL_total) of gross
const NET_SALARY_RATE = 1 - TAX_RATES.NDFL; // 0.88

const globalForClosing = globalThis as unknown as { closingStates: Map<string, any> };
if (!globalForClosing.closingStates) {
  globalForClosing.closingStates = new Map();
}
const closingStates = globalForClosing.closingStates;

function defaultState() {
  return {
    currentStep: 1,
    accruals: { salaryAmount: 0, depreciationAmount: 0, rentAmount: 0 },
    fxDiff: { exchangeRate: 0, difference: 0 },
    soliqMatched: { matched: 0, unmatched: 0 }
  };
}

export function clearClosingState(periodId: string) {
  closingStates.delete(periodId);
}

export async function getClosingState(periodId: string) {
  const cached = closingStates.get(periodId);
  if (cached) return cached;

  const period = await prisma.period.findUnique({ where: { id: periodId } });
  const state = (period?.closingData as any) ?? defaultState();
  closingStates.set(periodId, state);
  return state;
}

export async function saveClosingState(periodId: string, patch: any) {
  const current = await getClosingState(periodId);
  const updated = { ...current, ...patch };
  closingStates.set(periodId, updated);
  await prisma.period.update({ where: { id: periodId }, data: { closingData: updated } });
}

export async function finalizePeriod(
  periodId: string,
  orgId: string,
  userId: string,
  overrideAccruals?: { salaryAmount?: number; depreciationAmount?: number; rentAmount?: number }
) {
  const period = await prisma.period.findUnique({
    where: { id: periodId },
    include: { org: true }
  });
  if (!period) throw new Error("Период не найден");
  if (period.status === "CLOSED") throw new Error("Период уже закрыт");

  const org = period.org;
  const state = await getClosingState(periodId);

  const result = await prisma.$transaction(async (tx) => {
    const baseAccruals = state.accruals || { salaryAmount: 0, depreciationAmount: 0, rentAmount: 0 };
    const accruals = overrideAccruals
      ? {
          salaryAmount: overrideAccruals.salaryAmount ?? baseAccruals.salaryAmount,
          depreciationAmount: overrideAccruals.depreciationAmount ?? baseAccruals.depreciationAmount,
          rentAmount: overrideAccruals.rentAmount ?? baseAccruals.rentAmount
        }
      : baseAccruals;
    const accrualDate = new Date(period.year, period.month - 1, CLOSING.ACCRUAL_DAY);

    // A. Начисление заработной платы и налогов ФОТ
    const existingSalary = await tx.document.findFirst({
      where: { orgId, periodId, type: { code: "SALARY_ACCRUAL" }, status: "POSTED" }
    });
    if (!existingSalary && Number(accruals.salaryAmount) > 0) {
      // Always upsert so the template stays current if rates change
      const salaryType = await tx.documentType.upsert({
        where: { code: "SALARY_ACCRUAL" },
        update: {
          postingTemplate: {
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
            opensItem: false
          }
        },
        create: {
          code: "SALARY_ACCRUAL",
          name: "Начисление заработной платы и налогов ФОТ",
          postingTemplate: {
            lines: [
              { accountCode: ACCOUNTS.EXPENSE_ADMIN, side: "debit", expression: "salaryAmount" },
              { accountCode: ACCOUNTS.PAYROLL, side: "credit", expression: "salaryAmount" },
              { accountCode: ACCOUNTS.PAYROLL, side: "debit", expression: `salaryAmount * ${TAX_RATES.INPS}` },
              { accountCode: ACCOUNTS.INPS_PAYABLE, side: "credit", expression: `salaryAmount * ${TAX_RATES.INPS}` },
              { accountCode: ACCOUNTS.PAYROLL, side: "debit", expression: `salaryAmount * ${TAX_RATES.NDFL_BUDGET}` },
              { accountCode: ACCOUNTS.TAX_PAYABLE, side: "credit", expression: `salaryAmount * ${TAX_RATES.NDFL_BUDGET}` },
              { accountCode: ACCOUNTS.EXPENSE_ADMIN, side: "debit", expression: `salaryAmount * ${TAX_RATES.SOCIAL_TAX}` },
              { accountCode: ACCOUNTS.SOCIAL_TAX_PAYABLE, side: "credit", expression: `salaryAmount * ${TAX_RATES.SOCIAL_TAX}` }
            ],
            opensItem: false
          }
        }
      });
      const salaryDoc = await tx.document.create({
        data: {
          orgId, periodId, typeId: salaryType.id, date: accrualDate, status: "POSTED",
          payload: { salaryAmount: Number(accruals.salaryAmount) } as any
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
      let depType = await tx.documentType.findUnique({ where: { code: "DEPRECIATION_ACCRUAL" } });
      if (!depType) {
        depType = await tx.documentType.create({
          data: {
            code: "DEPRECIATION_ACCRUAL",
            name: "Начисление амортизации основных средств",
            postingTemplate: {
              lines: [
                { accountCode: ACCOUNTS.EXPENSE_OTHER, side: "debit", expression: "depreciationAmount" },
                { accountCode: ACCOUNTS.DEPRECIATION_ACCUM, side: "credit", expression: "depreciationAmount" }
              ],
              opensItem: false
            }
          }
        });
      }
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
      const rentTemplate = {
        lines: [
          { accountCode: ACCOUNTS.EXPENSE_ADMIN, side: "debit", expression: "rentAmount" },
          { accountCode: ACCOUNTS.PAYABLES, side: "credit", expression: "rentAmount" }
        ],
        opensItem: false
      };
      const rentType = await tx.documentType.upsert({
        where: { code: "RENT_ACCRUAL" },
        update: { postingTemplate: rentTemplate },
        create: {
          code: "RENT_ACCRUAL",
          name: "Начисление аренды (неденежное)",
          postingTemplate: rentTemplate
        }
      });
      const rentDoc = await tx.document.create({
        data: {
          orgId, periodId, typeId: rentType.id, date: accrualDate, status: "POSTED",
          payload: { rentAmount: Number(accruals.rentAmount) } as any
        }
      });
      await postDocument(rentDoc.id, tx, userId);
    }

    // D. Курсовые разницы: Дт/Кт 5210 ↔ 9540/9620
    const fxDiff = state.fxDiff || { exchangeRate: 0, difference: 0 };
    const existingFx = await tx.document.findFirst({
      where: { orgId, periodId, type: { code: "FX_DIFFERENCE" }, status: "POSTED" }
    });
    if (!existingFx && Number(fxDiff.difference) !== 0) {
      let fxType = await tx.documentType.findUnique({ where: { code: "FX_DIFFERENCE" } });
      if (!fxType) {
        fxType = await tx.documentType.create({
          data: {
            code: "FX_DIFFERENCE",
            name: "Курсовая разница валютных счетов",
            postingTemplate: {
              lines: [
                // Положительная разница: Дт 5210 — Кт 9540
                { accountCode: ACCOUNTS.BANK_USD, side: "debit", expression: "fxDifference", condition: "fxDifference > 0" },
                { accountCode: ACCOUNTS.FX_INCOME, side: "credit", expression: "fxDifference", condition: "fxDifference > 0" },
                // Отрицательная разница: Дт 9620 — Кт 5210
                { accountCode: ACCOUNTS.FX_EXPENSE, side: "debit", expression: "-fxDifference", condition: "fxDifference < 0" },
                { accountCode: ACCOUNTS.BANK_USD, side: "credit", expression: "-fxDifference", condition: "fxDifference < 0" }
              ],
              opensItem: false
            }
          }
        });
      }
      const fxDoc = await tx.document.create({
        data: {
          orgId, periodId, typeId: fxType.id, date: accrualDate, status: "POSTED",
          payload: { fxDifference: Number(fxDiff.difference) } as any
        }
      });
      await postDocument(fxDoc.id, tx, userId);
    }

    // E. Расчёт налогов
    // Выручка: 9010/9020/9030 + прочие доходы 93xx + курсовые доходы 9540
    const revenueEntries = await tx.journalEntry.findMany({
      where: { document: { periodId, orgId }, account: { code: { in: REVENUE_ACCOUNT_CODES } } }
    });
    const totalRevenue = revenueEntries.reduce(
      (s: Decimal, e: any) => s.plus(new Decimal(e.credit.toString())), new Decimal(0)
    );

    const otherIncomeEntries = await tx.journalEntry.findMany({
      where: { document: { periodId, orgId }, account: { code: { startsWith: "93" } } }
    });
    const otherIncome = otherIncomeEntries.reduce(
      (s: Decimal, e: any) => s.plus(new Decimal(e.credit.toString())).minus(new Decimal(e.debit.toString())),
      new Decimal(0)
    );

    const fxIncomeEntries = await tx.journalEntry.findMany({
      where: { document: { periodId, orgId }, account: { code: ACCOUNTS.FX_INCOME } }
    });
    const totalFxIncome = fxIncomeEntries.reduce(
      (s: Decimal, e: any) => s.plus(new Decimal(e.credit.toString())), new Decimal(0)
    );

    const fxExpenseEntries = await tx.journalEntry.findMany({
      where: { document: { periodId, orgId }, account: { code: ACCOUNTS.FX_EXPENSE } }
    });
    const totalFxExpense = fxExpenseEntries.reduce(
      (s: Decimal, e: any) => s.plus(new Decimal(e.debit.toString())), new Decimal(0)
    );

    const expenseEntries = await tx.journalEntry.findMany({
      where: {
        document: { periodId, orgId },
        account: { code: { in: [...COGS_ACCOUNT_CODES, ...EXPENSE_ACCOUNT_CODES, ACCOUNTS.INTEREST_EXPENSE] } }
      }
    });
    const totalExpense = expenseEntries.reduce(
      (s: Decimal, e: any) => s.plus(new Decimal(e.debit.toString())), new Decimal(0)
    );

    const netProfit = totalRevenue.plus(otherIncome).plus(totalFxIncome)
      .minus(totalExpense).minus(totalFxExpense);

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
      // E2. Начислить налог на прибыль проводкой Дт 9810 — Кт 6410
      const existingPtax = await tx.document.findFirst({
        where: { orgId, periodId, type: { code: "PROFIT_TAX_ACCRUAL" }, status: "POSTED" }
      });
      if (!existingPtax && netProfit.gt(0)) {
        const profitTaxAmt = netProfit.mul(TAX_RATES.PROFIT_TAX);
        taxes.push({ type: "PROFIT_TAX", amount: profitTaxAmt, dueDate: nextMonth20th });

        let ptaxType = await tx.documentType.findUnique({ where: { code: "PROFIT_TAX_ACCRUAL" } });
        if (!ptaxType) {
          ptaxType = await tx.documentType.create({
            data: {
              code: "PROFIT_TAX_ACCRUAL",
              name: "Начисление налога на прибыль",
              postingTemplate: {
                lines: [
                  { accountCode: ACCOUNTS.PROFIT_TAX_EXPENSE, side: "debit", expression: "taxAmount" },
                  { accountCode: ACCOUNTS.TAX_PAYABLE, side: "credit", expression: "taxAmount" }
                ],
                opensItem: false
              }
            }
          });
        }
        const ptaxDoc = await tx.document.create({
          data: {
            orgId, periodId, typeId: ptaxType.id, date: accrualDate, status: "POSTED",
            payload: { taxAmount: profitTaxAmt.toNumber() } as any
          }
        });
        await postDocument(ptaxDoc.id, tx, userId);
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
        // Create the document type if it was not seeded yet (mirrors PROFIT_TAX_ACCRUAL pattern)
        let ttaxType = await tx.documentType.findFirst({ where: { code: "TURNOVER_TAX_ACCRUAL" } });
        if (!ttaxType) {
          ttaxType = await tx.documentType.create({
            data: {
              code: "TURNOVER_TAX_ACCRUAL",
              name: "Начисление налога с оборота",
              postingTemplate: {
                lines: [
                  { accountCode: ACCOUNTS.PROFIT_TAX_EXPENSE, side: "debit",  expression: "taxAmount" },
                  { accountCode: ACCOUNTS.TAX_PAYABLE,        side: "credit", expression: "taxAmount" }
                ],
                opensItem: false
              }
            }
          });
        }
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
      const existingYE = await tx.document.findFirst({
        where: { orgId, periodId, type: { code: "YEAR_END_CLOSE" } }
      });
      if (!existingYE) {
        const net9910Rows = await tx.$queryRaw<{ net: string }[]>`
          SELECT COALESCE(SUM(je.debit - je.credit), 0)::text AS net
          FROM "JournalEntry" je
          JOIN "Document" d ON d.id = je."documentId"
          JOIN "Account" a ON a.id = je."accountId"
          WHERE d."orgId" = ${orgId} AND d.status = 'POSTED'
            AND EXTRACT(YEAR FROM d.date) = ${period.year}
            AND a.code = '9910'
        `;
        const net9910 = new Decimal(net9910Rows[0]?.net || "0");
        if (!net9910.isZero()) {
          const acc8710 = await tx.account.findUnique({ where: { code: ACCOUNTS.RETAINED_EARNINGS } });
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
            if (net9910.gt(0)) {
              // Дебетовый остаток 9910 = убыток: Дт 8710 — Кт 9910
              await tx.journalEntry.createMany({
                data: [
                  { documentId: yeDoc.id, accountId: acc8710.id, debit: amt, credit: new Decimal(0), date: yeDate },
                  { documentId: yeDoc.id, accountId: acc9910.id, debit: new Decimal(0), credit: amt, date: yeDate }
                ]
              });
            } else {
              // Кредитовый остаток 9910 = прибыль: Дт 9910 — Кт 8710
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

    return { period: updatedPeriod, taxEvents: createdEvents };
  });

  // Очистить кэш состояния wizard'а
  closingStates.delete(periodId);

  return result;
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
          type: { code: { notIn: ["SALARY_ACCRUAL", "PROFIT_TAX_ACCRUAL", "TURNOVER_TAX_ACCRUAL"] } }
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

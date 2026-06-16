import prisma from "./prisma";
import Decimal from "decimal.js";
import { postDocument } from "./posting/postingEngine";
import {
  TAX_RATES, ACCOUNTS,
  REVENUE_ACCOUNT_CODES, COGS_ACCOUNT_CODES, EXPENSE_ACCOUNT_CODES, CLOSING
} from "./constants";

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

export async function finalizePeriod(periodId: string, orgId: string, userId: string) {
  const period = await prisma.period.findUnique({
    where: { id: periodId },
    include: { org: true }
  });
  if (!period) throw new Error("Период не найден");
  if (period.status === "CLOSED") throw new Error("Период уже закрыт");

  const org = period.org;
  const state = await getClosingState(periodId);

  const result = await prisma.$transaction(async (tx) => {
    const accruals = state.accruals || { salaryAmount: 0, depreciationAmount: 0, rentAmount: 0 };
    const accrualDate = new Date(period.year, period.month - 1, CLOSING.ACCRUAL_DAY);

    // A. Начисление заработной платы и налогов ФОТ
    if (Number(accruals.salaryAmount) > 0) {
      let salaryType = await tx.documentType.findUnique({ where: { code: "SALARY_ACCRUAL" } });
      if (!salaryType) {
        salaryType = await tx.documentType.create({
          data: {
            code: "SALARY_ACCRUAL",
            name: "Начисление заработной платы и налогов ФОТ",
            postingTemplate: {
              lines: [
                // Gross ЗП: Дт 9420 — Кт 6710
                { accountCode: ACCOUNTS.EXPENSE_ADMIN, side: "debit", expression: "salaryAmount" },
                { accountCode: ACCOUNTS.PAYROLL, side: "credit", expression: "salaryAmount" },
                // Удержание НДФЛ: Дт 6710 — Кт 6410
                { accountCode: ACCOUNTS.PAYROLL, side: "debit", expression: `salaryAmount * ${TAX_RATES.NDFL}` },
                { accountCode: ACCOUNTS.TAX_PAYABLE, side: "credit", expression: `salaryAmount * ${TAX_RATES.NDFL}` },
                // Соцналог (работодатель): Дт 9420 — Кт 6520
                { accountCode: ACCOUNTS.EXPENSE_ADMIN, side: "debit", expression: `salaryAmount * ${TAX_RATES.SOCIAL_TAX}` },
                { accountCode: ACCOUNTS.SOCIAL_TAX_PAYABLE, side: "credit", expression: `salaryAmount * ${TAX_RATES.SOCIAL_TAX}` }
              ],
              opensItem: false
            }
          }
        });
      }
      const salaryDoc = await tx.document.create({
        data: {
          orgId, periodId, typeId: salaryType.id, date: accrualDate, status: "POSTED",
          payload: { salaryAmount: Number(accruals.salaryAmount) } as any
        }
      });
      await postDocument(salaryDoc.id, tx, userId);
    }

    // B. Начисление амортизации ОС: Дт 9430 — Кт 0200
    if (Number(accruals.depreciationAmount) > 0) {
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

    // C. Начисление аренды: Дт 9420 — Кт 6010
    if (Number(accruals.rentAmount) > 0) {
      let rentType = await tx.documentType.findUnique({ where: { code: "RENT_ACCRUAL" } });
      if (!rentType) {
        rentType = await tx.documentType.create({
          data: {
            code: "RENT_ACCRUAL",
            name: "Начисление аренды (неденежное)",
            postingTemplate: {
              lines: [
                { accountCode: ACCOUNTS.EXPENSE_ADMIN, side: "debit", expression: "rentAmount" },
                { accountCode: ACCOUNTS.PAYABLES, side: "credit", expression: "rentAmount" }
              ],
              opensItem: false
            }
          }
        });
      }
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
    if (Number(fxDiff.difference) !== 0) {
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
        account: { code: { in: [...COGS_ACCOUNT_CODES, ...EXPENSE_ACCOUNT_CODES] } }
      }
    });
    const totalExpense = expenseEntries.reduce(
      (s: Decimal, e: any) => s.plus(new Decimal(e.debit.toString())), new Decimal(0)
    );

    const netProfit = totalRevenue.plus(otherIncome).plus(totalFxIncome)
      .minus(totalExpense).minus(totalFxExpense);

    const taxes: { type: string; amount: Decimal; dueDate: Date }[] = [];
    const nextMonth20th = new Date(period.year, period.month, CLOSING.TAX_DUE_DAY);

    if (Number(accruals.salaryAmount) > 0) {
      taxes.push({ type: "PERSONAL_INCOME_TAX", amount: new Decimal(accruals.salaryAmount).mul(TAX_RATES.NDFL), dueDate: nextMonth20th });
      taxes.push({ type: "SOCIAL_TAX", amount: new Decimal(accruals.salaryAmount).mul(TAX_RATES.SOCIAL_TAX), dueDate: nextMonth20th });
    }

    if (org.taxRegime === "VAT") {
      const vatEntries = await tx.journalEntry.findMany({
        where: {
          document: { periodId, orgId, type: { code: "REVENUE_VAT" } },
          account: { code: ACCOUNTS.TAX_PAYABLE }
        }
      });
      const vatAmount = vatEntries.reduce(
        (s: Decimal, e: any) => s.plus(new Decimal(e.credit.toString())), new Decimal(0)
      );
      if (vatAmount.gt(0)) {
        taxes.push({ type: "VAT", amount: vatAmount, dueDate: nextMonth20th });
      }

      // E2. Начислить налог на прибыль проводкой Дт 9810 — Кт 6410
      if (netProfit.gt(0)) {
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
                  { accountCode: "9810", side: "debit", expression: "taxAmount" },
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
      if (totalRevenue.gt(0)) {
        taxes.push({ type: "TURNOVER_TAX", amount: totalRevenue.mul(TAX_RATES.TURNOVER_TAX), dueDate: nextMonth20th });
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

    // G. Заблокировать период
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

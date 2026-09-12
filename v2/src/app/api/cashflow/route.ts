import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getActiveOrgId } from "@/lib/context";
import Decimal from "decimal.js";
import { Prisma } from "@prisma/client";
import { BANK_ACCOUNT_CODES, BANK_USD_CODES, BANK_UZS_CODES } from "@/lib/constants";
import { InvalidReportPeriod, reportPeriod } from "@/lib/reports/reportPeriod";

export async function GET(req: NextRequest) {
  try {
    const orgId = await getActiveOrgId();
    const { searchParams } = new URL(req.url);

    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");
    const accountId = searchParams.get("accountId");

    const { startDate, endExclusive, months } = reportPeriod(fromParam, toParam);

    return await prisma.$transaction(async (tx) => {
    const accountCodes = [...BANK_ACCOUNT_CODES];
    let bankScope: Prisma.DocumentWhereInput = {};
    let bankScopeSql = Prisma.empty;
    if (accountId && accountId !== "ALL") {
      const bankAccount = await tx.bankAccount.findFirst({
        where: { id: accountId, orgId }
      });
      if (!bankAccount) {
        return NextResponse.json({ error: "Банковский счёт не найден" }, { status: 404 });
      }
      const selectedSource = { orgId, bankAccountId: accountId, bankAccount: { orgId } };
      bankScope = { stagedTransactions: { some: selectedSource } };
      const ambiguousEntry = await tx.journalEntry.findFirst({
        where: {
          account: { code: { in: accountCodes } },
          document: {
            orgId, status: "POSTED", date: { lt: endExclusive },
            OR: [
              { stagedTransactions: { none: { orgId, bankAccount: { orgId } } } },
              { AND: [bankScope, { stagedTransactions: { some: { NOT: selectedSource } } }] },
            ],
          },
        },
        select: { id: true },
      });
      if (ambiguousEntry) {
        return NextResponse.json({ error: "ДДС по отдельному счёту требует однозначной привязки всех банковских проводок. Есть документы без банковского источника или с источниками разных счетов." }, { status: 409 });
      }
      bankScopeSql = Prisma.sql`AND EXISTS (
        SELECT 1 FROM "StagedTransaction" st
        JOIN "BankAccount" ba ON ba.id = st."bankAccountId"
        WHERE st."documentId" = d.id AND st."orgId" = ${orgId}
          AND ba."orgId" = ${orgId} AND st."bankAccountId" = ${accountId}
      )`;
    }

    // Get journal entries
    const entries = await tx.journalEntry.findMany({
      where: {
        document: {
          orgId,
          status: "POSTED",
          ...bankScope,
          date: {
            gte: startDate,
            lt: endExclusive
          }
        },
        account: {
          code: { in: accountCodes }
        }
      },
      include: {
        document: {
          include: {
            type: true
          }
        }
      },
      orderBy: {
        date: "asc"
      }
    });

    // Define categories
    const incomeCategories = [
      { code: "REVENUE", name: "Выручка от продаж" },
      { code: "ADVANCE_RECEIVED", name: "Авансы полученные" },
      { code: "FOUNDER_LOAN", name: "Займы от учредителя" },
      { code: "CAPITAL_CONTRIBUTION", name: "Пополнение уставного капитала" },
      { code: "BANK_LOAN", name: "Банковские кредиты" },
      { code: "FX_GAIN", name: "Положительные курсовые разницы" },
      { code: "OTHER_INFLOW", name: "Прочие поступления" }
    ];

    const expenseCategories = [
      { code: "SUPPLIER_PAYMENT", name: "Закупка товаров / услуг" },
      { code: "ADVANCE_PAID", name: "Авансы выданные" },
      { code: "SALARY", name: "Выплата зарплаты (нетто)" },
      { code: "TAXES", name: "Налоги в бюджет (НДФЛ, НДС, НнП, НсО)" },
      { code: "INPS", name: "ИНПС (накопительная пенсия)" },
      { code: "SOCIAL_TAX", name: "Соцналог" },
      { code: "RENT", name: "Аренда" },
      { code: "ADVERTISING", name: "Реклама" },
      { code: "ACCOUNTABLE", name: "Подотчётные суммы" },
      { code: "DEPOSIT", name: "Гарантийный депозит" },
      { code: "CAPEX", name: "Капитальные расходы (ОС/НМА)" },
      { code: "LOAN_REPAYMENT", name: "Погашение кредитов / займов" },
      { code: "FX_LOSS", name: "Отрицательные курсовые разницы" },
      { code: "OTHER_OUTFLOW", name: "Прочие расходы" }
    ];

    // Initialize map
    const incomeMap = new Map<string, Decimal[]>();
    const expenseMap = new Map<string, Decimal[]>();

    for (const cat of incomeCategories) {
      incomeMap.set(cat.code, Array(months.length).fill(null).map(() => new Decimal(0)));
    }
    for (const cat of expenseCategories) {
      expenseMap.set(cat.code, Array(months.length).fill(null).map(() => new Decimal(0)));
    }

    const netFlow = Array(months.length).fill(null).map(() => new Decimal(0));
    const monthFormatter = new Intl.DateTimeFormat("en", {
      timeZone: "Asia/Tashkent", year: "numeric", month: "2-digit",
    });

    // Process entries
    for (const entry of entries) {
      const doc = entry.document;
      // Both legs of an internal transfer touch tracked cash accounts (5110/5210/5710) —
      // excluded entirely so they don't inflate OTHER_INFLOW/OTHER_OUTFLOW totals (net
      // effect on cash is zero, it's money moving between own accounts, not real flow).
      if (doc.type.code === "INTERNAL_TRANSFER" || doc.type.code === "INTERNAL_TRANSFER_RECEIVED") continue;

      const dateParts = monthFormatter.formatToParts(doc.date);
      const dateStr = `${dateParts.find(part => part.type === "year")!.value}-${dateParts.find(part => part.type === "month")!.value}`;
      const monthIdx = months.indexOf(dateStr);
      if (monthIdx === -1) continue;

      // FX_DIFFERENCE entries affect the bank balance (5210) — include as separate category
      // so that openingBalance + netFlow = closingBalance.
      if (doc.type.code === "FX_DIFFERENCE") {
        const debit = new Decimal(entry.debit.toString());
        const credit = new Decimal(entry.credit.toString());

        if (debit.gt(0)) {
          const arr = incomeMap.get("FX_GAIN");
          if (arr) { arr[monthIdx] = arr[monthIdx].plus(debit); netFlow[monthIdx] = netFlow[monthIdx].plus(debit); }
        }
        if (credit.gt(0)) {
          const arr = expenseMap.get("FX_LOSS");
          if (arr) { arr[monthIdx] = arr[monthIdx].plus(credit); netFlow[monthIdx] = netFlow[monthIdx].minus(credit); }
        }
        continue;
      }

      const debit = new Decimal(entry.debit.toString());
      const credit = new Decimal(entry.credit.toString());

      if (debit.gt(0)) {
        // Inflow
        let catCode = "OTHER_INFLOW";
        if (["REVENUE_VAT", "REVENUE_NO_VAT", "MARKETPLACE_INCOME"].includes(doc.type.code)) {
          catCode = "REVENUE";
        } else if (doc.type.code === "ADVANCE_RECEIVED") {
          catCode = "ADVANCE_RECEIVED";
        } else if (doc.type.code === "FOUNDER_LOAN") {
          catCode = "FOUNDER_LOAN";
        } else if (doc.type.code === "CAPITAL_CONTRIBUTION") {
          catCode = "CAPITAL_CONTRIBUTION";
        } else if (doc.type.code === "BANK_LOAN_RECEIVED") {
          catCode = "BANK_LOAN";
        } else if ([
          "SUPPLIER_REFUND", "EMPLOYEE_LOAN_REPAYMENT",
          "ACCOUNTABLE_RETURN", "ACCOUNTABLE_GENERAL_RETURN", "DEPOSIT_RETURN",
        ].includes(doc.type.code)) {
          // Refunds/returns of money previously paid out — treat as Other Inflow (balance op),
          // same as the outgoing legs (ACCOUNTABLE/ACCOUNTABLE_GENERAL/DEPOSIT) aren't broken
          // out from OTHER_OUTFLOW's counterparts below.
          catCode = "OTHER_INFLOW";
        }

        const arr = incomeMap.get(catCode);
        if (arr) {
          arr[monthIdx] = arr[monthIdx].plus(debit);
          netFlow[monthIdx] = netFlow[monthIdx].plus(debit);
        }
      }

      if (credit.gt(0)) {
        // Outflow
        let catCode = "OTHER_OUTFLOW";
        // Игнорируем балансовые операции (не денежный поток)
        if (doc.type.code === "EMPLOYEE_LOAN") {
          // Займ сотруднику — балансовая операция, отображаем отдельно
          catCode = "OTHER_OUTFLOW";
        } else if (["SUPPLIER_PAYMENT", "SUPPLIER_PAYMENT_GOODS", "SUPPLIER_PAYMENT_SERVICES", "SUPPLIER_PAYMENT_OTHER", "SUPPLIER_PAYMENT_VAT"].includes(doc.type.code)) {
          catCode = "SUPPLIER_PAYMENT";
        } else if (doc.type.code === "ADVANCE_PAID") {
          catCode = "ADVANCE_PAID";
        } else if (doc.type.code === "SALARY") {
          catCode = "SALARY";
        } else if (doc.type.code === "TAX_PAYMENT") {
          // TAX_PAYMENT covers: НДФЛ, НДС, налог на прибыль, налог с оборота — all go to "Налоги в бюджет"
          catCode = "TAXES";
        } else if (doc.type.code === "INPS_PAYMENT") {
          catCode = "INPS";
        } else if (doc.type.code === "SOCIAL_TAX_PAYMENT") {
          catCode = "SOCIAL_TAX";
        } else if (doc.type.code === "FOUNDER_LOAN_REPAYMENT") {
          catCode = "LOAN_REPAYMENT";
        } else if (doc.type.code === "RENT") {
          catCode = "RENT";
        } else if (doc.type.code === "ADVERTISING") {
          catCode = "ADVERTISING";
        } else if (doc.type.code === "ACCOUNTABLE") {
          catCode = "ACCOUNTABLE";
        } else if (doc.type.code === "DEPOSIT") {
          catCode = "DEPOSIT";
        } else if (["FIXED_ASSET_PURCHASE", "INTANGIBLE_ASSET_PURCHASE"].includes(doc.type.code)) {
          catCode = "CAPEX";
        } else if (doc.type.code === "BANK_LOAN_REPAYMENT") {
          catCode = "LOAN_REPAYMENT";
        }

        const arr = expenseMap.get(catCode);
        if (arr) {
          arr[monthIdx] = arr[monthIdx].plus(credit);
          netFlow[monthIdx] = netFlow[monthIdx].minus(credit);
        }
      }
    }

    // Format response
    const incomeData = incomeCategories.map((cat) => {
      const amounts = incomeMap.get(cat.code)!;
      const total = amounts.reduce((sum, val) => sum.plus(val), new Decimal(0));
      return {
        categoryCode: cat.code,
        categoryName: cat.name,
        amounts: amounts.map((a) => a.toNumber()),
        total: total.toNumber()
      };
    });

    const expenseData = expenseCategories.map((cat) => {
      const amounts = expenseMap.get(cat.code)!;
      const total = amounts.reduce((sum, val) => sum.plus(val), new Decimal(0));
      return {
        categoryCode: cat.code,
        categoryName: cat.name,
        amounts: amounts.map((a) => a.toNumber()),
        total: total.toNumber()
      };
    });

    // Остатки на начало и конец периода по кассовым счетам
    type BalRow = { total: string };
    const orgBankAccounts = await tx.bankAccount.findMany({ where: { orgId } });
    const hasMixedCurrencies = !accountId || accountId === "ALL"
      ? orgBankAccounts.some(a => a.currency !== "USD") && orgBankAccounts.some(a => a.currency === "USD")
      : false;

    const [openRows, closeRows, openRowsUZS, closeRowsUZS, openRowsUSD, closeRowsUSD] = await Promise.all([
      tx.$queryRaw<BalRow[]>`
        SELECT COALESCE(SUM(je.debit - je.credit), 0)::text AS total
        FROM "JournalEntry" je
        JOIN "Document" d ON d.id = je."documentId"
        JOIN "Account" a ON a.id = je."accountId"
        WHERE d."orgId" = ${orgId} AND d.status = 'POSTED'
          AND d.date < ${startDate}
          AND a.code = ANY(${accountCodes}::text[])
          ${bankScopeSql}
      `,
      tx.$queryRaw<BalRow[]>`
        SELECT COALESCE(SUM(je.debit - je.credit), 0)::text AS total
        FROM "JournalEntry" je
        JOIN "Document" d ON d.id = je."documentId"
        JOIN "Account" a ON a.id = je."accountId"
        WHERE d."orgId" = ${orgId} AND d.status = 'POSTED'
          AND d.date < ${endExclusive}
          AND a.code = ANY(${accountCodes}::text[])
          ${bankScopeSql}
      `,
      tx.$queryRaw<BalRow[]>`
        SELECT COALESCE(SUM(je.debit - je.credit), 0)::text AS total
        FROM "JournalEntry" je
        JOIN "Document" d ON d.id = je."documentId"
        JOIN "Account" a ON a.id = je."accountId"
        WHERE d."orgId" = ${orgId} AND d.status = 'POSTED'
          AND d.date < ${startDate}
          AND a.code = ANY(${[...BANK_UZS_CODES]}::text[])
          ${bankScopeSql}
      `,
      tx.$queryRaw<BalRow[]>`
        SELECT COALESCE(SUM(je.debit - je.credit), 0)::text AS total
        FROM "JournalEntry" je
        JOIN "Document" d ON d.id = je."documentId"
        JOIN "Account" a ON a.id = je."accountId"
        WHERE d."orgId" = ${orgId} AND d.status = 'POSTED'
          AND d.date < ${endExclusive}
          AND a.code = ANY(${[...BANK_UZS_CODES]}::text[])
          ${bankScopeSql}
      `,
      tx.$queryRaw<BalRow[]>`
        SELECT COALESCE(SUM(je.debit - je.credit), 0)::text AS total
        FROM "JournalEntry" je
        JOIN "Document" d ON d.id = je."documentId"
        JOIN "Account" a ON a.id = je."accountId"
        WHERE d."orgId" = ${orgId} AND d.status = 'POSTED'
          AND d.date < ${startDate}
          AND a.code = ANY(${[...BANK_USD_CODES]}::text[])
          ${bankScopeSql}
      `,
      tx.$queryRaw<BalRow[]>`
        SELECT COALESCE(SUM(je.debit - je.credit), 0)::text AS total
        FROM "JournalEntry" je
        JOIN "Document" d ON d.id = je."documentId"
        JOIN "Account" a ON a.id = je."accountId"
        WHERE d."orgId" = ${orgId} AND d.status = 'POSTED'
          AND d.date < ${endExclusive}
          AND a.code = ANY(${[...BANK_USD_CODES]}::text[])
          ${bankScopeSql}
      `
    ]);

    return NextResponse.json({
      months,
      income: incomeData,
      expense: expenseData,
      netFlow: netFlow.map((n) => n.toNumber()),
      openingBalance: Number(openRows[0]?.total || 0),
      closingBalance: Number(closeRows[0]?.total || 0),
      hasMixedCurrencies,
      openingBalanceUZS: Number(openRowsUZS[0]?.total || 0),
      closingBalanceUZS: Number(closeRowsUZS[0]?.total || 0),
      openingBalanceUSD: Number(openRowsUSD[0]?.total || 0),
      closingBalanceUSD: Number(closeRowsUSD[0]?.total || 0)
    });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, maxWait: 5000, timeout: 15000 });
  } catch (err: any) {
    if (err instanceof InvalidReportPeriod) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    if (err.message === "UNAUTHORIZED" || err.message === "NO_ACTIVE_ORG") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("GET CASHFLOW ERROR:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

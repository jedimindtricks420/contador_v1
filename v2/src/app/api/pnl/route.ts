import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getActiveOrgId } from "@/lib/context";
import { ACCOUNTS, REVENUE_ACCOUNT_CODES, COGS_ACCOUNT_CODES, TAX_RATES } from "@/lib/constants";
import Decimal from "decimal.js";
import { InvalidReportPeriod, reportPeriod } from "@/lib/reports/reportPeriod";

type AggRow = { code: string; sumDebit: string; sumCredit: string };

// ─── TRANSIT (9xxx) line codes — Форма №2 ───────────────────────────────────────
// Single source of truth for both the P&L lines below AND
// pnl-transit-completeness.test.ts, which checks that every TRANSIT account in
// the chart of accounts (seed-coa.ts) either appears in PNL_COVERED_TRANSIT_CODES
// (below, combined with REVENUE_ACCOUNT_CODES/COGS_ACCOUNT_CODES/ACCOUNTS.EXPENSE_*
// imported above) or is explicitly listed in PNL_INTENTIONALLY_EXCLUDED_TRANSIT_CODES
// with a documented reason — so a newly added TRANSIT account can't silently vanish
// from Форма №2 the way 9820 almost did (see errors_forms_audit / changelog П1.2).
export const LINE010_CONTRA_CODES = ["9040", "9050"]; // сторно выручки / скидки покупателям
export const LINE090_CREDIT_CODES = ["9310", "9320", "9330", "9340", "9350", "9360", "9370", "9380", "9390"];
export const LINE090_DEBIT_CODES: string[] = [];
export const LINE120_CODES = ["9520"];
export const LINE130_CODES = ["9530"];
export const LINE140_CODES = ["9550"];
export const LINE150_CODES = ["9540"];
export const LINE160_CODES = ["9510", "9560", "9590"];
export const LINE180_CODES = ["9610"];
export const LINE200_CODES = ["9620"];
export const LINE210_CODES = ["9630", "9690"];
export const LINE230_CREDIT_CODES = ["9710"];
export const LINE230_DEBIT_CODES = ["9720"];
export const LINE250_CODES = ["9810"];
export const LINE260_CODES = ["9820"];

export const PNL_COVERED_TRANSIT_CODES = [
  ...REVENUE_ACCOUNT_CODES, ...LINE010_CONTRA_CODES,
  ...COGS_ACCOUNT_CODES,
  ACCOUNTS.EXPENSE_SALES, ACCOUNTS.EXPENSE_ADMIN, ACCOUNTS.EXPENSE_OTHER,
  ...LINE090_CREDIT_CODES, ...LINE090_DEBIT_CODES,
  ...LINE120_CODES, ...LINE130_CODES, ...LINE140_CODES, ...LINE150_CODES, ...LINE160_CODES,
  ...LINE180_CODES, ...LINE200_CODES, ...LINE210_CODES,
  ...LINE230_CREDIT_CODES, ...LINE230_DEBIT_CODES,
  ...LINE250_CODES, ...LINE260_CODES,
];

// Счета, которые ФАКТИЧЕСКИ используются шаблонами типов документов (см.
// ensureBaseData.ts), но по конструкции всегда нетто-обнуляются — их реальный
// P&L-эффект уже отражён в других, покрытых строках, поэтому им не нужна
// собственная строка Формы №2, и их появление в шаблонах — ожидаемо и не
// является поводом падать.
export const PNL_ZERO_NET_TRANSIT_CODES = [
  "9210",
];

// Счета официального плана НСБУ-21, которые сейчас не проводятся НИ ОДНИМ типом
// документа (см. ensureBaseData.ts), поэтому их отсутствие в отчёте сегодня не
// искажает цифры. Если когда-нибудь появится документ, проводящий через один из
// них, — pnl-transit-completeness.test.ts упадёт и заставит явно решить, в какую
// строку Формы №2 его включить (а не просто молча оставить здесь).
export const PNL_UNUSED_TRANSIT_CODES = [
  "9140", // Приобретение ТМЗ при периодическом методе учёта — метод не реализован (система использует только perpetual-учёт через 2910)
  "9150", // Корректировки ТМЗ при периодическом методе учёта — та же причина, что и 9140
  "9220", // Выбытие прочих активов (не ОС) — ни один тип документа сейчас не проводит через этот счёт
  "9910", // Конечный финрезультат — закрывается отдельной логикой реформации в closing.ts, вне помесячного диапазона P&L (dt.code != 'PERIOD_CLOSING')
];

export const PNL_INTENTIONALLY_EXCLUDED_TRANSIT_CODES = [
  ...PNL_ZERO_NET_TRANSIT_CODES,
  ...PNL_UNUSED_TRANSIT_CODES,
];

export async function GET(req: NextRequest) {
  try {
    const orgId = await getActiveOrgId();
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { taxRegime: true, turnoverTaxRate: true }
    });
    const { searchParams } = new URL(req.url);

    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");

    const { startDate, endDate, endExclusive, months } = reportPeriod(fromParam, toParam);

    // Агрегация по коду счёта за весь период (исключая PERIOD_CLOSING)
    const aggRows = await prisma.$queryRaw<AggRow[]>`
      SELECT a.code,
             SUM(je.debit)::text  AS "sumDebit",
             SUM(je.credit)::text AS "sumCredit"
      FROM "JournalEntry" je
      JOIN "Document"     d ON d.id = je."documentId"
      JOIN "DocumentType" dt ON dt.id = d."typeId"
      JOIN "Account"      a ON a.id = je."accountId"
      WHERE d."orgId"  = ${orgId}
        AND d.status   = 'POSTED'
        AND d.date    >= ${startDate}
        AND d.date     < ${endExclusive}
        AND dt.code   != 'PERIOD_CLOSING'
      GROUP BY a.code
    `;

    const aggByCode = new Map<string, { debit: Decimal; credit: Decimal }>();
    for (const row of aggRows) {
      aggByCode.set(row.code, {
        debit:  new Decimal(row.sumDebit  || "0"),
        credit: new Decimal(row.sumCredit || "0")
      });
    }

    const td = (code: string) => aggByCode.get(code)?.debit  ?? new Decimal(0);
    const tc = (code: string) => aggByCode.get(code)?.credit ?? new Decimal(0);
    const debitNet = (code: string) => td(code).minus(tc(code));
    const creditNet = (code: string) => tc(code).minus(td(code));
    const creditNetMany = (...codes: string[]) => codes.reduce((sum, code) => sum.plus(creditNet(code)), new Decimal(0));
    const debitNetMany = (...codes: string[]) => codes.reduce((sum, code) => sum.plus(debitNet(code)), new Decimal(0));

    // Форма №2 строки — счета берутся из тех же констант, что использует расчёт
    // налога в closing.ts (REVENUE_ACCOUNT_CODES/COGS_ACCOUNT_CODES/ACCOUNTS.*),
    // а не из отдельно переписанного списка — см. balance-sheet-completeness.test.ts
    // и pnl-shared-constants.test.ts для регрессии на рассинхронизацию.
    const line010 = creditNetMany(...REVENUE_ACCOUNT_CODES).minus(debitNetMany(...LINE010_CONTRA_CODES));
    const line020 = debitNetMany(...COGS_ACCOUNT_CODES);
    const line030 = line010.minus(line020);

    const line050 = debitNet(ACCOUNTS.EXPENSE_SALES);
    const line060 = debitNet(ACCOUNTS.EXPENSE_ADMIN);
    const line070 = debitNet(ACCOUNTS.EXPENSE_OTHER);
    const line080 = debitNet("9440"); // счёт 9440 не заведён в плане счетов — строка всегда 0, оставлено для формы
    const line040 = line050.plus(line060).plus(line070).plus(line080);

    const line090 = creditNetMany(...LINE090_CREDIT_CODES)
      .minus(debitNetMany(...LINE090_DEBIT_CODES));
    const line100 = line030.minus(line040).plus(line090);

    const line120 = creditNet(LINE120_CODES[0]);
    const line130 = creditNet(LINE130_CODES[0]);
    const line140 = creditNet(LINE140_CODES[0]);
    const line150 = creditNet(LINE150_CODES[0]);
    const line160 = creditNetMany(...LINE160_CODES);
    const line110 = line120.plus(line130).plus(line140).plus(line150).plus(line160);

    const line180 = debitNet(LINE180_CODES[0]);
    const line190 = new Decimal(0);
    const line200 = debitNet(LINE200_CODES[0]);
    const line210 = debitNetMany(...LINE210_CODES);
    const line170 = line180.plus(line190).plus(line200).plus(line210);

    const line220 = line100.plus(line110).minus(line170);
    const line230 = creditNet(LINE230_CREDIT_CODES[0]).minus(debitNet(LINE230_DEBIT_CODES[0]));
    const line240 = line220.plus(line230);

    const line250 = debitNet(LINE250_CODES[0]);
    const line250final = line250;

    const line260 = debitNet(LINE260_CODES[0]);
    const line270 = line240.minus(line250final).minus(line260);

    // Помесячный разрез для ключевых строк (графики)
    const monthlyRows = await prisma.$queryRaw<(AggRow & { month: string })[]>`
      SELECT a.code,
             TO_CHAR(d.date AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tashkent', 'YYYY-MM') AS month,
             SUM(je.debit)::text  AS "sumDebit",
             SUM(je.credit)::text AS "sumCredit"
      FROM "JournalEntry" je
      JOIN "Document"     d  ON d.id = je."documentId"
      JOIN "DocumentType" dt ON dt.id = d."typeId"
      JOIN "Account"      a  ON a.id = je."accountId"
      WHERE d."orgId"  = ${orgId}
        AND d.status   = 'POSTED'
        AND d.date    >= ${startDate}
        AND d.date     < ${endExclusive}
        AND dt.code   != 'PERIOD_CLOSING'
        -- Держать в списке ниже те же коды, что в PNL_COVERED_TRANSIT_CODES выше
        -- (плюс '9440', которого нет в плане счетов и который сюда никогда не попадёт) —
        -- pnl-transit-completeness.test.ts проверяет только агрегатные line0XX выше,
        -- этот SQL-фильтр для помесячного разреза графиков сверяется вручную.
        AND a.code IN ('9010','9020','9030','9040','9050',
                       '9110','9120','9130',
                       '9410','9420','9430','9440',
                       '9310','9320','9330','9340','9350','9360','9370','9380','9390',
                       '9810','9820','9710','9720',
                       '9510','9520','9530','9540','9550','9560','9590',
                       '9610','9620','9630','9690')
      GROUP BY a.code, TO_CHAR(d.date AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tashkent', 'YYYY-MM')
    `;

    // Индекс помесячных данных
    type MonthCodeKey = `${string}|${string}`;
    const mMap = new Map<MonthCodeKey, { debit: Decimal; credit: Decimal }>();
    for (const r of monthlyRows) {
      const key: MonthCodeKey = `${r.month}|${r.code}`;
      const prev = mMap.get(key) ?? { debit: new Decimal(0), credit: new Decimal(0) };
      prev.debit  = prev.debit.plus(new Decimal(r.sumDebit   || "0"));
      prev.credit = prev.credit.plus(new Decimal(r.sumCredit || "0"));
      mMap.set(key, prev);
    }

    const mtd = (month: string, code: string) => mMap.get(`${month}|${code}` as MonthCodeKey)?.debit  ?? new Decimal(0);
    const mtc = (month: string, code: string) => mMap.get(`${month}|${code}` as MonthCodeKey)?.credit ?? new Decimal(0);
    const monthlyDebitNet = (month: string, code: string) => mtd(month, code).minus(mtc(month, code));
    const monthlyCreditNet = (month: string, code: string) => mtc(month, code).minus(mtd(month, code));

    const monthlyRevenueOf = (m: string) =>
      REVENUE_ACCOUNT_CODES.reduce((sum, code) => sum.plus(monthlyCreditNet(m, code)), new Decimal(0))
        .minus(monthlyDebitNet(m,"9040")).minus(monthlyDebitNet(m,"9050"));

    const monthlyRevenue = months.map(m => monthlyRevenueOf(m).toNumber());

    const monthlyNetProfit  = months.map(m => {
      const r = monthlyRevenueOf(m);
      const cogs = COGS_ACCOUNT_CODES.reduce((sum, code) => sum.plus(monthlyDebitNet(m, code)), new Decimal(0));
      const exp  = monthlyDebitNet(m, ACCOUNTS.EXPENSE_SALES).plus(monthlyDebitNet(m, ACCOUNTS.EXPENSE_ADMIN)).plus(monthlyDebitNet(m, ACCOUNTS.EXPENSE_OTHER)).plus(monthlyDebitNet(m,"9440"));
      const oi   = LINE090_CREDIT_CODES
             .reduce((sum, code) => sum.plus(monthlyCreditNet(m, code)), new Decimal(0))
             .minus(LINE090_DEBIT_CODES.reduce((sum, code) => sum.plus(monthlyDebitNet(m, code)), new Decimal(0)));
      const fin  = [...LINE120_CODES, ...LINE130_CODES, ...LINE140_CODES, ...LINE150_CODES, ...LINE160_CODES]
             .reduce((sum, code) => sum.plus(monthlyCreditNet(m, code)), new Decimal(0));
      const finExp = [...LINE180_CODES, ...LINE200_CODES, ...LINE210_CODES]
             .reduce((sum, code) => sum.plus(monthlyDebitNet(m, code)), new Decimal(0));
      const pbt  = r.minus(cogs).minus(exp).plus(oi).plus(fin).minus(finExp)
            .plus(monthlyCreditNet(m,LINE230_CREDIT_CODES[0])).minus(monthlyDebitNet(m,LINE230_DEBIT_CODES[0]));
      // Нетто 9810: Дт начислений минус Кт сторно (PROFIT_TAX_REVERSAL) — в месяц
      // сторно налоговая нагрузка уменьшается, чистая прибыль растёт.
      const tax  = mtd(m,LINE250_CODES[0]).minus(mtc(m,LINE250_CODES[0]));
      return pbt.minus(tax).minus(monthlyDebitNet(m,LINE260_CODES[0])).toNumber();
    });

    return NextResponse.json({
      period: { from: startDate, to: endDate },
      taxRegime: org?.taxRegime ?? "TURNOVER_TAX",
      turnoverTaxRate: org?.turnoverTaxRate ?? TAX_RATES.TURNOVER_TAX,
      lines: {
        line010: line010.toNumber(),
        line020: line020.toNumber(),
        line030: line030.toNumber(),
        line040: line040.toNumber(),
        line050: line050.toNumber(),
        line060: line060.toNumber(),
        line070: line070.toNumber(),
        line080: line080.toNumber(),
        line090: line090.toNumber(),
        line100: line100.toNumber(),
        line110: line110.toNumber(),
        line120: line120.toNumber(),
        line130: line130.toNumber(),
        line140: line140.toNumber(),
        line150: line150.toNumber(),
        line160: line160.toNumber(),
        line170: line170.toNumber(),
        line180: line180.toNumber(),
        line200: line200.toNumber(),
        line210: line210.toNumber(),
        line220: line220.toNumber(),
        line230: line230.toNumber(),
        line240: line240.toNumber(),
        line250: line250final.toNumber(),
        line260: line260.toNumber(),
        line270: line270.toNumber(),
      },
      months,
      monthlyRevenue,
      monthlyNetProfit,
    });
  } catch (err: any) {
    if (err instanceof InvalidReportPeriod) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    if (err.message === "UNAUTHORIZED" || err.message === "NO_ACTIVE_ORG") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("GET PNL ERROR:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

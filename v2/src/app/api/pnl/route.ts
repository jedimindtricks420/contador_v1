import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getActiveOrgId } from "@/lib/context";
import Decimal from "decimal.js";

type AggRow = { code: string; sumDebit: string; sumCredit: string };

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

    const now = new Date();
    const currentYear = now.getFullYear();

    const startDate = fromParam ? new Date(fromParam) : new Date(currentYear, 0, 1);
    const endDate = toParam ? new Date(toParam) : new Date(currentYear, 11, 31, 23, 59, 59);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return NextResponse.json({ error: "Неверный формат даты (from/to)" }, { status: 400 });
    }

    // Generate list of months in YYYY-MM format
    const months: string[] = [];
    let curr = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    const last = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
    while (curr <= last) {
      months.push(`${curr.getFullYear()}-${String(curr.getMonth() + 1).padStart(2, "0")}`);
      curr.setMonth(curr.getMonth() + 1);
    }

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
        AND d.date    <= ${endDate}
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
    const tcMany = (...codes: string[]) => codes.reduce((s, c) => s.plus(tc(c)), new Decimal(0));
    const tdMany = (...codes: string[]) => codes.reduce((s, c) => s.plus(td(c)), new Decimal(0));

    // Форма №2 строки
    const line010 = tcMany("9010","9020","9030").minus(tdMany("9040","9050"));
    const line020 = tdMany("9110","9120","9130");
    const line030 = line010.minus(line020);

    const line050 = td("9410");
    const line060 = td("9420");
    const line070 = td("9430");
    const line080 = td("9440");
    const line040 = line050.plus(line060).plus(line070).plus(line080);

    const line090 = tcMany("9310","9320","9330","9340","9350","9360","9370","9380","9390");
    const line100 = line030.minus(line040).plus(line090);

    const line120 = tc("9520");
    const line130 = tc("9530");
    const line140 = tc("9550");
    const line150 = tc("9540");
    const line160 = tcMany("9510","9560","9590");
    const line110 = line120.plus(line130).plus(line140).plus(line150).plus(line160);

    const line180 = td("9610");
    const line190 = new Decimal(0);
    const line200 = td("9620");
    const line210 = tdMany("9630","9690");
    const line170 = line180.plus(line190).plus(line200).plus(line210);

    const line220 = line100.plus(line110).minus(line170);
    const line230 = tc("9710").minus(td("9720"));
    const line240 = line220.plus(line230);

    // стр. 250 — из проводок 9810; если 0 — из taxCalendarEvent только по периодам в диапазоне
    const line250 = td("9810");
    let taxAmountFromCalendar = new Decimal(0);
    if (line250.isZero()) {
      // Берём только события, привязанные к периодам внутри диапазона дат,
      // чтобы не захватить налоги соседних периодов.
      const periodsInRange = await prisma.period.findMany({
        where: { orgId },
        select: { id: true, year: true, month: true }
      });
      const periodIdsInRange = periodsInRange
        .filter(p => {
          const pDate = new Date(p.year, p.month - 1, 1);
          return pDate >= new Date(startDate.getFullYear(), startDate.getMonth(), 1)
              && pDate <= new Date(endDate.getFullYear(), endDate.getMonth(), 1);
        })
        .map(p => p.id);

      if (periodIdsInRange.length > 0) {
        const taxEvents = await prisma.taxCalendarEvent.findMany({
          where: {
            orgId,
            periodId: { in: periodIdsInRange },
            type: { in: ["PROFIT_TAX", "TURNOVER_TAX"] }
          },
          select: { estimatedAmount: true }
        });
        taxAmountFromCalendar = taxEvents.reduce(
          (s, e) => s.plus(new Decimal(e.estimatedAmount?.toString() || "0")), new Decimal(0)
        );
      }
    }
    const line250final = line250.gt(0) ? line250 : taxAmountFromCalendar;

    const line260 = td("9820");
    const line270 = line240.minus(line250final).minus(line260);

    // Помесячный разрез для ключевых строк (графики)
    const monthlyRows = await prisma.$queryRaw<(AggRow & { month: string })[]>`
      SELECT a.code,
             TO_CHAR(d.date, 'YYYY-MM') AS month,
             SUM(je.debit)::text  AS "sumDebit",
             SUM(je.credit)::text AS "sumCredit"
      FROM "JournalEntry" je
      JOIN "Document"     d  ON d.id = je."documentId"
      JOIN "DocumentType" dt ON dt.id = d."typeId"
      JOIN "Account"      a  ON a.id = je."accountId"
      WHERE d."orgId"  = ${orgId}
        AND d.status   = 'POSTED'
        AND d.date    >= ${startDate}
        AND d.date    <= ${endDate}
        AND dt.code   != 'PERIOD_CLOSING'
        AND a.code IN ('9010','9020','9030','9040','9050',
                       '9110','9120','9130',
                       '9410','9420','9430','9440',
                       '9310','9320','9330','9340','9350','9360','9370','9380','9390',
                       '9810','9820','9710','9720',
                       '9510','9520','9530','9540','9550','9560','9590',
                       '9610','9620','9630','9690')
      GROUP BY a.code, TO_CHAR(d.date, 'YYYY-MM')
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

    const monthlyRevenue = months.map(m =>
      mtc(m,"9010").plus(mtc(m,"9020")).plus(mtc(m,"9030"))
        .minus(mtd(m,"9040")).minus(mtd(m,"9050")).toNumber()
    );

    const monthlyNetProfit  = months.map(m => {
      const r = mtc(m,"9010").plus(mtc(m,"9020")).plus(mtc(m,"9030"))
                  .minus(mtd(m,"9040")).minus(mtd(m,"9050"));
      const cogs = mtd(m,"9110").plus(mtd(m,"9120")).plus(mtd(m,"9130"));
      const exp  = mtd(m,"9410").plus(mtd(m,"9420")).plus(mtd(m,"9430")).plus(mtd(m,"9440"));
      const oi   = ["9310","9320","9330","9340","9350","9360","9370","9380","9390"]
                     .reduce((s,c) => s.plus(mtc(m,c)), new Decimal(0));
      const fin  = ["9510","9520","9530","9540","9550","9560","9590"]
                     .reduce((s,c) => s.plus(mtc(m,c)), new Decimal(0));
      const finExp = mtd(m,"9610").plus(mtd(m,"9620")).plus(mtd(m,"9630")).plus(mtd(m,"9690"));
      const pbt  = r.minus(cogs).minus(exp).plus(oi).plus(fin).minus(finExp)
                    .plus(mtc(m,"9710")).minus(mtd(m,"9720"));
      const tax  = mtd(m,"9810").gt(0) ? mtd(m,"9810") : new Decimal(0);
      return pbt.minus(tax).minus(mtd(m,"9820")).toNumber();
    });

    return NextResponse.json({
      period: { from: startDate, to: endDate },
      taxRegime: org?.taxRegime ?? "TURNOVER_TAX",
      turnoverTaxRate: org?.turnoverTaxRate ?? 0.04,
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
    if (err.message === "UNAUTHORIZED" || err.message === "NO_ACTIVE_ORG") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("GET PNL ERROR:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getActiveOrgId } from "@/lib/context";
import Decimal from "decimal.js";

type AggRow = { code: string; sumDebit: string; sumCredit: string };

export async function GET(req: NextRequest) {
  try {
    const orgId = await getActiveOrgId();
    const { searchParams } = new URL(req.url);

    const toParam = searchParams.get("to");
    const endDate = toParam ? new Date(toParam) : new Date(new Date().getFullYear(), 11, 31, 23, 59, 59);

    const aggRows = await prisma.$queryRaw<AggRow[]>`
      SELECT a.code,
             SUM(je.debit)::text  AS "sumDebit",
             SUM(je.credit)::text AS "sumCredit"
      FROM "JournalEntry" je
      JOIN "Document" d ON d.id = je."documentId"
      JOIN "Account"  a ON a.id = je."accountId"
      WHERE d."orgId" = ${orgId}
        AND d.status  = 'POSTED'
        AND d.date   <= ${endDate}
      GROUP BY a.code
    `;

    const cumulByCode = new Map<string, { sumDebit: Decimal; sumCredit: Decimal }>();
    for (const row of aggRows) {
      cumulByCode.set(row.code, {
        sumDebit:  new Decimal(row.sumDebit  || "0"),
        sumCredit: new Decimal(row.sumCredit || "0")
      });
    }

    // Дебетовое сальдо — для активных счетов
    function balDebit(...codes: string[]): Decimal {
      return codes.reduce((s, c) => {
        const row = cumulByCode.get(c);
        if (!row) return s;
        const net = row.sumDebit.minus(row.sumCredit);
        return s.plus(net.gt(0) ? net : new Decimal(0));
      }, new Decimal(0));
    }

    // Кредитовое сальдо — для пассивных/контрарных счетов (отсекает отрицательные)
    function balCredit(...codes: string[]): Decimal {
      return codes.reduce((s, c) => {
        const row = cumulByCode.get(c);
        if (!row) return s;
        const net = row.sumCredit.minus(row.sumDebit);
        return s.plus(net.gt(0) ? net : new Decimal(0));
      }, new Decimal(0));
    }

    // Чистое сальдо (Кт − Дт) без отсечения — для счетов с возможным дебетовым остатком (8710)
    function balNet(...codes: string[]): Decimal {
      return codes.reduce((s, c) => {
        const row = cumulByCode.get(c);
        if (!row) return s;
        return s.plus(row.sumCredit.minus(row.sumDebit));
      }, new Decimal(0));
    }

    // Текущий финрезультат (TRANSIT 9xxx) для открытых периодов
    type TransitNetRow = { netResult: string };
    const transitNetRows = await prisma.$queryRaw<TransitNetRow[]>`
      SELECT (COALESCE(SUM(je.credit), 0) - COALESCE(SUM(je.debit), 0))::text AS "netResult"
      FROM "JournalEntry" je
      JOIN "Document" d ON d.id = je."documentId"
      JOIN "Account"  a ON a.id = je."accountId"
      WHERE d."orgId" = ${orgId}
        AND d.status  = 'POSTED'
        AND d.date   <= ${endDate}
        AND a.type    = 'TRANSIT'
    `;
    const transitNet = new Decimal(transitNetRows[0]?.netResult ?? "0");

    // ─── АКТИВ ───────────────────────────────────────────────────────

    // Раздел I. Долгосрочные активы
    // Все субсчета ОС (0100 родительский + 0110-0190 субсчета)
    const line010 = balDebit("0100","0110","0111","0112","0120","0130","0140","0150","0160","0170","0180","0190","0199");
    const line011 = balCredit("0200","0211","0212","0220","0230","0240","0250","0260","0270","0280","0290","0299");
    const line012 = line010.minus(line011);

    const line020 = balDebit("0410","0420","0430","0440","0460","0470","0480","0490");
    const line021 = balCredit("0510","0520","0530","0540","0560","0570","0590");
    const line022 = line020.minus(line021);

    const line040 = balDebit("0610");
    const line050 = balDebit("0620");
    const line060 = balDebit("0630");
    const line070 = balDebit("0640");
    const line080 = balDebit("0690");
    const line030 = line040.plus(line050).plus(line060).plus(line070).plus(line080);

    // 0310 = капзатраты на арендованное имущество → долгосрочные арендованные активы
    const line090 = balDebit("0310","0710","0720");
    const line100 = balDebit("0810","0820","0830","0840","0850","0860","0870","0890");
    const line110 = balDebit("0910","0920","0930","0940");
    const line120 = balDebit("0950","0960","0990");

    const line130 = line012.plus(line022).plus(line030).plus(line090)
                          .plus(line100).plus(line110).plus(line120);

    // Раздел II. Текущие активы
    const line150 = balDebit("1010","1020","1030","1040","1050","1060","1070","1080","1090",
                              "1110","1120","1510","1610");
    const line160 = balDebit("2010","2110","2310","2510","2610","2710");
    const line170 = balDebit("2810","2820","2830");
    const line180 = balDebit("2910","2920","2930","2940","2950","2960","2970","2990")
                      .minus(balCredit("2980"));
    const line140 = line150.plus(line160).plus(line170).plus(line180);

    const line190 = balDebit("3110","3120","3190");
    const line200 = balDebit("3210","3220","3290");

    const line220 = balDebit("4010","4020").minus(balCredit("4910"));
    const line230 = balDebit("4110");
    const line240 = balDebit("4120");
    const line250 = balDebit("4210","4220","4230","4290");
    const line260 = balDebit("4310","4320","4330");
    const line270 = balDebit("4410");
    const line280 = balDebit("4510","4520");
    const line290 = balDebit("4610");
    const line300 = balDebit("4710","4720","4730","4790");
    const line310 = balDebit("4810","4820","4830","4840","4850","4860","4890");
    const line210 = line220.plus(line230).plus(line240).plus(line250)
                          .plus(line260).plus(line270).plus(line280)
                          .plus(line290).plus(line300).plus(line310);

    const line330 = balDebit("5010","5020");
    const line340 = balDebit("5110");
    const line350 = balDebit("5210","5220");
    const line360 = balDebit("5510","5520","5530","5610","5710");
    const line320 = line330.plus(line340).plus(line350).plus(line360);

    const line370 = balDebit("5810","5830","5890");
    const line380 = balDebit("5910","5920");

    const line390 = line140.plus(line190).plus(line200).plus(line210)
                          .plus(line320).plus(line370).plus(line380);
    const line400 = line130.plus(line390);

    // ─── ПАССИВ ──────────────────────────────────────────────────────

    // Раздел I. Собственный капитал
    const line410 = balCredit("8310","8320","8330");
    const line420 = balCredit("8410","8420");
    const line430 = balCredit("8510","8520","8530");
    const line440 = balDebit("8610","8620");
    // balNet сохраняет отрицательное значение при дебетовом остатке 8710/8720 (непокрытый убыток)
    // 8720 "Накопленная прибыль (непокрытый убыток)" сейчас не используется ни одним типом документа,
    // но входит в состав того же раздела капитала — включаем на случай будущей реформации/переноса.
    const line450 = balNet("8710", "8720").plus(transitNet);
    const line460 = balCredit("8810","8820","8830","8840","8890");
    const line470 = balCredit("8910");
    const line480 = line410.plus(line420).plus(line430).minus(line440)
                          .plus(line450).plus(line460).plus(line470);

    // Раздел II. Обязательства — долгосрочные
    const line500 = balCredit("7010","7020");
    const line510 = balCredit("7110");
    const line520 = balCredit("7120");
    const line530 = balCredit("7210","7220","7230");
    const line540 = balCredit("7240");
    const line550 = balCredit("7250","7290");
    const line560 = balCredit("7310");
    const line570 = balCredit("7810");
    const line580 = balCredit("7820","7830","7840");
    const line590 = balCredit("7910","7920");
    const line490 = line500.plus(line510).plus(line520).plus(line530).plus(line540)
                          .plus(line550).plus(line560).plus(line570).plus(line580).plus(line590);

    // Текущие обязательства
    const line610 = balCredit("6010","6020");
    const line620 = balCredit("6110");
    const line630 = balCredit("6120");
    const line640 = balCredit("6210","6220","6230");
    const line650 = balCredit("6240");
    const line660 = balCredit("6250","6290");
    const line670 = balCredit("6310","6320","6390");
    const line680 = balCredit("6410");
    const line690 = balCredit("6510");
    const line700 = balCredit("6520","6530");
    const line710 = balCredit("6610","6620","6630");
    const line720 = balCredit("6710","6720");
    const line730 = balCredit("6810");
    const line740 = balCredit("6820","6830","6840");
    const line750 = balCredit("6950");
    const line760 = balCredit("6910","6920","6930","6940","6960","6970","6990");
    const line600 = [line610,line620,line630,line640,line650,line660,line670,line680,
                     line690,line700,line710,line720,line730,line740,line750,line760]
                    .reduce((s,v) => s.plus(v), new Decimal(0));

    const line770 = line490.plus(line600);
    const line780 = line480.plus(line770);

    const balanceOk = line400.minus(line780).abs().lte(1);

    const n = (d: Decimal) => d.toNumber();

    return NextResponse.json({
      asOf: endDate,
      balanceCheck: balanceOk,
      difference: line400.minus(line780).toNumber(),
      // Актив
      line010: n(line010), line011: n(line011), line012: n(line012),
      line020: n(line020), line021: n(line021), line022: n(line022),
      line030: n(line030),
      line040: n(line040), line050: n(line050), line060: n(line060),
      line070: n(line070), line080: n(line080),
      line090: n(line090), line100: n(line100), line110: n(line110), line120: n(line120),
      line130: n(line130),
      line140: n(line140),
      line150: n(line150), line160: n(line160), line170: n(line170), line180: n(line180),
      line190: n(line190), line200: n(line200),
      line210: n(line210),
      line220: n(line220), line230: n(line230), line240: n(line240), line250: n(line250),
      line260: n(line260), line270: n(line270), line280: n(line280),
      line290: n(line290), line300: n(line300), line310: n(line310),
      line320: n(line320),
      line330: n(line330), line340: n(line340), line350: n(line350), line360: n(line360),
      line370: n(line370), line380: n(line380),
      line390: n(line390),
      line400: n(line400),
      // Пассив
      line410: n(line410), line420: n(line420), line430: n(line430),
      line440: n(line440), line450: n(line450),
      line460: n(line460), line470: n(line470),
      line480: n(line480),
      line490: n(line490),
      line500: n(line500), line510: n(line510), line520: n(line520),
      line530: n(line530), line540: n(line540), line550: n(line550),
      line560: n(line560), line570: n(line570), line580: n(line580), line590: n(line590),
      line600: n(line600),
      line610: n(line610), line620: n(line620), line630: n(line630),
      line640: n(line640), line650: n(line650), line660: n(line660),
      line670: n(line670), line680: n(line680), line690: n(line690),
      line700: n(line700), line710: n(line710), line720: n(line720),
      line730: n(line730), line740: n(line740), line750: n(line750), line760: n(line760),
      line770: n(line770),
      line780: n(line780),
    });
  } catch (err: any) {
    console.error("GET BALANCE ERROR:", err);
    if (err.message === "UNAUTHORIZED" || err.message === "NO_ACTIVE_ORG") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getActiveOrgId } from "@/lib/context";
import Decimal from "decimal.js";

type AggRow = { code: string; sumDebit: string; sumCredit: string };

// ─── Asset-side line codes (everything except the 5xxx cash group, lines 320-380) ──
// Single source of truth for both the Форма №1 asset lines below AND
// balance-sheet-completeness.test.ts, which checks that every ASSET/CONTRA_ASSET
// account in the chart of accounts (excluding 5xxx, tracked separately) appears
// somewhere in this list — so a newly added account code can't silently fall off
// the balance sheet the way it could before this was a single exported array.
export const LINE010_CODES = ["0100","0110","0111","0112","0120","0130","0140","0150","0160","0170","0180","0190","0199"];
export const LINE011_CODES = ["0200","0211","0212","0220","0230","0240","0250","0260","0270","0280","0290","0299"];
export const LINE020_CODES = ["0410","0420","0430","0440","0460","0470","0480","0490"];
export const LINE021_CODES = ["0510","0520","0530","0540","0560","0570","0590"];
export const LINE040_CODES = ["0610"];
export const LINE050_CODES = ["0620"];
export const LINE060_CODES = ["0630"];
export const LINE070_CODES = ["0640"];
export const LINE080_CODES = ["0690"];
export const LINE090_CODES = ["0310","0710","0720"];
export const LINE100_CODES = ["0810","0820","0830","0840","0850","0860","0870","0890"];
export const LINE110_CODES = ["0910","0920","0930","0940"];
export const LINE120_CODES = ["0950","0960","0990"];
export const LINE150_CODES = ["1010","1020","1030","1040","1050","1060","1070","1080","1090","1110","1120","1510","1610"];
export const LINE160_CODES = ["2010","2110","2310","2510","2610","2710"];
export const LINE170_CODES = ["2810","2820","2830"];
export const LINE180_DEBIT_CODES = ["2910","2920","2930","2940","2950","2960","2970","2990"];
export const LINE180_CREDIT_CODES = ["2980"];
export const LINE190_CODES = ["3110","3120","3190"];
export const LINE200_CODES = ["3210","3220","3290"];
export const LINE220_DEBIT_CODES = ["4010","4020"];
export const LINE220_CREDIT_CODES = ["4910"];
export const LINE230_CODES = ["4110"];
export const LINE240_CODES = ["4120"];
export const LINE250_CODES = ["4210","4220","4230","4290"];
export const LINE260_CODES = ["4310","4320","4330"];
export const LINE270_CODES = ["4410"];
export const LINE280_CODES = ["4510","4520"];
export const LINE290_CODES = ["4610"];
export const LINE300_CODES = ["4710","4720","4730","4790"];
export const LINE310_CODES = ["4810","4820","4830","4840","4850","4860","4890"];

export const BALANCE_NON_CASH_ASSET_CODES = [
  ...LINE010_CODES, ...LINE011_CODES, ...LINE020_CODES, ...LINE021_CODES,
  ...LINE040_CODES, ...LINE050_CODES, ...LINE060_CODES, ...LINE070_CODES, ...LINE080_CODES,
  ...LINE090_CODES, ...LINE100_CODES, ...LINE110_CODES, ...LINE120_CODES,
  ...LINE150_CODES, ...LINE160_CODES, ...LINE170_CODES, ...LINE180_DEBIT_CODES, ...LINE180_CREDIT_CODES,
  ...LINE190_CODES, ...LINE200_CODES,
  ...LINE220_DEBIT_CODES, ...LINE220_CREDIT_CODES, ...LINE230_CODES, ...LINE240_CODES, ...LINE250_CODES,
  ...LINE260_CODES, ...LINE270_CODES, ...LINE280_CODES, ...LINE290_CODES, ...LINE300_CODES, ...LINE310_CODES,
];

// ─── Passive-side line codes (собственный капитал + обязательства, строки 410-760) ──
// Single source of truth for both the Форма №1 passive lines below AND
// balance-sheet-liabilities-completeness.test.ts, which checks that every
// LIABILITY/CONTRA_LIABILITY account in the chart of accounts appears somewhere
// in BALANCE_PASSIVE_CODES — mirrors the BALANCE_NON_CASH_ASSET_CODES pattern above.
export const LINE410_CODES = ["8310","8320","8330"];
export const LINE420_CODES = ["8410","8420"];
export const LINE430_CODES = ["8510","8520","8530"];
export const LINE440_CODES = ["8610","8620"];
export const LINE450_CODES = ["8710","8720"];
export const LINE460_CODES = ["8810","8820","8830","8840","8890"];
export const LINE470_CODES = ["8910"];
export const LINE500_CODES = ["7010","7020"];
export const LINE510_CODES = ["7110"];
export const LINE520_CODES = ["7120"];
export const LINE530_CODES = ["7210","7220","7230"];
export const LINE540_CODES = ["7240"];
export const LINE550_CODES = ["7250","7290"];
export const LINE560_CODES = ["7310"];
export const LINE570_CODES = ["7810"];
export const LINE580_CODES = ["7820","7830","7840"];
export const LINE590_CODES = ["7910","7920"];
export const LINE610_CODES = ["6010","6020"];
export const LINE620_CODES = ["6110"];
export const LINE630_CODES = ["6120"];
export const LINE640_CODES = ["6210","6220","6230"];
export const LINE650_CODES = ["6240"];
export const LINE660_CODES = ["6250","6290"];
export const LINE670_CODES = ["6310","6320","6390"];
export const LINE680_CODES = ["6410"];
export const LINE690_CODES = ["6510"];
export const LINE700_CODES = ["6520","6530"];
export const LINE710_CODES = ["6610","6620","6630"];
export const LINE720_CODES = ["6710","6720"];
export const LINE730_CODES = ["6810"];
export const LINE740_CODES = ["6820","6830","6840"];
export const LINE750_CODES = ["6950"];
export const LINE760_CODES = ["6910","6920","6930","6940","6960","6970","6990"];

export const BALANCE_PASSIVE_CODES = [
  ...LINE410_CODES, ...LINE420_CODES, ...LINE430_CODES, ...LINE440_CODES, ...LINE450_CODES,
  ...LINE460_CODES, ...LINE470_CODES,
  ...LINE500_CODES, ...LINE510_CODES, ...LINE520_CODES, ...LINE530_CODES, ...LINE540_CODES,
  ...LINE550_CODES, ...LINE560_CODES, ...LINE570_CODES, ...LINE580_CODES, ...LINE590_CODES,
  ...LINE610_CODES, ...LINE620_CODES, ...LINE630_CODES, ...LINE640_CODES, ...LINE650_CODES,
  ...LINE660_CODES, ...LINE670_CODES, ...LINE680_CODES, ...LINE690_CODES, ...LINE700_CODES,
  ...LINE710_CODES, ...LINE720_CODES, ...LINE730_CODES, ...LINE740_CODES, ...LINE750_CODES,
  ...LINE760_CODES,
];

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
    const line010 = balDebit(...LINE010_CODES);
    const line011 = balCredit(...LINE011_CODES);
    const line012 = line010.minus(line011);

    const line020 = balDebit(...LINE020_CODES);
    const line021 = balCredit(...LINE021_CODES);
    const line022 = line020.minus(line021);

    const line040 = balDebit(...LINE040_CODES);
    const line050 = balDebit(...LINE050_CODES);
    const line060 = balDebit(...LINE060_CODES);
    const line070 = balDebit(...LINE070_CODES);
    const line080 = balDebit(...LINE080_CODES);
    const line030 = line040.plus(line050).plus(line060).plus(line070).plus(line080);

    // 0310 = капзатраты на арендованное имущество → долгосрочные арендованные активы
    const line090 = balDebit(...LINE090_CODES);
    const line100 = balDebit(...LINE100_CODES);
    const line110 = balDebit(...LINE110_CODES);
    const line120 = balDebit(...LINE120_CODES);

    const line130 = line012.plus(line022).plus(line030).plus(line090)
                          .plus(line100).plus(line110).plus(line120);

    // Раздел II. Текущие активы
    const line150 = balDebit(...LINE150_CODES);
    const line160 = balDebit(...LINE160_CODES);
    const line170 = balDebit(...LINE170_CODES);
    const line180 = balDebit(...LINE180_DEBIT_CODES)
                      .minus(balCredit(...LINE180_CREDIT_CODES));
    const line140 = line150.plus(line160).plus(line170).plus(line180);

    const line190 = balDebit(...LINE190_CODES);
    const line200 = balDebit(...LINE200_CODES);

    const line220 = balDebit(...LINE220_DEBIT_CODES).minus(balCredit(...LINE220_CREDIT_CODES));
    const line230 = balDebit(...LINE230_CODES);
    const line240 = balDebit(...LINE240_CODES);
    const line250 = balDebit(...LINE250_CODES);
    const line260 = balDebit(...LINE260_CODES);
    const line270 = balDebit(...LINE270_CODES);
    const line280 = balDebit(...LINE280_CODES);
    const line290 = balDebit(...LINE290_CODES);
    const line300 = balDebit(...LINE300_CODES);
    const line310 = balDebit(...LINE310_CODES);
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
    const line410 = balCredit(...LINE410_CODES);
    const line420 = balCredit(...LINE420_CODES);
    const line430 = balCredit(...LINE430_CODES);
    const line440 = balDebit(...LINE440_CODES);
    // balNet сохраняет отрицательное значение при дебетовом остатке 8710/8720 (непокрытый убыток)
    // 8720 "Накопленная прибыль (непокрытый убыток)" сейчас не используется ни одним типом документа,
    // но входит в состав того же раздела капитала — включаем на случай будущей реформации/переноса.
    const line450 = balNet(...LINE450_CODES).plus(transitNet);
    const line460 = balCredit(...LINE460_CODES);
    const line470 = balCredit(...LINE470_CODES);
    const line480 = line410.plus(line420).plus(line430).minus(line440)
                          .plus(line450).plus(line460).plus(line470);

    // Раздел II. Обязательства — долгосрочные
    const line500 = balCredit(...LINE500_CODES);
    const line510 = balCredit(...LINE510_CODES);
    const line520 = balCredit(...LINE520_CODES);
    const line530 = balCredit(...LINE530_CODES);
    const line540 = balCredit(...LINE540_CODES);
    const line550 = balCredit(...LINE550_CODES);
    const line560 = balCredit(...LINE560_CODES);
    const line570 = balCredit(...LINE570_CODES);
    const line580 = balCredit(...LINE580_CODES);
    const line590 = balCredit(...LINE590_CODES);
    const line490 = line500.plus(line510).plus(line520).plus(line530).plus(line540)
                          .plus(line550).plus(line560).plus(line570).plus(line580).plus(line590);

    // Текущие обязательства
    const line610 = balCredit(...LINE610_CODES);
    const line620 = balCredit(...LINE620_CODES);
    const line630 = balCredit(...LINE630_CODES);
    const line640 = balCredit(...LINE640_CODES);
    const line650 = balCredit(...LINE650_CODES);
    const line660 = balCredit(...LINE660_CODES);
    const line670 = balCredit(...LINE670_CODES);
    const line680 = balCredit(...LINE680_CODES);
    const line690 = balCredit(...LINE690_CODES);
    const line700 = balCredit(...LINE700_CODES);
    const line710 = balCredit(...LINE710_CODES);
    const line720 = balCredit(...LINE720_CODES);
    const line730 = balCredit(...LINE730_CODES);
    const line740 = balCredit(...LINE740_CODES);
    const line750 = balCredit(...LINE750_CODES);
    const line760 = balCredit(...LINE760_CODES);
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

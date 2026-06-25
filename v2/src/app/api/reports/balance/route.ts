import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getActiveOrgId } from "@/lib/context";
import Decimal from "decimal.js";

// Computes signed net value of an account for balance sheet purposes.
// ASSET/CONTRA_LIABILITY → positive = debit-side asset
// LIABILITY/CONTRA_ASSET → positive = credit-side liability/equity
// ACTIVE_PASSIVE → debit balance → asset; credit balance → equity
function netValue(type: string, rawDebit: Decimal, rawCredit: Decimal): { assetDelta: Decimal; liabDelta: Decimal } {
  const zero = new Decimal(0);
  switch (type) {
    case "ASSET": {
      const net = rawDebit.minus(rawCredit);
      return { assetDelta: net.gte(0) ? net : zero, liabDelta: zero };
    }
    case "CONTRA_ASSET": {
      // Reduces asset value (накопленный износ etc.)
      const net = rawCredit.minus(rawDebit);
      return { assetDelta: net.gte(0) ? net.neg() : zero, liabDelta: zero };
    }
    case "CONTRA_LIABILITY": {
      const net = rawDebit.minus(rawCredit);
      return { assetDelta: zero, liabDelta: net.gte(0) ? net.neg() : zero };
    }
    case "LIABILITY": {
      const net = rawCredit.minus(rawDebit);
      return { assetDelta: zero, liabDelta: net.gte(0) ? net : zero };
    }
    case "ACTIVE_PASSIVE": {
      const net = rawDebit.minus(rawCredit);
      if (net.gte(0)) return { assetDelta: net, liabDelta: zero };
      return { assetDelta: zero, liabDelta: net.abs() };
    }
    default:
      return { assetDelta: zero, liabDelta: zero };
  }
}

type AggRow = { accountId: string; sumDebit: string; sumCredit: string };

export async function GET(req: NextRequest) {
  try {
    const orgId = await getActiveOrgId();
    const { searchParams } = new URL(req.url);

    const toParam = searchParams.get("to");
    const endDate = toParam ? new Date(toParam) : new Date(new Date().getFullYear(), 11, 31, 23, 59, 59);

    const accounts = await prisma.account.findMany({
      where: { type: { in: ["ASSET", "CONTRA_ASSET", "LIABILITY", "CONTRA_LIABILITY", "ACTIVE_PASSIVE"] } },
      orderBy: { code: "asc" }
    });

    const cumulative = await prisma.$queryRaw<AggRow[]>`
      SELECT je."accountId",
             SUM(je.debit)::text  AS "sumDebit",
             SUM(je.credit)::text AS "sumCredit"
      FROM "JournalEntry" je
      JOIN "Document" d ON d.id = je."documentId"
      WHERE d."orgId" = ${orgId}
        AND d.status = 'POSTED'
        AND d.date <= ${endDate}
      GROUP BY je."accountId"
    `;

    // Current financial result = net of ALL TRANSIT accounts (9xxx income/expense).
    // For closed periods this equals the 9910 balance after reformation.
    // For open periods it shows the accumulated interim P&L.
    type TransitNetRow = { netResult: string };
    const transitNetRows = await prisma.$queryRaw<TransitNetRow[]>`
      SELECT (COALESCE(SUM(je.credit), 0) - COALESCE(SUM(je.debit), 0))::text AS "netResult"
      FROM "JournalEntry" je
      JOIN "Document" d ON d.id = je."documentId"
      JOIN "Account"   a ON a.id = je."accountId"
      WHERE d."orgId" = ${orgId}
        AND d.status  = 'POSTED'
        AND d.date   <= ${endDate}
        AND a.type    = 'TRANSIT'
    `;
    const transitNet = new Decimal(transitNetRows[0]?.netResult ?? "0");

    const cumulMap = new Map(cumulative.map((r) => [r.accountId, r]));

    // Balance sheet sections by account code prefix
    const sections = {
      longTermAssets:    { label: "Долгосрочные активы (01–09)",    codes: /^0/, items: [] as any[], total: new Decimal(0) },
      currentAssets:     { label: "Оборотные активы (10–59)",        codes: /^[1-5]/, items: [] as any[], total: new Decimal(0) },
      shortTermLiab:     { label: "Краткосрочные обязательства (60–69)", codes: /^6/, items: [] as any[], total: new Decimal(0) },
      longTermLiab:      { label: "Долгосрочные обязательства (70–79)", codes: /^7/, items: [] as any[], total: new Decimal(0) },
      equity:            { label: "Капитал и резервы (80–89)",       codes: /^8/, items: [] as any[], total: new Decimal(0) },
      currentResult:     { label: "Финансовый результат (9910)",     codes: /^9910$/, items: [] as any[], total: new Decimal(0) }
    };

    let totalAssets = new Decimal(0);
    let totalLiabEquity = new Decimal(0);

    for (const acc of accounts) {
      const row = cumulMap.get(acc.id);
      if (!row) continue;

      const rawD = new Decimal(row.sumDebit);
      const rawC = new Decimal(row.sumCredit);
      const { assetDelta, liabDelta } = netValue(acc.type, rawD, rawC);

      if (assetDelta.isZero() && liabDelta.isZero()) continue;

      const item = {
        code: acc.code,
        name: acc.name,
        type: acc.type,
        assetValue: assetDelta.toNumber(),
        liabValue: liabDelta.toNumber()
      };

      // Route to section
      let placed = false;
      for (const [, sec] of Object.entries(sections)) {
        if (sec.codes.test(acc.code)) {
          sec.items.push(item);
          if (!assetDelta.isZero()) {
            sec.total = sec.total.plus(assetDelta);
            totalAssets = totalAssets.plus(assetDelta);
          } else {
            sec.total = sec.total.plus(liabDelta);
            totalLiabEquity = totalLiabEquity.plus(liabDelta);
          }
          placed = true;
          break;
        }
      }
      if (!placed && !assetDelta.isZero()) totalAssets = totalAssets.plus(assetDelta);
      if (!placed && !liabDelta.isZero()) totalLiabEquity = totalLiabEquity.plus(liabDelta);
    }

    // Inject current-year P&L (net of all TRANSIT 9xxx accounts) into the currentResult equity section.
    // Positive = profit (credit > debit), negative = loss.
    if (!transitNet.isZero()) {
      sections.currentResult.items.push({
        code: "9910",
        name: "Финансовый результат текущего года",
        type: "TRANSIT",
        assetValue: 0,
        liabValue: transitNet.toNumber()
      });
      sections.currentResult.total = sections.currentResult.total.plus(transitNet);
      totalLiabEquity = totalLiabEquity.plus(transitNet);
    }

    const balance = {
      asOf: endDate,
      assets: {
        longTerm:  { label: sections.longTermAssets.label,  items: sections.longTermAssets.items,  total: sections.longTermAssets.total.toNumber() },
        current:   { label: sections.currentAssets.label,   items: sections.currentAssets.items,   total: sections.currentAssets.total.toNumber() },
        total:     totalAssets.toNumber()
      },
      liabilitiesAndEquity: {
        shortTerm:     { label: sections.shortTermLiab.label,  items: sections.shortTermLiab.items,  total: sections.shortTermLiab.total.toNumber() },
        longTerm:      { label: sections.longTermLiab.label,   items: sections.longTermLiab.items,   total: sections.longTermLiab.total.toNumber() },
        equity:        { label: sections.equity.label,         items: sections.equity.items,         total: sections.equity.total.toNumber() },
        currentResult: { label: sections.currentResult.label,  items: sections.currentResult.items,  total: sections.currentResult.total.toNumber() },
        total:     totalLiabEquity.toNumber()
      },
      balanceCheck: totalAssets.minus(totalLiabEquity).abs().lte(1),
      difference:   totalAssets.minus(totalLiabEquity).toNumber()
    };

    return NextResponse.json(balance);
  } catch (err: any) {
    console.error("GET BALANCE ERROR:", err);
    if (err.message === "UNAUTHORIZED" || err.message === "NO_ACTIVE_ORG") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getActiveOrgId } from "@/lib/context";
import prisma from "@/lib/prisma";
import { markRiskyItems } from "@/lib/openItems";
import Decimal from "decimal.js";

/**
 * Retrieves the organization's open items sub-ledger.
 * Automatically marks past-due items as RISK, applies filters, and compiles summary aggregates.
 */
export async function GET(req: NextRequest) {
  try {
    const orgId = await getActiveOrgId();
    
    // 1. Refresh risk statuses in the database
    await markRiskyItems(orgId);

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || "ALL"; // ALL, OPEN, RISK, CLOSED, UNRESOLVED
    const accountCode = searchParams.get("accountCode") || "ALL";
    const periodId = searchParams.get("periodId") || "ALL";
    const search = searchParams.get("search") || "";

    // Build query filters
    const where: any = { orgId };

    if (status === "OPEN") {
      where.status = "OPEN";
    } else if (status === "RISK") {
      where.status = "RISK";
    } else if (status === "CLOSED") {
      where.status = "CLOSED";
    } else if (status === "UNRESOLVED") {
      where.status = { in: ["OPEN", "RISK"] };
    }

    if (accountCode !== "ALL") {
      where.account = { code: accountCode };
    }

    if (periodId !== "ALL") {
      where.affectedPeriodId = periodId;
    }

    // Push search filter to DB on counterparty name/INN
    if (search.trim()) {
      where.OR = [
        { counterparty: { name: { contains: search, mode: "insensitive" } } },
        { counterparty: { inn: { contains: search } } },
      ];
    }

    // Fetch matching open items (no arbitrary take limit — all filtered results returned)
    const items = await prisma.openItem.findMany({
      where,
      include: {
        account: true,
        counterparty: true,
        openingDocument: { include: { type: true } },
        closingDocument: { include: { type: true } }
      },
      orderBy: { dateOpened: "desc" },
    });

    // Compute summaries via aggregates (no row limit)
    const [openAgg, riskAgg, allUnresolvedForGrouping] = await Promise.all([
      prisma.openItem.aggregate({
        where: { orgId, status: "OPEN" },
        _count: true,
        _sum: { amount: true },
      }),
      prisma.openItem.aggregate({
        where: { orgId, status: "RISK" },
        _count: true,
        _sum: { amount: true },
      }),
      prisma.openItem.findMany({
        where: { orgId, status: { in: ["OPEN", "RISK"] } },
        include: { account: true },
      }),
    ]);

    const totalOpen = openAgg._count;
    const totalRisk = riskAgg._count;
    const amountOpen = new Decimal(openAgg._sum.amount?.toString() ?? "0");
    const amountRisk = new Decimal(riskAgg._sum.amount?.toString() ?? "0");

    // Grouping unresolved statistics by buffer account
    const accountsMap = new Map<string, { accountCode: string; name: string; count: number; amount: Decimal }>();
    for (const item of allUnresolvedForGrouping) {
      const accCode = item.account.code;
      const accName = item.account.name;
      const existing = accountsMap.get(accCode);
      if (existing) {
        existing.count += 1;
        existing.amount = existing.amount.plus(new Decimal(item.amount.toString()));
      } else {
        accountsMap.set(accCode, {
          accountCode: accCode,
          name: accName,
          count: 1,
          amount: new Decimal(item.amount.toString())
        });
      }
    }

    const byAccount = Array.from(accountsMap.values()).map(x => ({
      accountCode: x.accountCode,
      name: x.name,
      count: x.count,
      amount: x.amount.toNumber()
    }));

    const filteredItems = items;

    return NextResponse.json({
      items: filteredItems,
      summary: {
        totalOpen,
        totalRisk,
        amountOpen: amountOpen.toNumber(),
        amountRisk: amountRisk.toNumber(),
        byAccount
      }
    });
  } catch (err: any) {
    console.error("GET OPEN ITEMS ERROR:", err);
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}

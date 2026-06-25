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

    // Fetch matching open items
    const items = await prisma.openItem.findMany({
      where,
      include: {
        account: true,
        counterparty: true,
        openingDocument: { include: { type: true } },
        closingDocument: { include: { type: true } }
      },
      orderBy: { dateOpened: "desc" },
      take: 1000
    });

    // Filter in-memory for search query matching counterparty, INN, or description
    let filteredItems = items;
    if (search.trim()) {
      const q = search.toLowerCase();
      filteredItems = items.filter(item => {
        const counterpartyMatch =
          item.counterparty?.name.toLowerCase().includes(q) ||
          item.counterparty?.inn?.includes(q);

        const docPayload = item.openingDocument?.payload as any;
        const descriptionMatch =
          docPayload?.description?.toLowerCase().includes(q) ||
          docPayload?.counterpartyHint?.toLowerCase().includes(q);

        return counterpartyMatch || descriptionMatch;
      });
    }

    // Compute summaries on all unresolved items for this organization
    const allUnresolved = await prisma.openItem.findMany({
      where: {
        orgId,
        status: { in: ["OPEN", "RISK"] }
      },
      include: {
        account: true
      },
      take: 5000
    });

    const totalOpen = allUnresolved.length;
    const totalRisk = allUnresolved.filter(i => i.status === "RISK").length;
    const amountOpen = allUnresolved.reduce((sum, i) => sum.plus(new Decimal(i.amount.toString())), new Decimal(0));
    const amountRisk = allUnresolved.filter(i => i.status === "RISK").reduce((sum, i) => sum.plus(new Decimal(i.amount.toString())), new Decimal(0));

    // Grouping unresolved statistics by buffer account
    const accountsMap = new Map<string, { accountCode: string; name: string; count: number; amount: Decimal }>();
    for (const item of allUnresolved) {
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

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getActiveOrgId } from "@/lib/context";

export async function GET(req: NextRequest) {
  try {
    const orgId = await getActiveOrgId();
    const { searchParams } = new URL(req.url);

    const status = searchParams.get("status") || undefined;
    const periodId = searchParams.get("periodId") || undefined;
    const accountId = searchParams.get("accountId") || undefined;
    const direction = searchParams.get("direction") || undefined;
    const categoryId = searchParams.get("categoryId") || undefined;
    const search = searchParams.get("search") || undefined;

    const page = parseInt(searchParams.get("page") || "1");
    const limit = Math.min(2000, parseInt(searchParams.get("limit") || "50"));

    const where: any = { orgId };

    if (status) {
      if (status === "attention") {
        where.status = "NEEDS_CLARIFICATION";
      } else if (status === "uncategorized") {
        where.status = { in: ["IMPORTED", "NEEDS_CLARIFICATION"] };
      } else if (status.includes(",")) {
        where.status = { in: status.split(",") };
      } else {
        where.status = status;
      }
    }
    if (periodId) where.periodId = periodId;
    if (accountId) where.bankAccountId = accountId;
    if (direction) where.direction = direction;
    if (categoryId) {
      where.document = { typeId: categoryId };
    }
    if (search) {
      where.OR = [
        { description: { contains: search, mode: "insensitive" } },
        { counterpartyHint: { contains: search, mode: "insensitive" } },
        { counterpartyInn: { contains: search, mode: "insensitive" } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.stagedTransaction.findMany({
        where,
        include: {
          bankAccount: { select: { name: true, currency: true } },
          period: { select: { year: true, month: true } },
          document: {
            select: {
              id: true,
              type: { select: { id: true, name: true, code: true } },
              journalEntries: {
                include: {
                  account: { select: { code: true, name: true } },
                },
              },
            },
          },
        },
        orderBy: { date: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.stagedTransaction.count({ where }),
    ]);

    return NextResponse.json({
      items,
      total,
      page,
      pages: Math.ceil(total / limit),
    });
  } catch (err: any) {
    console.error("GET TRANSACTIONS ERROR:", err);
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getActiveOrgId } from "@/lib/context";

export async function GET() {
  try {
    const orgId = await getActiveOrgId();
    const periods = await prisma.period.findMany({
      where: { orgId },
      orderBy: [{ year: "desc" }, { month: "desc" }],
      include: {
        _count: { select: { stagedTransactions: true, documents: true } },
      },
    });
    return NextResponse.json(periods);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 401 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const orgId = await getActiveOrgId();
    const { year, month, mode } = await req.json();

    if (!year || !month) {
      return NextResponse.json({ error: "year и month обязательны" }, { status: 400 });
    }

    const existing = await prisma.period.findFirst({ where: { orgId, year, month } });
    if (existing) return NextResponse.json(existing);

    const period = await prisma.period.create({
      data: { orgId, year, month, mode: mode || "ACTIVE", status: "OPEN" }
    });
    return NextResponse.json(period, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

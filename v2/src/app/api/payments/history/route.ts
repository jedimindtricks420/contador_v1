import { NextResponse } from "next/server";
import { getSession } from "@/lib/context";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getSession();

    const memberships = await prisma.orgMember.findMany({
      where: { userId: session.userId },
      select: { orgId: true },
    });
    const orgIds = memberships.map((m) => m.orgId);

    const payments = await prisma.payment.findMany({
      where: { orgId: { in: orgIds } },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        orgId: true,
        provider: true,
        amount: true,
        status: true,
        daysGranted: true,
        createdAt: true,
        completedAt: true,
      },
    });

    return NextResponse.json(
      payments.map((p) => ({
        ...p,
        amount: p.amount.toString(),
      }))
    );
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("GET /api/payments/history error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

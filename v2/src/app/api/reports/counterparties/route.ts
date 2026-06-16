import { NextRequest, NextResponse } from "next/server";
import { getActiveMembership } from "@/lib/context";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const membership = await getActiveMembership();

    const counterparties = await prisma.counterparty.findMany({
      where: { orgId: membership.orgId },
      orderBy: { name: "asc" }
    });

    return NextResponse.json(counterparties);
  } catch (err: any) {
    console.error("GET COUNTERPARTIES ERROR:", err);
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}

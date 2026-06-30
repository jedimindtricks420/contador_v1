import { NextResponse } from "next/server";
import { getActiveMembership } from "@/lib/context";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const membership = await getActiveMembership();
    const orgId = membership.orgId;

    const members = await prisma.orgMember.findMany({
      where: { orgId },
      include: {
        user: {
          select: { id: true, email: true, name: true },
        },
      },
      orderBy: { role: "asc" },
    });

    return NextResponse.json(members);
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED" || err.message === "NO_ACTIVE_ORG" || err.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

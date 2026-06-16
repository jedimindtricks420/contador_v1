import { NextResponse } from "next/server";
import { getSession } from "@/lib/context";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getSession();

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      include: {
        memberships: {
          include: { org: true },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const activeMembership = user.memberships.find(
      (m) => m.orgId === session.activeOrgId
    );

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      organization: activeMembership?.org || null,
      role: activeMembership?.role || null,
      memberships: user.memberships.map((m) => ({
        orgId: m.orgId,
        orgName: m.org.name,
        role: m.role,
      })),
    });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getActiveMembership, getActiveOrgId } from "@/lib/context";
import prisma from "@/lib/prisma";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const orgId = await getActiveOrgId();
    const membership = await getActiveMembership();

    if (membership.role !== "OWNER" && membership.role !== "ADMIN") {
      return NextResponse.json({ error: "Only admins can remove members" }, { status: 403 });
    }

    const resolvedParams = await params;
    const { userId } = resolvedParams;

    if (userId === membership.userId) {
      return NextResponse.json({ error: "Cannot remove yourself" }, { status: 400 });
    }

    const memberToRemove = await prisma.orgMember.findUnique({
      where: { userId_orgId: { userId, orgId } },
    });

    if (!memberToRemove) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    if (memberToRemove.role === "OWNER") {
      const ownersCount = await prisma.orgMember.count({
        where: { orgId, role: "OWNER" },
      });
      if (ownersCount <= 1) {
        return NextResponse.json({ error: "Cannot remove the last owner" }, { status: 400 });
      }
    }

    await prisma.orgMember.delete({
      where: { id: memberToRemove.id },
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED" || err.message === "NO_ACTIVE_ORG" || err.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

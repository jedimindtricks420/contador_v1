import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/context";
import prisma from "@/lib/prisma";
import { createSession, COOKIE_NAME } from "@/lib/auth";

export async function PATCH(req: NextRequest) {
  try {
    const session = await getSession();
    const { orgId } = await req.json();

    if (!orgId) {
      return NextResponse.json({ error: "orgId is required" }, { status: 400 });
    }

    // Check if user is a member of this org
    const member = await prisma.orgMember.findUnique({
      where: { userId_orgId: { userId: session.userId, orgId } },
    });

    if (!member) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Update activeOrgId in db
    await prisma.user.update({
      where: { id: session.userId },
      data: { activeOrgId: orgId },
    });

    // Re-issue JWT
    const token = await createSession({
      userId: session.userId,
      email: session.email,
      activeOrgId: orgId,
    });

    const res = NextResponse.json({ activeOrgId: orgId });
    res.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });
    return res;
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

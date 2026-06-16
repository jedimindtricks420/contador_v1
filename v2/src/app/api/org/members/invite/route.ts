import { NextRequest, NextResponse } from "next/server";
import { getActiveMembership, getActiveOrgId } from "@/lib/context";
import prisma from "@/lib/prisma";
import { hash } from "bcryptjs";

export async function POST(req: NextRequest) {
  try {
    const orgId = await getActiveOrgId();
    const membership = await getActiveMembership();

    if (membership.role !== "OWNER" && membership.role !== "ADMIN") {
      return NextResponse.json({ error: "Only admins can invite members" }, { status: 403 });
    }

    const { email, role } = await req.json();
    if (!email || !role) {
      return NextResponse.json({ error: "Email and role are required" }, { status: 400 });
    }

    const validRoles = ["ACCOUNTANT", "ADMIN"];
    if (!validRoles.includes(role)) {
      return NextResponse.json({ error: "Недопустимая роль. Допустимые значения: ACCOUNTANT, ADMIN" }, { status: 400 });
    }

    let user = await prisma.user.findUnique({ where: { email } });
    let passwordPlain = null;

    if (!user) {
      // Mock email invite: create user with random password
      passwordPlain = Math.random().toString(36).slice(-8);
      const passwordHash = await hash(passwordPlain, 12);
      user = await prisma.user.create({
        data: { email, passwordHash, name: email.split("@")[0] },
      });
    }

    const existingMember = await prisma.orgMember.findUnique({
      where: { userId_orgId: { userId: user.id, orgId } },
    });

    if (existingMember) {
      return NextResponse.json({ error: "User is already a member" }, { status: 409 });
    }

    const newMember = await prisma.orgMember.create({
      data: { userId: user.id, orgId, role: role as any },
      include: {
        user: {
          select: { id: true, email: true, name: true },
        },
      },
    });

    const emailEnabled = !!process.env.SMTP_HOST || !!process.env.SENDGRID_API_KEY;
    return NextResponse.json({
      member: newMember,
      // Only expose plaintext password in dev/mock mode (no email configured)
      mockInvitePassword: emailEnabled ? null : passwordPlain,
    });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED" || err.message === "NO_ACTIVE_ORG" || err.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

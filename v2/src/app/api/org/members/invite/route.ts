import { NextRequest, NextResponse } from "next/server";
import { getActiveMembership, getActiveOrgId } from "@/lib/context";
import prisma from "@/lib/prisma";
import { hash } from "bcryptjs";
import crypto from "crypto";
import { sendInviteEmail } from "@/lib/mailer";

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
    let passwordPlain: string | null = null;
    let isNewUser = false;

    if (!user) {
      passwordPlain = crypto.randomBytes(8).toString("hex"); // 16 hex chars, 64 bits entropy
      const passwordHash = await hash(passwordPlain, 12);
      user = await prisma.user.create({
        data: { email, passwordHash, name: email.split("@")[0] },
      });
      isNewUser = true;
    }

    const existingMember = await prisma.orgMember.findUnique({
      where: { userId_orgId: { userId: user.id, orgId } },
    });

    if (existingMember) {
      return NextResponse.json({ error: "User is already a member" }, { status: 409 });
    }

    const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { name: true } });
    const orgName = org?.name ?? "Contador";

    const newMember = await prisma.orgMember.create({
      data: { userId: user.id, orgId, role: role as any },
      include: {
        user: {
          select: { id: true, email: true, name: true },
        },
      },
    });

    // Send invite email if SMTP configured and this is a new user with a temp password
    if (isNewUser && passwordPlain) {
      const sent = await sendInviteEmail(email, orgName, passwordPlain).catch(() => false);
      if (!sent) {
        // SMTP failed or not configured — log password server-side only
        console.log(`[invite] SMTP not configured. Temp password for ${email} (server-only):`, passwordPlain);
      }
    }

    const emailEnabled = !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
    return NextResponse.json({
      member: newMember,
      // Only expose plaintext password when SMTP is not configured (dev mode)
      mockInvitePassword: emailEnabled ? null : passwordPlain,
    });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED" || err.message === "NO_ACTIVE_ORG" || err.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

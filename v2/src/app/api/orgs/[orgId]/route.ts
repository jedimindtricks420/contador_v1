import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/context";
import { createSession, COOKIE_NAME } from "@/lib/auth";
import { SESSION_MAX_AGE_SECONDS } from "@/lib/constants";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const session = await getSession();
    const { orgId } = await params;

    // Verify user is OWNER of this org
    const membership = await prisma.orgMember.findUnique({
      where: { userId_orgId: { userId: session.userId, orgId } },
    });
    if (!membership) {
      return NextResponse.json({ error: "Организация не найдена" }, { status: 404 });
    }
    if (membership.role !== "OWNER") {
      return NextResponse.json({ error: "Только владелец может удалить организацию" }, { status: 403 });
    }

    // Ensure the user has at least one other org
    const allMemberships = await prisma.orgMember.findMany({
      where: { userId: session.userId },
      select: { orgId: true },
    });
    if (allMemberships.length <= 1) {
      return NextResponse.json(
        { error: "Нельзя удалить единственную организацию" },
        { status: 400 }
      );
    }

    // FK-safe deletion order (mirrors admin server DELETE /v2/orgs/:orgId)
    await prisma.stagedTransaction.deleteMany({ where: { orgId } });
    await prisma.openItem.deleteMany({ where: { orgId } });
    await prisma.document.deleteMany({ where: { orgId } });
    await prisma.period.deleteMany({ where: { orgId } });
    await prisma.bankAccount.deleteMany({ where: { orgId } });
    await prisma.counterparty.deleteMany({ where: { orgId } });
    await prisma.rule.deleteMany({ where: { orgId } });
    // organization.delete cascades: OrgMember, AuditLog, Subscription, Payment, TaxCalendarEvent, TaxDeadlineTemplate
    await prisma.organization.delete({ where: { id: orgId } });

    // If deleting the active org, switch to another one
    if (session.activeOrgId === orgId) {
      const other = allMemberships.find((m) => m.orgId !== orgId);
      const newActiveOrgId = other?.orgId ?? null;

      if (newActiveOrgId) {
        await prisma.user.update({
          where: { id: session.userId },
          data: { activeOrgId: newActiveOrgId },
        });
      }

      const token = await createSession({
        userId: session.userId,
        email: session.email,
        activeOrgId: newActiveOrgId,
      });

      const res = NextResponse.json({ ok: true, newActiveOrgId });
      res.cookies.set(COOKIE_NAME, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: SESSION_MAX_AGE_SECONDS,
        path: "/",
      });
      return res;
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

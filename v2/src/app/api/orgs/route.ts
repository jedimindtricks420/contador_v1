import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/context";
import { createSession, COOKIE_NAME } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    const { name, inn } = await req.json();

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Укажите название организации" }, { status: 400 });
    }

    // Find all orgs the user belongs to
    const memberships = await prisma.orgMember.findMany({
      where: { userId: session.userId },
      select: { orgId: true },
    });

    // If user already has orgs, require active PRO on at least one of them
    const now = new Date();
    let proSubscription: { validUntil: Date | null } | null = null;
    if (memberships.length > 0) {
      const orgIds = memberships.map((m) => m.orgId);
      const hasActivePro = await prisma.subscription.findFirst({
        where: {
          orgId: { in: orgIds },
          plan: "PRO",
          validUntil: { gt: now },
        },
        orderBy: { validUntil: "desc" },
      });
      if (!hasActivePro) {
        return NextResponse.json(
          { error: "Создание дополнительных организаций доступно только на тарифе PRO" },
          { status: 403 }
        );
      }
      proSubscription = hasActivePro;
    }
    const newOrg = await prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: { name: name.trim(), inn: inn?.trim() || null },
      });
      await tx.orgMember.create({
        data: { userId: session.userId, orgId: org.id, role: "OWNER" },
      });
      await tx.period.create({
        data: {
          orgId: org.id,
          year: now.getFullYear(),
          month: now.getMonth() + 1,
          mode: "ACTIVE",
          status: "OPEN",
        },
      });
      await tx.subscription.create({
        data: {
          orgId: org.id,
          plan: proSubscription ? "PRO" : "FREE",
          validUntil: proSubscription?.validUntil ?? null,
        },
      });
      await tx.user.update({
        where: { id: session.userId },
        data: { activeOrgId: org.id },
      });
      return org;
    });

    // Re-issue JWT with new activeOrgId
    const token = await createSession({
      userId: session.userId,
      email: session.email,
      activeOrgId: newOrg.id,
    });

    const res = NextResponse.json({ ok: true, org: newOrg });
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
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

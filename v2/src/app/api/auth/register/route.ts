import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import prisma from "@/lib/prisma";
import { createSession, COOKIE_NAME } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const { email, password, name, orgName, inn } = await req.json();

    if (!email || !password || !orgName) {
      return NextResponse.json({ error: "email, password, orgName обязательны" }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "Email уже используется" }, { status: 409 });
    }

    const passwordHash = await hash(password, 12);

    const user = await prisma.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: { email, passwordHash, name: name || null },
      });

      const org = await tx.organization.create({
        data: { name: orgName, inn: inn || null },
      });

      await tx.orgMember.create({
        data: { userId: u.id, orgId: org.id, role: "OWNER" },
      });

      await tx.user.update({
        where: { id: u.id },
        data: { activeOrgId: org.id },
      });

      // Создаём текущий период
      const now = new Date();
      await tx.period.create({
        data: {
          orgId: org.id,
          year: now.getFullYear(),
          month: now.getMonth() + 1,
          mode: "ACTIVE",
          status: "OPEN",
        },
      });

      // Бесплатная подписка
      await tx.subscription.create({
        data: { orgId: org.id, plan: "FREE" },
      });

      return { user: u, org };
    });

    const token = await createSession({
      userId: user.user.id,
      email: user.user.email,
      activeOrgId: user.org.id,
    });

    const res = NextResponse.json({ ok: true }, { status: 201 });
    res.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });
    return res;
  } catch (err: any) {
    console.error("REGISTER ERROR:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { compare } from "bcryptjs";
import prisma from "@/lib/prisma";
import { createSession, COOKIE_NAME } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Введите email и пароль" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: { memberships: { include: { org: true }, take: 1 } },
    });

    if (!user || !(await compare(password, user.passwordHash))) {
      return NextResponse.json({ error: "Неверный email или пароль" }, { status: 401 });
    }

    const activeOrgId = user.activeOrgId ?? user.memberships[0]?.orgId ?? null;

    const token = await createSession({ userId: user.id, email: user.email, activeOrgId });

    const res = NextResponse.json({ ok: true });
    res.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });
    return res;
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

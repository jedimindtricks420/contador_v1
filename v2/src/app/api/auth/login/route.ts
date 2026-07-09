import { NextRequest, NextResponse } from "next/server";
import { compare } from "bcryptjs";
import prisma from "@/lib/prisma";
import { createSession, COOKIE_NAME } from "@/lib/auth";
import { SESSION_MAX_AGE_SECONDS } from "@/lib/constants";

export async function POST(req: NextRequest) {
  try {
    const { email: rawEmail, password } = await req.json();

    if (!rawEmail || !password) {
      return NextResponse.json({ error: "Введите email и пароль" }, { status: 400 });
    }

    const email = rawEmail.toLowerCase().trim();

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
      maxAge: SESSION_MAX_AGE_SECONDS,
      path: "/",
    });
    return res;
  } catch (err: any) {
    console.error("LOGIN ERROR:", err);
    return NextResponse.json({ error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}

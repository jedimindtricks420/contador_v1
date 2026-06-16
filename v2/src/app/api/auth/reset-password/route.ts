import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { hash } from "bcryptjs";

export async function POST(req: NextRequest) {
  try {
    const { token, password } = await req.json();

    if (!token || typeof token !== "string") {
      return NextResponse.json({ error: "Токен обязателен" }, { status: 400 });
    }
    if (!password || typeof password !== "string" || password.length < 8) {
      return NextResponse.json(
        { error: "Пароль должен содержать не менее 8 символов" },
        { status: 400 }
      );
    }

    const record = await prisma.passwordResetToken.findUnique({ where: { token } });

    if (!record) {
      return NextResponse.json({ error: "Ссылка недействительна" }, { status: 400 });
    }
    if (record.usedAt) {
      return NextResponse.json({ error: "Ссылка уже использована" }, { status: 400 });
    }
    if (record.expiresAt < new Date()) {
      return NextResponse.json({ error: "Ссылка истекла. Запросите новую." }, { status: 400 });
    }

    const passwordHash = await hash(password, 12);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash },
      }),
      prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
    ]);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("RESET PASSWORD ERROR:", err);
    return NextResponse.json({ error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}

// GET — validate token without consuming it (used by the reset-password page on load)
export async function GET(req: NextRequest) {
  const token = new URL(req.url).searchParams.get("token");
  if (!token) {
    return NextResponse.json({ valid: false, error: "Токен не передан" });
  }

  const record = await prisma.passwordResetToken.findUnique({ where: { token } });

  if (!record || record.usedAt || record.expiresAt < new Date()) {
    return NextResponse.json({ valid: false, error: "Ссылка недействительна или истекла" });
  }

  return NextResponse.json({ valid: true });
}

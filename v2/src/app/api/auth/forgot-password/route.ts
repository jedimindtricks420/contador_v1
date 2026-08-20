import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sendPasswordResetEmail } from "@/lib/mailer";
import crypto from "crypto";

const TOKEN_TTL_HOURS = 1;

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email обязателен" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });

    // Always return success to prevent user enumeration
    if (!user) {
      return NextResponse.json({ success: true });
    }

    // Invalidate any existing unused tokens
    await prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + TOKEN_TTL_HOURS * 60 * 60 * 1000);

    await prisma.passwordResetToken.create({
      data: { userId: user.id, token, expiresAt },
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://contador.uz";
    const resetUrl = `${appUrl}/v2/reset-password?token=${token}`;

    const mailSent = await sendPasswordResetEmail(user.email, resetUrl, TOKEN_TTL_HOURS);

    if (!mailSent) {
      // SMTP не настроен — НЕ логируем токен/ссылку даже на сервер: лог-агрегаторы,
      // выгрузки логов и т.п. могут сделать одноразовый токен сброса пароля доступным
      // третьим лицам, что равносильно захвату любого аккаунта. Логируем только сам
      // факт сбоя отправки, без секрета — восстановление пароля для этого пользователя
      // не сработает, пока SMTP не будет настроен корректно (это должно быть заметно
      // по общей ошибке isMailConfigured()/sendPasswordResetEmail в мониторинге, а не
      // через plaintext-токен в логах).
      console.error(`[forgot-password] SMTP не настроен — письмо со сбросом пароля не отправлено (userId=${user.id})`);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("FORGOT PASSWORD ERROR:", err);
    return NextResponse.json({ error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}

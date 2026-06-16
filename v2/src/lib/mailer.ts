import nodemailer from "nodemailer";

function createTransport() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || "587");
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || user;

  if (!host || !user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<boolean> {
  const transport = createTransport();
  if (!transport) return false;

  const from = process.env.SMTP_FROM || process.env.SMTP_USER;

  await transport.sendMail({
    from: `"Contador" <${from}>`,
    to,
    subject: "Сброс пароля — Contador",
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:sans-serif;background:#f9fafb;padding:40px 0;margin:0">
  <div style="max-width:480px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;padding:40px">
    <h1 style="font-size:18px;font-weight:800;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 8px">
      Contador
    </h1>
    <p style="font-size:11px;color:#9ca3af;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;margin:0 0 32px">
      Сброс пароля
    </p>

    <p style="font-size:14px;color:#374151;line-height:1.6;margin:0 0 24px">
      Мы получили запрос на сброс пароля для вашей учётной записи.
      Нажмите кнопку ниже, чтобы создать новый пароль.
    </p>

    <a href="${resetUrl}"
       style="display:block;text-align:center;background:#000;color:#fff;padding:14px 24px;text-decoration:none;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 24px">
      Сбросить пароль
    </a>

    <p style="font-size:12px;color:#9ca3af;line-height:1.5;margin:0 0 8px">
      Ссылка действительна в течение <strong>1 часа</strong>.
      Если вы не запрашивали сброс пароля — проигнорируйте это письмо.
    </p>

    <hr style="border:none;border-top:1px solid #f3f4f6;margin:24px 0">

    <p style="font-size:11px;color:#d1d5db;margin:0">
      Если кнопка не работает, скопируйте ссылку в браузер:<br>
      <span style="color:#6b7280;word-break:break-all">${resetUrl}</span>
    </p>
  </div>
</body>
</html>`,
    text: `Сброс пароля Contador\n\nПерейдите по ссылке для создания нового пароля:\n${resetUrl}\n\nСсылка действительна 1 час.`,
  });

  return true;
}

export function isMailConfigured(): boolean {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

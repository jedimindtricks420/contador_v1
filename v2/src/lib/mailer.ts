import nodemailer from "nodemailer";

// Russian plural forms for "час" (1 час, 2-4 часа, 5+ часов, with the 11-14 exception).
function formatHoursRu(n: number): string {
  const mod100 = n % 100;
  const mod10 = n % 10;
  if (mod100 >= 11 && mod100 <= 14) return `${n} часов`;
  if (mod10 === 1) return `${n} час`;
  if (mod10 >= 2 && mod10 <= 4) return `${n} часа`;
  return `${n} часов`;
}

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

export async function sendPasswordResetEmail(to: string, resetUrl: string, ttlHours: number): Promise<boolean> {
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
      Ссылка действительна в течение <strong>${formatHoursRu(ttlHours)}</strong>.
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
    text: `Сброс пароля Contador\n\nПерейдите по ссылке для создания нового пароля:\n${resetUrl}\n\nСсылка действительна ${formatHoursRu(ttlHours)}.`,
  });

  return true;
}

export async function sendInviteEmail(
  to: string,
  orgName: string,
  tempPassword: string
): Promise<boolean> {
  const transport = createTransport();
  if (!transport) return false;

  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://contador.uz";
  const loginUrl = `${appUrl}/v2/login`;

  await transport.sendMail({
    from: `"Contador" <${from}>`,
    to,
    subject: `Вас пригласили в ${orgName} — Contador`,
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
      Приглашение в организацию
    </p>

    <p style="font-size:14px;color:#374151;line-height:1.6;margin:0 0 16px">
      Вас добавили в организацию <strong>${orgName}</strong>.
      Войдите в систему, используя эти данные:
    </p>

    <div style="background:#f9fafb;border:1px solid #e5e7eb;padding:16px;margin:0 0 24px">
      <p style="margin:0 0 8px;font-size:13px;color:#6b7280">Email</p>
      <p style="margin:0 0 16px;font-size:14px;font-weight:600;color:#111827">${to}</p>
      <p style="margin:0 0 8px;font-size:13px;color:#6b7280">Временный пароль</p>
      <p style="margin:0;font-size:14px;font-weight:600;color:#111827;font-family:monospace">${tempPassword}</p>
    </div>

    <a href="${loginUrl}"
       style="display:block;text-align:center;background:#000;color:#fff;padding:14px 24px;text-decoration:none;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 24px">
      Войти в Contador
    </a>

    <p style="font-size:12px;color:#9ca3af;line-height:1.5;margin:0">
      Рекомендуем сменить пароль сразу после входа.
    </p>
  </div>
</body>
</html>`,
    text: `Вас пригласили в ${orgName} — Contador\n\nEmail: ${to}\nВременный пароль: ${tempPassword}\n\nВойдите: ${loginUrl}\n\nРекомендуем сменить пароль сразу после входа.`,
  });

  return true;
}

export function isMailConfigured(): boolean {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

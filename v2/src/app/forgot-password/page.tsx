"use client";
import { useState } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [devUrl, setDevUrl] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    try {
      const res = await fetch("/v2/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus("error");
        return;
      }
      if (data.devResetUrl) setDevUrl(data.devResetUrl);
      setStatus("done");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="border border-gray-200 p-10 w-[380px] shadow-sm">
        <div className="mb-8">
          <h1 className="text-xl font-bold text-gray-900 uppercase tracking-tight">Contador</h1>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">
            Сброс пароля
          </p>
        </div>

        {status === "done" ? (
          <div className="space-y-4">
            <div className="border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700 leading-relaxed">
              Если аккаунт с адресом <strong>{email}</strong> существует — письмо со ссылкой для
              сброса пароля уже отправлено. Проверьте почту, включая папку «Спам».
            </div>
            {devUrl && (
              <div className="border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800 leading-relaxed break-all">
                <p className="font-bold mb-1">DEV: Email не настроен. Ссылка для сброса:</p>
                <Link href={devUrl} className="underline">{devUrl}</Link>
              </div>
            )}
            <Link
              href="/login"
              className="block text-center text-xs text-gray-400 hover:text-black transition-colors mt-2"
            >
              ← Вернуться ко входу
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-sm text-gray-500 leading-relaxed">
              Введите email вашей учётной записи. Мы пришлём ссылку для создания нового пароля.
            </p>

            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@company.com"
                className="w-full px-3 py-2 border border-gray-200 text-sm text-gray-900 bg-white outline-none focus:border-black transition-colors"
              />
            </div>

            {status === "error" && (
              <div className="border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                Произошла ошибка. Попробуйте ещё раз.
              </div>
            )}

            <button
              type="submit"
              disabled={status === "loading"}
              className="w-full bg-black text-white py-2.5 text-sm font-medium hover:opacity-80 disabled:opacity-50 transition-opacity"
            >
              {status === "loading" ? "Отправка..." : "Отправить ссылку"}
            </button>

            <p className="text-center text-xs text-gray-400">
              <Link href="/login" className="hover:text-black transition-colors">
                ← Вернуться ко входу
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}

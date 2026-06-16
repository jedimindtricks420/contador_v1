"use client";
import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token") ?? "";

  const [tokenValid, setTokenValid] = useState<boolean | null>(null);
  const [tokenError, setTokenError] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!token) {
      setTokenValid(false);
      setTokenError("Токен не найден в ссылке.");
      return;
    }
    fetch(`/v2/api/auth/reset-password?token=${token}`)
      .then((r) => r.json())
      .then((d) => {
        setTokenValid(d.valid);
        if (!d.valid) setTokenError(d.error || "Ссылка недействительна.");
      })
      .catch(() => {
        setTokenValid(false);
        setTokenError("Ошибка проверки ссылки.");
      });
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg("");

    if (password.length < 8) {
      setErrorMsg("Пароль должен содержать не менее 8 символов.");
      return;
    }
    if (password !== confirm) {
      setErrorMsg("Пароли не совпадают.");
      return;
    }

    setStatus("loading");
    try {
      const res = await fetch("/v2/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || "Ошибка сброса пароля.");
        setStatus("error");
        return;
      }
      setStatus("done");
      setTimeout(() => router.push("/login"), 2500);
    } catch {
      setErrorMsg("Ошибка сети. Попробуйте ещё раз.");
      setStatus("error");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="border border-gray-200 p-10 w-[380px] shadow-sm">
        <div className="mb-8">
          <h1 className="text-xl font-bold text-gray-900 uppercase tracking-tight">Contador</h1>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">
            Новый пароль
          </p>
        </div>

        {tokenValid === null && (
          <p className="text-sm text-gray-400">Проверка ссылки...</p>
        )}

        {tokenValid === false && (
          <div className="space-y-4">
            <div className="border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
              {tokenError}
            </div>
            <Link
              href="/forgot-password"
              className="block text-center text-sm text-black font-medium hover:opacity-70 transition-opacity"
            >
              Запросить новую ссылку
            </Link>
          </div>
        )}

        {tokenValid === true && status === "done" && (
          <div className="space-y-4">
            <div className="border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
              Пароль успешно изменён. Перенаправление на страницу входа...
            </div>
          </div>
        )}

        {tokenValid === true && status !== "done" && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">
                Новый пароль
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                placeholder="Минимум 8 символов"
                className="w-full px-3 py-2 border border-gray-200 text-sm text-gray-900 bg-white outline-none focus:border-black transition-colors"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">
                Повторите пароль
              </label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full px-3 py-2 border border-gray-200 text-sm text-gray-900 bg-white outline-none focus:border-black transition-colors"
              />
            </div>

            {errorMsg && (
              <div className="border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                {errorMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={status === "loading"}
              className="w-full bg-black text-white py-2.5 text-sm font-medium hover:opacity-80 disabled:opacity-50 transition-opacity"
            >
              {status === "loading" ? "Сохранение..." : "Сохранить пароль"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-white">
        <p className="text-sm text-gray-400">Загрузка...</p>
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}

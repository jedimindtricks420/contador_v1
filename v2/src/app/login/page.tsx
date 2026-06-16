"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/v2/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Ошибка входа");
      } else {
        router.push("/dashboard");
        router.refresh();
      }
    } catch {
      setError("Ошибка сети");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="border border-gray-200 p-10 w-[380px] shadow-sm">
        <div className="mb-8">
          <h1 className="text-xl font-bold text-gray-900 uppercase tracking-tight">Contador</h1>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Войдите в аккаунт</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
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

          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">
              Пароль
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              className="w-full px-3 py-2 border border-gray-200 text-sm text-gray-900 bg-white outline-none focus:border-black transition-colors"
            />
          </div>

          {error && (
            <div className="border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-black text-white py-2.5 text-sm font-medium hover:opacity-80 disabled:opacity-50 transition-opacity"
          >
            {loading ? "Вход..." : "Войти"}
          </button>

          <div className="text-center">
            <Link
              href="/forgot-password"
              className="text-xs text-gray-400 hover:text-black transition-colors"
            >
              Забыли пароль?
            </Link>
          </div>
        </form>

        <p className="mt-6 text-center text-xs text-gray-400">
          Нет аккаунта?{" "}
          <Link href="/register" className="text-black font-medium hover:underline">
            Зарегистрироваться
          </Link>
        </p>
      </div>
    </div>
  );
}

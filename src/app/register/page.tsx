"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ArrowRight, UserPlus } from "lucide-react";
import Link from "next/link";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка регистрации");

      router.push("/onboarding/step-1");
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-[400px] space-y-8">
        <header className="text-center space-y-2">
          <div className="w-12 h-12 bg-black rounded-lg mx-auto flex items-center justify-center text-white mb-6">
            <UserPlus size={26} strokeWidth={1.5} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-black uppercase">Регистрация</h1>
          <p className="text-sm text-gray-500 font-medium">Создайте аккаунт для входа в систему</p>
        </header>

        <form onSubmit={handleRegister} className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">
                Ваше имя (необязательно)
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded text-sm outline-none focus:ring-1 focus:ring-black placeholder:text-gray-300 transition-all font-medium"
                placeholder="Иван Иванов"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 border border-gray-200 rounded text-sm outline-none focus:ring-1 focus:ring-black placeholder:text-gray-300 transition-all font-medium"
                placeholder="you@company.com"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">
                Пароль (минимум 8 символов)
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                className="w-full px-4 py-3 border border-gray-200 rounded text-sm outline-none focus:ring-1 focus:ring-black placeholder:text-gray-300 transition-all font-medium"
                placeholder="••••••••"
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-100 p-3 rounded text-red-600 text-[10px] font-bold uppercase tracking-widest">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-black text-white py-3 rounded text-sm font-bold flex items-center justify-center space-x-2 hover:bg-gray-900 disabled:bg-gray-300 transition-all"
          >
            {loading ? <Loader2 className="animate-spin" size={18} /> : (
              <>
                <span>Создать аккаунт</span>
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        <footer className="text-center text-[10px] text-gray-400 uppercase tracking-widest pt-4">
          Уже есть аккаунт?{" "}
          <Link href="/login" className="text-black font-bold hover:underline">
            Войти
          </Link>
        </footer>
      </div>
    </div>
  );
}

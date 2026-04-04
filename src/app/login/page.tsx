"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ArrowRight, ShieldCheck } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка входа");

      router.push("/");
      router.refresh();
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-[400px] space-y-8">
        <header className="text-center space-y-2">
          <img 
            src="/contador text logo.svg" 
            alt="Contador" 
            className="h-12 w-auto mx-auto mb-8"
          />
        </header>

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">
                Идентификатор (Email / Логин)
              </label>
              <input 
                type="text" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 border border-gray-200 rounded text-sm outline-none focus:ring-1 focus:ring-black placeholder:text-gray-300 transition-all font-medium"
                placeholder="admin"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">
                Пароль
              </label>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
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
                <span>Войти в систему</span>
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        <footer className="text-center text-[10px] text-gray-400 uppercase tracking-widest pt-4">
          © 2026 Secured Accounting Core v2 · Multi-Org Edition
        </footer>
      </div>
    </div>
  );
}

"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "", name: "", orgName: "", inn: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/v2/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Ошибка регистрации");
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
      <div className="border border-gray-200 p-10 w-[420px] shadow-sm">
        <div className="mb-8">
          <h1 className="text-xl font-bold text-gray-900 uppercase tracking-tight">Contador</h1>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Создать аккаунт</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {[
            { label: "Email *", field: "email", type: "email", placeholder: "you@company.com" },
            { label: "Пароль *", field: "password", type: "password", placeholder: "минимум 8 символов" },
            { label: "Ваше имя", field: "name", type: "text", placeholder: "Иван Иванов" },
            { label: "Название компании *", field: "orgName", type: "text", placeholder: "ООО «Ромашка»" },
            { label: "ИНН компании", field: "inn", type: "text", placeholder: "123456789" },
          ].map(({ label, field, type, placeholder }) => (
            <div key={field}>
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">
                {label}
              </label>
              <input
                type={type}
                value={(form as any)[field]}
                onChange={(e) => set(field, e.target.value)}
                required={label.endsWith("*")}
                placeholder={placeholder}
                className="w-full px-3 py-2 border border-gray-200 text-sm text-gray-900 bg-white outline-none focus:border-black transition-colors"
              />
            </div>
          ))}

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
            {loading ? "Создаём..." : "Создать аккаунт"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-gray-400">
          Уже есть аккаунт?{" "}
          <Link href="/login" className="text-black font-medium hover:underline">
            Войти
          </Link>
        </p>
      </div>
    </div>
  );
}

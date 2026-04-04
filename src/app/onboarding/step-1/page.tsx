"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ArrowRight, Building2 } from "lucide-react";

export default function OnboardingStep1() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [inn, setInn] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/onboarding/org", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, inn }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка");

      router.push("/onboarding/step-2");
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-[480px] space-y-8">
        {/* Progress */}
        <div className="flex items-center space-x-2">
          <div className="flex-1 h-1 bg-black rounded-full" />
          <div className="flex-1 h-1 bg-gray-200 rounded-full" />
          <div className="flex-1 h-1 bg-gray-200 rounded-full" />
        </div>

        <header className="space-y-2">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-black rounded-lg flex items-center justify-center text-white">
              <Building2 size={22} strokeWidth={1.5} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Шаг 1 из 3</p>
              <h1 className="text-xl font-bold text-gray-900">Создание организации</h1>
            </div>
          </div>
          <p className="text-sm text-gray-500 leading-relaxed pl-13">
            Введите реквизиты вашей компании. Их можно изменить позже в настройках.
          </p>
        </header>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">
                Название организации *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoFocus
                className="w-full px-4 py-3 border border-gray-200 rounded text-sm outline-none focus:ring-1 focus:ring-black placeholder:text-gray-300 transition-all font-medium"
                placeholder="ООО «Ромашка»"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">
                ИНН (необязательно)
              </label>
              <input
                type="text"
                value={inn}
                onChange={(e) => setInn(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded text-sm outline-none focus:ring-1 focus:ring-black placeholder:text-gray-300 transition-all font-medium"
                placeholder="123456789"
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-100 p-4 rounded text-red-600 text-[11px] font-bold leading-normal">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !name.trim()}
            className="w-full bg-black text-white py-3 rounded text-sm font-bold flex items-center justify-center space-x-2 hover:bg-gray-900 disabled:bg-gray-200 disabled:text-gray-400 transition-all"
          >
            {loading ? <Loader2 className="animate-spin" size={18} /> : (
              <>
                <span>Далее</span>
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, LayoutGrid, Database, Sparkles } from "lucide-react";

export default function OnboardingStep2() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleFullPlan = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/onboarding/apply-template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "full" }),
      });
      if (!res.ok) throw new Error("Ошибка");
      router.push("/journal");
      router.refresh();
    } catch {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-[640px] space-y-8">
        {/* Progress */}
        <div className="flex items-center space-x-2">
          <div className="flex-1 h-1 bg-black rounded-full" />
          <div className="flex-1 h-1 bg-black rounded-full" />
          <div className="flex-1 h-1 bg-gray-200 rounded-full" />
        </div>

        <header className="space-y-2">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Шаг 2 из 3</p>
          <h1 className="text-2xl font-bold text-gray-900">Выберите способ настройки</h1>
          <p className="text-sm text-gray-500">
            Как хотите сформировать рабочий план счетов?
          </p>
        </header>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {/* Card 1: Template */}
          <button
            onClick={() => router.push("/onboarding/step-3?mode=template")}
            className="group text-left p-6 border-2 border-gray-200 rounded-xl hover:border-black transition-all space-y-4"
          >
            <div className="w-10 h-10 bg-gray-100 group-hover:bg-black rounded-lg flex items-center justify-center transition-colors">
              <LayoutGrid size={20} className="text-gray-500 group-hover:text-white transition-colors" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">По отраслевому шаблону</p>
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                Выберите готовый набор счетов для вашей отрасли из 22 вариантов
              </p>
            </div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Рекомендуется ↗</p>
          </button>

          {/* Card 2: Full plan */}
          <button
            onClick={handleFullPlan}
            disabled={loading}
            className="group text-left p-6 border-2 border-gray-200 rounded-xl hover:border-black transition-all space-y-4 disabled:opacity-50"
          >
            <div className="w-10 h-10 bg-gray-100 group-hover:bg-black rounded-lg flex items-center justify-center transition-colors">
              {loading
                ? <Loader2 size={20} className="text-gray-500 animate-spin" />
                : <Database size={20} className="text-gray-500 group-hover:text-white transition-colors" />
              }
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">Полный план счетов</p>
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                Все ~340 счетов НСБУ №21 добавятся автоматически
              </p>
            </div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Для опытных ↗</p>
          </button>

          {/* Card 3: AI (stub) */}
          <button
            onClick={() => router.push("/onboarding/step-3?mode=ai")}
            className="group text-left p-6 border-2 border-gray-200 rounded-xl hover:border-black transition-all space-y-4"
          >
            <div className="w-10 h-10 bg-gray-100 group-hover:bg-black rounded-lg flex items-center justify-center transition-colors">
              <Sparkles size={20} className="text-gray-500 group-hover:text-white transition-colors" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">Подбор с AI</p>
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                Опишите бизнес — AI подберёт оптимальные счета
              </p>
            </div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Скоро ↗</p>
          </button>
        </div>
      </div>
    </div>
  );
}

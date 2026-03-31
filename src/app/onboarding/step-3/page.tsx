"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useState, Suspense } from "react";
import { Loader2, ArrowRight, ArrowLeft, LayoutGrid, Sparkles } from "lucide-react";

function Step3Content() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mode = searchParams.get("mode") || "template";

  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const { data: templates, isLoading } = useQuery({
    queryKey: ["templates"],
    queryFn: () => fetch("/api/templates").then((r) => r.json()),
    enabled: mode === "template",
  });

  const handleApply = async () => {
    if (!selectedKey) return;
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/onboarding/apply-template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template_key: selectedKey }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка");

      router.push("/journal");
      router.refresh();
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  // AI stub mode
  if (mode === "ai") {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-[480px] space-y-8">
          <div className="flex items-center space-x-2">
            <div className="flex-1 h-1 bg-black rounded-full" />
            <div className="flex-1 h-1 bg-black rounded-full" />
            <div className="flex-1 h-1 bg-black rounded-full" />
          </div>

          <div className="text-center space-y-4">
            <div className="w-14 h-14 bg-black rounded-2xl mx-auto flex items-center justify-center">
              <Sparkles size={28} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">AI-подбор</h1>
            <p className="text-sm text-gray-500 leading-relaxed max-w-sm mx-auto">
              Функция AI-подбора счетов будет доступна в следующем обновлении.<br />
              Пока вы можете выбрать шаблон вручную.
            </p>
          </div>

          <button
            onClick={() => router.push("/onboarding/step-3?mode=template")}
            className="w-full bg-black text-white py-3 rounded text-sm font-bold flex items-center justify-center space-x-2 hover:bg-gray-900 transition-all"
          >
            <LayoutGrid size={18} />
            <span>Выбрать шаблон вручную</span>
          </button>

          <button
            onClick={() => router.push("/onboarding/step-2")}
            className="w-full text-center text-xs text-gray-400 hover:text-black flex items-center justify-center space-x-1"
          >
            <ArrowLeft size={14} />
            <span>Назад</span>
          </button>
        </div>
      </div>
    );
  }

  // Template selection mode
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-4 py-12">
      <div className="w-full max-w-[860px] space-y-8">
        {/* Progress */}
        <div className="flex items-center space-x-2">
          <div className="flex-1 h-1 bg-black rounded-full" />
          <div className="flex-1 h-1 bg-black rounded-full" />
          <div className="flex-1 h-1 bg-black rounded-full" />
        </div>

        <header className="space-y-2">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Шаг 3 из 3</p>
          <h1 className="text-2xl font-bold text-gray-900">Выберите отрасль</h1>
          <p className="text-sm text-gray-500">
            Система создаст оптимальный план счетов для вашего бизнеса
          </p>
        </header>

        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 size={24} className="animate-spin text-gray-400" />
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {templates?.map((tmpl: any) => (
              <button
                key={tmpl.key}
                onClick={() => setSelectedKey(tmpl.key)}
                className={`text-left p-4 border-2 rounded-xl transition-all space-y-1
                  ${selectedKey === tmpl.key
                    ? 'border-black bg-black text-white'
                    : 'border-gray-200 hover:border-gray-400 text-gray-900'
                  }`}
              >
                <p className={`text-sm font-bold ${selectedKey === tmpl.key ? 'text-white' : 'text-gray-900'}`}>
                  {tmpl.name}
                </p>
                <p className={`text-xs leading-relaxed ${selectedKey === tmpl.key ? 'text-gray-300' : 'text-gray-500'}`}>
                  {tmpl.description}
                </p>
              </button>
            ))}
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-100 p-3 rounded text-red-600 text-[10px] font-bold uppercase tracking-widest">
            {error}
          </div>
        )}

        <div className="flex items-center space-x-4">
          <button
            onClick={() => router.push("/onboarding/step-2")}
            className="flex items-center space-x-1 text-xs text-gray-400 hover:text-black transition-colors"
          >
            <ArrowLeft size={14} />
            <span>Назад</span>
          </button>

          <button
            onClick={handleApply}
            disabled={!selectedKey || loading}
            className="flex-1 bg-black text-white py-3 rounded text-sm font-bold flex items-center justify-center space-x-2 hover:bg-gray-900 disabled:bg-gray-200 disabled:text-gray-400 transition-all"
          >
            {loading ? <Loader2 className="animate-spin" size={18} /> : (
              <>
                <span>Применить шаблон</span>
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function OnboardingStep3() {
  return (
    <Suspense>
      <Step3Content />
    </Suspense>
  );
}

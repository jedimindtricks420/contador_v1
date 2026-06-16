"use client";
import { useEffect, useState } from "react";
import { formatSum } from "@/lib/format";
import { Info } from "lucide-react";

interface Step5FxDiffProps {
  periodId: string;
  onNext: (payload: any) => void;
  onPrev: () => void;
  initialFxDiff: {
    exchangeRate: number;
    difference: number;
  };
}

export default function Step5FxDiff({ periodId, onNext, onPrev, initialFxDiff }: Step5FxDiffProps) {
  const [usdAccounts, setUsdAccounts] = useState<any[]>([]);
  const [exchangeRate, setExchangeRate] = useState(String(initialFxDiff.exchangeRate || ""));
  const [difference, setDifference] = useState(String(initialFxDiff.difference || 0));
  const [prevRate, setPrevRate] = useState(0);
  const [rateLoading, setRateLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [noUsdAccounts, setNoUsdAccounts] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [accRes, rateRes] = await Promise.all([
          fetch("/v2/api/bank-accounts"),
          fetch("/v2/api/cbu-rate")
        ]);
        const list = await accRes.json();
        const usdOnly = list.filter((acc: any) => acc.currency === "USD");
        setUsdAccounts(usdOnly);

        if (usdOnly.length === 0) {
          setNoUsdAccounts(true);
          return;
        }

        if (rateRes.ok) {
          const rateData = await rateRes.json();
          if (rateData.rate && !initialFxDiff.exchangeRate) {
            setExchangeRate(String(rateData.rate));
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [periodId]);

  // Handle rate change and estimate difference against previous rate
  const handleRateChange = (rateStr: string) => {
    setExchangeRate(rateStr);
    if (prevRate > 0) {
      const rate = parseFloat(rateStr) || 0;
      const totalUSD = usdAccounts.reduce((sum, acc) => sum + (parseFloat(acc.lastBalance) || 0), 0);
      const estimatedDiff = totalUSD * (rate - prevRate);
      setDifference(String(Math.round(estimatedDiff)));
    }
  };

  const handleSubmit = async () => {
    const rate = parseFloat(exchangeRate) || 0;
    if (rate <= 0) {
      setValidationError("Курс ЦБ должен быть больше нуля. Введите официальный курс на последний день периода.");
      return;
    }
    setValidationError(null);
    setSaveError(null);
    setSaving(true);
    try {
      const payload = { exchangeRate: rate, difference: parseFloat(difference) || 0 };

      const res = await fetch(`/v2/api/closing/${periodId}/step/5/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        onNext({ fxDiff: payload });
      } else {
        const err = await res.json();
        setSaveError(`Ошибка сохранения: ${err.error}`);
      }
    } catch (err) {
      setSaveError("Ошибка сети. Попробуйте снова.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-6 text-gray-500 font-medium">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-300 mr-2"></div>
        Проверка валютных счетов...
      </div>
    );
  }

  if (noUsdAccounts) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-base font-bold text-gray-800">Шаг 5. Курсовые разницы</h2>
          <p className="text-xs text-gray-400 mt-1">Переоценка валютных счетов на конец периода.</p>
        </div>
        <div className="flex items-start gap-3 p-4 bg-gray-50 border border-gray-200 rounded text-xs text-gray-600">
          <Info size={14} className="shrink-0 mt-0.5 text-gray-400" />
          <div>
            <p className="font-bold text-gray-700 mb-1">Валютных счетов не найдено</p>
            <p>В вашей организации нет банковских счетов в иностранной валюте (USD/EUR). Расчёт курсовых разниц не требуется — этот шаг будет пропущен.</p>
          </div>
        </div>
        <div className="flex justify-between items-center pt-4 border-t border-gray-100">
          <button onClick={onPrev} className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold py-2 px-5 rounded transition">
            ← Назад
          </button>
          <button
            onClick={() => onNext({ fxDiff: { exchangeRate: 0, difference: 0 } })}
            className="text-xs bg-black hover:opacity-80 text-white font-bold py-2 px-6 rounded transition"
          >
            Продолжить →
          </button>
        </div>
      </div>
    );
  }

  const totalUSD = usdAccounts.reduce((sum, acc) => sum + (parseFloat(acc.lastBalance) || 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-bold text-gray-800">Шаг 5. Расчет курсовых разниц</h2>
        <p className="text-xs text-gray-400 mt-1">
          Найдены валютные счета. Введите официальный курс ЦБ Республики Узбекистан на последний день отчётного периода, чтобы рассчитать курсовую разницу.
        </p>
      </div>

      <div className="space-y-4 max-w-xl bg-gray-50/20 border border-gray-200 rounded p-5">
        <div className="space-y-2">
          <label className="block text-xs font-bold text-gray-500">Валютные остатки:</label>
          <div className="divide-y divide-gray-100">
            {usdAccounts.map((acc) => (
              <div key={acc.id} className="py-2.5 flex justify-between text-xs font-semibold">
                <span className="text-gray-600">{acc.name} ({acc.bankName})</span>
                <span className="text-gray-800 font-bold">{new Intl.NumberFormat("en-US").format(acc.lastBalance)} USD</span>
              </div>
            ))}
            <div className="py-2.5 flex justify-between text-xs font-bold border-t border-gray-200 pt-2 text-gray-800">
              <span>Итого валютных средств</span>
              <span>{new Intl.NumberFormat("en-US").format(totalUSD)} USD</span>
            </div>
          </div>
        </div>

        <hr className="border-gray-150" />

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1">Курс ЦБ на конец месяца *</label>
            <input
              type="number"
              value={exchangeRate}
              onChange={(e) => handleRateChange(e.target.value)}
              className="w-full bg-white border border-gray-200 rounded px-3 py-2 text-sm text-gray-700 font-bold focus:border-black"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1">Курсовая разница (сум) *</label>
            <input
              type="number"
              value={difference}
              onChange={(e) => setDifference(e.target.value)}
              className="w-full bg-white border border-gray-200 rounded px-3 py-2 text-sm text-gray-700 font-bold focus:border-black"
            />
          </div>
        </div>

        <div className="text-[10px] text-gray-400 font-semibold bg-gray-50 p-2.5 rounded border border-gray-100">
          Курс загружен с сайта ЦБ РУз автоматически. Положительное значение курсовой разницы создаст доходную проводку (Дт 5210 — Кт 9030), отрицательное — расходную (Дт 9430 — Кт 5210).
        </div>

        {validationError && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800 font-semibold">
            {validationError}
          </div>
        )}
        {saveError && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded text-xs text-rose-800 font-semibold">
            {saveError}
          </div>
        )}
      </div>

      {/* Nav Buttons */}
      <div className="flex justify-between items-center pt-4 border-t border-gray-100">
        <button
          onClick={onPrev}
          disabled={saving}
          className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold py-2 px-5 rounded transition"
        >
          ← Назад
        </button>
        <button
          onClick={handleSubmit}
          disabled={saving}
          className="text-xs bg-black hover:opacity-80 text-white font-bold py-2 px-6 rounded transition"
        >
          {saving ? "Сохранение..." : "Сохранить и продолжить →"}
        </button>
      </div>
    </div>
  );
}

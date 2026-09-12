"use client";
import { useEffect, useRef, useState } from "react";
import { Info, RefreshCw } from "lucide-react";
import { closingFxSchema } from "@/lib/closingInput";

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
  return <FxDiffPeriod key={periodId} periodId={periodId} onNext={onNext} onPrev={onPrev} initialFxDiff={initialFxDiff} />;
}

function FxDiffPeriod({ periodId, onNext, onPrev, initialFxDiff }: Step5FxDiffProps) {
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);
  const [usdAccounts, setUsdAccounts] = useState<any[]>([]);
  const [exchangeRate, setExchangeRate] = useState(String(initialFxDiff.exchangeRate || ""));
  const [difference, setDifference] = useState(String(initialFxDiff.difference || 0));
  const [prevRate] = useState(initialFxDiff.exchangeRate || 0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [noUsdAccounts, setNoUsdAccounts] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [unsupportedCurrencies, setUnsupportedCurrencies] = useState<string[]>([]);
  const [retryAttempt, setRetryAttempt] = useState(0);
  const [initialRate] = useState(initialFxDiff.exchangeRate);

  useEffect(() => {
    const controller = new AbortController();
    const loadData = async () => {
      try {
        const accRes = await fetch("/v2/api/bank-accounts", { signal: controller.signal });
        const list = await accRes.json();
        if (!accRes.ok || !Array.isArray(list) || list.some(acc =>
          !acc || typeof acc.currency !== "string" || !/^[A-Z]{3}$/.test(acc.currency))) {
          throw new Error("Не удалось проверить валюты банковских счетов.");
        }
        if (controller.signal.aborted) return;
        const unsupported = Array.from(new Set<string>(list.map(acc => acc.currency)))
          .filter(currency => currency !== "UZS" && currency !== "USD");
        setUnsupportedCurrencies(unsupported);
        if (unsupported.length > 0) return;
        const usdOnly = list.filter((acc: any) => acc.currency === "USD");
        setUsdAccounts(usdOnly);

        if (usdOnly.length === 0) {
          setNoUsdAccounts(true);
          return;
        }

        const rateRes = await fetch("/v2/api/cbu-rate", { signal: controller.signal });
        if (rateRes.ok && !controller.signal.aborted) {
          const rateData = await rateRes.json();
          if (!controller.signal.aborted && rateData.rate && !initialRate) {
            setExchangeRate(String(rateData.rate));
          }
        }
      } catch (err) {
        if (!controller.signal.aborted) setLoadError(err instanceof Error ? err.message : "Не удалось проверить валютные счета.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    void loadData();
    return () => controller.abort();
  }, [initialRate, retryAttempt]);

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
    if (saving || loading || loadError || unsupportedCurrencies.length > 0) return;
    const payload = noUsdAccounts ? { exchangeRate: "0", difference: "0" } : { exchangeRate, difference };
    const parsed = closingFxSchema.safeParse(payload);
    if (!parsed.success) {
      setValidationError(parsed.error.issues[0].message);
      return;
    }
    if (!noUsdAccounts && parsed.data.exchangeRate <= 0) {
      setValidationError("Курс ЦБ должен быть больше нуля. Введите официальный курс на последний день периода.");
      return;
    }
    setValidationError(null);
    setSaveError(null);
    setSaving(true);
    try {
      const res = await fetch(`/v2/api/closing/${periodId}/step/5/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!active.current) return;
      if (res.ok) {
        onNext({ fxDiff: parsed.data });
      } else {
        const err = await res.json();
        if (active.current) setSaveError(`Ошибка сохранения: ${err.error}`);
      }
    } catch {
      if (active.current) setSaveError("Ошибка сети. Попробуйте снова.");
    } finally {
      if (active.current) setSaving(false);
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

  if (loadError || unsupportedCurrencies.length > 0) {
    return (
      <div className="space-y-6">
        <h2 className="text-base font-bold text-gray-800">Шаг 5. Курсовые разницы</h2>
        <div role="alert" className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded text-xs text-amber-900">
          <Info size={16} className="shrink-0" />
          <p className="min-w-0 break-words flex-1">{loadError ||
            `Обнаружены счета в валюте ${unsupportedCurrencies.join(", ")}. Переоценка этих валют пока не поддерживается. Сохранение нулевой разницы и продолжение закрытия заблокированы.`}</p>
          <button
            type="button"
            title="Повторить проверку валютных счетов"
            aria-label="Повторить проверку валютных счетов"
            className="h-8 w-8 shrink-0 flex items-center justify-center border border-amber-300 rounded"
            onClick={() => {
              setLoadError(null);
              setUnsupportedCurrencies([]);
              setNoUsdAccounts(false);
              setLoading(true);
              setRetryAttempt(attempt => attempt + 1);
            }}
          >
            <RefreshCw size={16} />
          </button>
        </div>
        <button onClick={onPrev} className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold py-2 px-5 rounded transition">
          ← Назад
        </button>
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
            <p className="font-bold text-gray-700 mb-1">Валютных банковских счетов не найдено</p>
            <p>Курсовая разница по банковским счетам: 0. Валютная задолженность этим шагом не проверяется.</p>
          </div>
        </div>
        {saveError && <p role="alert" className="text-xs text-rose-800">{saveError}</p>}
        <div className="flex justify-between items-center pt-4 border-t border-gray-100">
          <button onClick={onPrev} disabled={saving} className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold py-2 px-5 rounded transition">
            ← Назад
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="text-xs bg-black hover:opacity-80 text-white font-bold py-2 px-6 rounded transition"
          >
            {saving ? "Сохранение..." : "Продолжить →"}
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
          Курс загружен с сайта ЦБ РУз автоматически. Положительное значение курсовой разницы создаст доходную проводку (Дт 5210 — Кт 9540), отрицательное — расходную (Дт 9620 — Кт 5210).
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

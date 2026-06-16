"use client";
import { useState } from "react";
import { formatSum } from "@/lib/format";
import { TAX_RATES } from "@/lib/constants";
import { RotateCcw, CheckCircle2, AlertTriangle, X } from "lucide-react";

interface Step4AccrualsProps {
  periodId: string;
  onNext: (payload: any) => void;
  onPrev: () => void;
  initialAccruals: {
    salaryAmount: number;
    depreciationAmount: number;
    rentAmount: number;
  };
}

export default function Step4Accruals({ periodId, onNext, onPrev, initialAccruals }: Step4AccrualsProps) {
  const [salaryAmount, setSalaryAmount] = useState(String(initialAccruals.salaryAmount || 0));
  const [depreciationAmount, setDepreciationAmount] = useState(String(initialAccruals.depreciationAmount || 0));
  const [rentAmount, setRentAmount] = useState(String(initialAccruals.rentAmount || 0));
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const hasSavedData =
    (initialAccruals.salaryAmount || 0) > 0 ||
    (initialAccruals.depreciationAmount || 0) > 0 ||
    (initialAccruals.rentAmount || 0) > 0;

  // Live calculations
  const salVal = parseFloat(salaryAmount) || 0;
  const pitVal = salVal * TAX_RATES.NDFL;
  const socVal = salVal * TAX_RATES.SOCIAL_TAX;

  const handleReset = async () => {
    setShowResetConfirm(false);
    setResetting(true);
    setResetError(null);
    try {
      const res = await fetch(`/v2/api/closing/${periodId}/accruals`, { method: "DELETE" });
      if (res.ok) {
        setSalaryAmount("0");
        setDepreciationAmount("0");
        setRentAmount("0");
      } else {
        const err = await res.json();
        setResetError(`Ошибка сброса: ${err.error}`);
      }
    } catch {
      setResetError("Ошибка сети. Попробуйте снова.");
    } finally {
      setResetting(false);
    }
  };

  const handleSubmit = async () => {
    const sal = parseFloat(salaryAmount) || 0;
    const dep = parseFloat(depreciationAmount) || 0;
    const ren = parseFloat(rentAmount) || 0;
    if (sal < 0 || dep < 0 || ren < 0) {
      setSaveError("Суммы начислений не могут быть отрицательными");
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const payload = { salaryAmount: sal, depreciationAmount: dep, rentAmount: ren };

      const res = await fetch(`/v2/api/closing/${periodId}/step/4/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        onNext({ accruals: payload });
      } else {
        const err = await res.json();
        setSaveError(`Ошибка сохранения: ${err.error}`);
      }
    } catch {
      setSaveError("Ошибка сети. Попробуйте снова.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-bold text-gray-800">Шаг 4. Начисления периода</h2>
        <p className="text-xs text-gray-400 mt-1">
          Введите неденежные начисления периода или те расходы, которые не отражены в банковской выписке (напр. начисление ФОТ, износ основных средств).
        </p>
      </div>

      {hasSavedData && (
        <div className="flex items-center justify-between max-w-xl p-3 bg-green-50 border border-green-200 rounded text-xs">
          <div className="flex items-center gap-2 text-green-800 font-semibold">
            <CheckCircle2 size={14} className="shrink-0" />
            Начисления сохранены из предыдущего сеанса
          </div>
          <button
            onClick={() => setShowResetConfirm(true)}
            disabled={resetting}
            className="flex items-center gap-1 text-gray-500 hover:text-red-600 border border-gray-200 hover:border-red-300 bg-white py-1 px-2.5 rounded font-semibold transition ml-4 shrink-0 disabled:opacity-50"
          >
            <RotateCcw size={12} />
            {resetting ? "Сброс..." : "Сбросить"}
          </button>
        </div>
      )}

      {resetError && (
        <div className="flex items-center justify-between max-w-xl p-3 bg-rose-50 border border-rose-200 rounded text-xs text-rose-800 font-semibold">
          <span>{resetError}</span>
          <button onClick={() => setResetError(null)} className="ml-3 text-rose-600 hover:text-rose-800"><X size={14} /></button>
        </div>
      )}

      <div className="space-y-4 max-w-xl bg-gray-50/20 border border-gray-200 rounded p-5">
        {/* Salary */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1">Начисленный ФОТ (Зарплата)</label>
            <input
              type="number"
              min="0"
              value={salaryAmount}
              onChange={(e) => setSalaryAmount(e.target.value)}
              className="w-full bg-white border border-gray-200 rounded px-3 py-2 text-sm text-gray-700 font-semibold"
            />
          </div>
          <div className="space-y-1 bg-gray-50 p-2.5 rounded border border-gray-100 text-[11px] font-semibold text-gray-500">
            <div className="flex justify-between">
              <span>НДФЛ ({TAX_RATES.NDFL * 100}%):</span>
              <span className="font-bold text-gray-750">{formatSum(pitVal)}</span>
            </div>
            <div className="flex justify-between">
              <span>Соц. налог ({TAX_RATES.SOCIAL_TAX * 100}%):</span>
              <span className="font-bold text-gray-750">{formatSum(socVal)}</span>
            </div>
          </div>
        </div>

        <hr className="border-gray-150" />

        {/* Depreciation */}
        <div>
          <label className="block text-xs font-bold text-gray-500 mb-1">Амортизация основных средств за период</label>
          <input
            type="number"
            min="0"
            value={depreciationAmount}
            onChange={(e) => setDepreciationAmount(e.target.value)}
            className="w-full bg-white border border-gray-200 rounded px-3 py-2 text-sm text-gray-700 font-semibold"
          />
        </div>

        <hr className="border-gray-150" />

        {/* Rent */}
        <div>
          <label className="block text-xs font-bold text-gray-500 mb-1">Расходы на аренду (если не в выписке / взаимозачет)</label>
          <input
            type="number"
            min="0"
            value={rentAmount}
            onChange={(e) => setRentAmount(e.target.value)}
            className="w-full bg-white border border-gray-200 rounded px-3 py-2 text-sm text-gray-700 font-semibold"
          />
        </div>
      </div>

      {saveError && (
        <div className="flex items-center justify-between max-w-xl p-3 bg-rose-50 border border-rose-200 rounded text-xs text-rose-800 font-semibold">
          <span>{saveError}</span>
          <button onClick={() => setSaveError(null)} className="ml-3 text-rose-600 hover:text-rose-800"><X size={14} /></button>
        </div>
      )}

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

    {/* M-08: Reset confirm modal */}
    {showResetConfirm && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div className="bg-white rounded border border-gray-200 shadow-xl max-w-sm w-full p-6 space-y-4">
          <div className="flex items-start gap-2">
            <AlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" />
            <h3 className="text-sm font-bold text-gray-900">Сбросить начисления?</h3>
          </div>
          <p className="text-xs text-gray-600">Все введённые суммы (зарплата, амортизация, аренда) будут обнулены. Это действие можно отменить, повторно введя данные.</p>
          <div className="flex gap-3 pt-1">
            <button
              onClick={() => setShowResetConfirm(false)}
              className="flex-1 text-xs border border-gray-200 text-gray-700 font-bold py-2.5 rounded hover:bg-gray-50 transition"
            >
              Отмена
            </button>
            <button
              onClick={handleReset}
              className="flex-1 text-xs bg-rose-600 hover:bg-rose-700 text-white font-bold py-2.5 rounded transition"
            >
              Сбросить
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}

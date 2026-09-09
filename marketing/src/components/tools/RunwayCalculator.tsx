"use client";

import { useState, type FormEvent } from "react";
import { calculateRunway, MAX_SUPPORTED_VALUE, type RunwayResult } from "@/lib/runway";
import { trackEvent } from "@/lib/analytics";
import type { Locale } from "@/lib/manifest";

const T = {
  ru: {
    cashLabel: "Доступные деньги",
    incomeLabel: "Среднемесячные поступления",
    outflowLabel: "Среднемесячные выплаты",
    calculate: "Рассчитать",
    netOutflow: "Чистый отток в месяц",
    months: "Запас в месяцах",
    monthsUnit: "мес.",
    notShrinking:
      "В этой модели запас не сокращается при заданных поступлениях и выплатах.",
    errors: {
      CASH_INVALID: "Введите число",
      CASH_NEGATIVE: "Доступные деньги не могут быть отрицательными",
      CASH_TOO_LARGE: `Слишком большое значение (максимум ${MAX_SUPPORTED_VALUE.toLocaleString("ru-RU")})`,
      INCOME_INVALID: "Введите число",
      INCOME_NEGATIVE: "Поступления не могут быть отрицательными",
      INCOME_TOO_LARGE: `Слишком большое значение (максимум ${MAX_SUPPORTED_VALUE.toLocaleString("ru-RU")})`,
      OUTFLOW_INVALID: "Введите число",
      OUTFLOW_NEGATIVE: "Выплаты не могут быть отрицательными",
      OUTFLOW_TOO_LARGE: `Слишком большое значение (максимум ${MAX_SUPPORTED_VALUE.toLocaleString("ru-RU")})`,
    },
    copyResult: "Скопировать результат",
    copied: "Скопировано",
    unit: "сум",
  },
  uz: {
    cashLabel: "Mavjud pul",
    incomeLabel: "O‘rtacha oylik tushum",
    outflowLabel: "O‘rtacha oylik chiqim",
    calculate: "Hisoblash",
    netOutflow: "Oylik sof chiqim",
    months: "Zaxira, oyda",
    monthsUnit: "oy",
    notShrinking:
      "Ushbu modelda berilgan tushum va chiqimlarda zaxira kamaymaydi.",
    errors: {
      CASH_INVALID: "Raqam kiriting",
      CASH_NEGATIVE: "Mavjud pul manfiy bo‘lishi mumkin emas",
      CASH_TOO_LARGE: `Qiymat juda katta (maksimum ${MAX_SUPPORTED_VALUE.toLocaleString("ru-RU")})`,
      INCOME_INVALID: "Raqam kiriting",
      INCOME_NEGATIVE: "Tushum manfiy bo‘lishi mumkin emas",
      INCOME_TOO_LARGE: `Qiymat juda katta (maksimum ${MAX_SUPPORTED_VALUE.toLocaleString("ru-RU")})`,
      OUTFLOW_INVALID: "Raqam kiriting",
      OUTFLOW_NEGATIVE: "Chiqim manfiy bo‘lishi mumkin emas",
      OUTFLOW_TOO_LARGE: `Qiymat juda katta (maksimum ${MAX_SUPPORTED_VALUE.toLocaleString("ru-RU")})`,
    },
    copyResult: "Natijani nusxalash",
    copied: "Nusxalandi",
    unit: "so‘m",
  },
} as const;

function normalizeNumberInput(raw: string): number {
  const cleaned = raw.trim().replace(/\s/g, "").replace(",", ".");
  if (cleaned === "") return NaN;
  return Number(cleaned);
}

function formatNumber(value: string, locale: Locale): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return value;
  return n.toLocaleString(locale === "ru" ? "ru-RU" : "uz-UZ", { maximumFractionDigits: 2 });
}

export function RunwayCalculator({ locale, topicId }: { locale: Locale; topicId: string }) {
  const t = T[locale];
  const [cashInput, setCashInput] = useState("30000000");
  const [incomeInput, setIncomeInput] = useState("8000000");
  const [outflowInput, setOutflowInput] = useState("13000000");
  const [result, setResult] = useState<RunwayResult | null>(null);
  const [copied, setCopied] = useState(false);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const cash = normalizeNumberInput(cashInput);
    const income = normalizeNumberInput(incomeInput);
    const outflow = normalizeNumberInput(outflowInput);
    const r = calculateRunway({ cash, income, outflow });
    setResult(r);
    setCopied(false);
    if (r.ok) {
      trackEvent("tool_calculation_success", { tool_id: topicId, locale });
    }
  }

  async function handleCopyResult() {
    if (!result || !result.ok) return;
    const lines =
      locale === "ru"
        ? [
            `Калькулятор запаса денежных средств — Contador`,
            `Доступные деньги: ${formatNumber(cashInput, locale)} ${t.unit}`,
            `Среднемесячные поступления: ${formatNumber(incomeInput, locale)} ${t.unit}`,
            `Среднемесячные выплаты: ${formatNumber(outflowInput, locale)} ${t.unit}`,
            `Чистый отток в месяц: ${formatNumber(result.netOutflow, locale)} ${t.unit}`,
            result.shrinking
              ? `Запас: ${formatNumber(result.months!, locale)} ${t.monthsUnit}`
              : t.notShrinking,
          ]
        : [
            `Pul zaxirasi kalkulyatori — Contador`,
            `Mavjud pul: ${formatNumber(cashInput, locale)} ${t.unit}`,
            `O‘rtacha oylik tushum: ${formatNumber(incomeInput, locale)} ${t.unit}`,
            `O‘rtacha oylik chiqim: ${formatNumber(outflowInput, locale)} ${t.unit}`,
            `Oylik sof chiqim: ${formatNumber(result.netOutflow, locale)} ${t.unit}`,
            result.shrinking
              ? `Zaxira: ${formatNumber(result.months!, locale)} ${t.monthsUnit}`
              : t.notShrinking,
          ];
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Буфер обмена недоступен — не критично, значения остаются на экране.
    }
  }

  const fieldError = (field: "cash" | "income" | "outflow") =>
    result && !result.ok && result.field === field ? t.errors[result.code] : undefined;

  return (
    <div className="rounded border border-gray-200 p-6">
      <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-3" noValidate>
        <div>
          <label htmlFor="cash" className="block text-sm font-medium text-black">
            {t.cashLabel}
          </label>
          <input
            id="cash"
            name="cash"
            type="text"
            inputMode="decimal"
            value={cashInput}
            onChange={(e) => setCashInput(e.target.value)}
            aria-invalid={Boolean(fieldError("cash"))}
            aria-describedby={fieldError("cash") ? "cash-error" : undefined}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none focus-visible:ring-2 focus-visible:ring-black"
          />
          {fieldError("cash") && (
            <p id="cash-error" className="mt-1 text-xs text-red-600">
              {fieldError("cash")}
            </p>
          )}
        </div>
        <div>
          <label htmlFor="income" className="block text-sm font-medium text-black">
            {t.incomeLabel}
          </label>
          <input
            id="income"
            name="income"
            type="text"
            inputMode="decimal"
            value={incomeInput}
            onChange={(e) => setIncomeInput(e.target.value)}
            aria-invalid={Boolean(fieldError("income"))}
            aria-describedby={fieldError("income") ? "income-error" : undefined}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none focus-visible:ring-2 focus-visible:ring-black"
          />
          {fieldError("income") && (
            <p id="income-error" className="mt-1 text-xs text-red-600">
              {fieldError("income")}
            </p>
          )}
        </div>
        <div>
          <label htmlFor="outflow" className="block text-sm font-medium text-black">
            {t.outflowLabel}
          </label>
          <input
            id="outflow"
            name="outflow"
            type="text"
            inputMode="decimal"
            value={outflowInput}
            onChange={(e) => setOutflowInput(e.target.value)}
            aria-invalid={Boolean(fieldError("outflow"))}
            aria-describedby={fieldError("outflow") ? "outflow-error" : undefined}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none focus-visible:ring-2 focus-visible:ring-black"
          />
          {fieldError("outflow") && (
            <p id="outflow-error" className="mt-1 text-xs text-red-600">
              {fieldError("outflow")}
            </p>
          )}
        </div>
        <div className="sm:col-span-3">
          <button type="submit" className="btn-black">
            {t.calculate}
          </button>
        </div>
      </form>

      {result && result.ok && (
        <div className="mt-6 border-t border-gray-200 pt-6">
          {!result.shrinking ? (
            <p className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              {t.notShrinking}
            </p>
          ) : (
            <dl className="grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs uppercase tracking-wide text-gray-500">{t.netOutflow}</dt>
                <dd className="mt-1 text-xl font-semibold text-black">
                  {formatNumber(result.netOutflow, locale)} {t.unit}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-gray-500">{t.months}</dt>
                <dd className="mt-1 text-xl font-semibold text-black">
                  {formatNumber(result.months!, locale)} {t.monthsUnit}
                </dd>
              </div>
            </dl>
          )}
          <button type="button" onClick={handleCopyResult} className="btn-outline mt-6 no-print">
            {copied ? t.copied : t.copyResult}
          </button>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, type FormEvent } from "react";
import { calculateMargin, MAX_SUPPORTED_VALUE, type MarginResult } from "@/lib/margin";
import { trackEvent } from "@/lib/analytics";
import type { Locale } from "@/lib/manifest";

const T = {
  ru: {
    costLabel: "Себестоимость",
    priceLabel: "Цена продажи",
    calculate: "Рассчитать",
    profit: "Валовая прибыль на единицу",
    margin: "Маржа",
    markup: "Наценка",
    markupUndefined: "не определена (себестоимость равна нулю)",
    belowCost:
      "Цена ниже себестоимости: продажа приносит убыток на единицу. Значения ниже отрицательные.",
    errors: {
      COST_INVALID: "Введите число",
      COST_NEGATIVE: "Себестоимость не может быть отрицательной",
      COST_TOO_LARGE: `Слишком большое значение (максимум ${MAX_SUPPORTED_VALUE.toLocaleString("ru-RU")})`,
      PRICE_INVALID: "Введите число",
      PRICE_NOT_POSITIVE: "Цена должна быть больше нуля",
      PRICE_TOO_LARGE: `Слишком большое значение (максимум ${MAX_SUPPORTED_VALUE.toLocaleString("ru-RU")})`,
    },
    copyResult: "Скопировать результат",
    copied: "Скопировано",
    unit: "сум",
  },
  uz: {
    costLabel: "Tannarx",
    priceLabel: "Sotuv narxi",
    calculate: "Hisoblash",
    profit: "Birlik uchun yalpi foyda",
    margin: "Marja",
    markup: "Ustama",
    markupUndefined: "aniqlanmagan (tannarx nolga teng)",
    belowCost:
      "Narx tannarxdan past: sotuv birlik uchun zarar keltiradi. Quyidagi qiymatlar manfiy.",
    errors: {
      COST_INVALID: "Raqam kiriting",
      COST_NEGATIVE: "Tannarx manfiy bo‘lishi mumkin emas",
      COST_TOO_LARGE: `Qiymat juda katta (maksimum ${MAX_SUPPORTED_VALUE.toLocaleString("ru-RU")})`,
      PRICE_INVALID: "Raqam kiriting",
      PRICE_NOT_POSITIVE: "Narx noldan katta bo‘lishi kerak",
      PRICE_TOO_LARGE: `Qiymat juda katta (maksimum ${MAX_SUPPORTED_VALUE.toLocaleString("ru-RU")})`,
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

export function MarginCalculator({ locale, topicId }: { locale: Locale; topicId: string }) {
  const t = T[locale];
  const [costInput, setCostInput] = useState("100000");
  const [priceInput, setPriceInput] = useState("125000");
  const [result, setResult] = useState<MarginResult | null>(null);
  const [copied, setCopied] = useState(false);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const cost = normalizeNumberInput(costInput);
    const price = normalizeNumberInput(priceInput);
    const r = calculateMargin({ cost, price });
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
            `Калькулятор маржи и наценки — Contador`,
            `Себестоимость: ${formatNumber(costInput, locale)} ${t.unit}`,
            `Цена: ${formatNumber(priceInput, locale)} ${t.unit}`,
            `Валовая прибыль на единицу: ${formatNumber(result.profitPerUnit, locale)} ${t.unit}`,
            `Маржа: ${result.marginPercent}%`,
            `Наценка: ${result.markupUndefined ? t.markupUndefined : `${result.markupPercent}%`}`,
          ]
        : [
            `Marja va ustama kalkulyatori — Contador`,
            `Tannarx: ${formatNumber(costInput, locale)} ${t.unit}`,
            `Narx: ${formatNumber(priceInput, locale)} ${t.unit}`,
            `Birlik uchun yalpi foyda: ${formatNumber(result.profitPerUnit, locale)} ${t.unit}`,
            `Marja: ${result.marginPercent}%`,
            `Ustama: ${result.markupUndefined ? t.markupUndefined : `${result.markupPercent}%`}`,
          ];
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Буфер обмена недоступен — не критично, значения остаются на экране.
    }
  }

  const fieldError = (field: "cost" | "price") =>
    result && !result.ok && result.field === field ? t.errors[result.code] : undefined;

  return (
    <div className="rounded border border-gray-200 p-6">
      <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2" noValidate>
        <div>
          <label htmlFor="cost" className="block text-sm font-medium text-black">
            {t.costLabel}
          </label>
          <input
            id="cost"
            name="cost"
            type="text"
            inputMode="decimal"
            value={costInput}
            onChange={(e) => setCostInput(e.target.value)}
            aria-invalid={Boolean(fieldError("cost"))}
            aria-describedby={fieldError("cost") ? "cost-error" : undefined}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none focus-visible:ring-2 focus-visible:ring-black"
          />
          {fieldError("cost") && (
            <p id="cost-error" className="mt-1 text-xs text-red-600">
              {fieldError("cost")}
            </p>
          )}
        </div>
        <div>
          <label htmlFor="price" className="block text-sm font-medium text-black">
            {t.priceLabel}
          </label>
          <input
            id="price"
            name="price"
            type="text"
            inputMode="decimal"
            value={priceInput}
            onChange={(e) => setPriceInput(e.target.value)}
            aria-invalid={Boolean(fieldError("price"))}
            aria-describedby={fieldError("price") ? "price-error" : undefined}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none focus-visible:ring-2 focus-visible:ring-black"
          />
          {fieldError("price") && (
            <p id="price-error" className="mt-1 text-xs text-red-600">
              {fieldError("price")}
            </p>
          )}
        </div>
        <div className="sm:col-span-2">
          <button type="submit" className="btn-black">
            {t.calculate}
          </button>
        </div>
      </form>

      {result && result.ok && (
        <div className="mt-6 border-t border-gray-200 pt-6">
          {result.belowCost && (
            <p className="mb-4 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              {t.belowCost}
            </p>
          )}
          <dl className="grid gap-4 sm:grid-cols-3">
            <div>
              <dt className="text-xs uppercase tracking-wide text-gray-500">{t.profit}</dt>
              <dd className="mt-1 text-xl font-semibold text-black">
                {formatNumber(result.profitPerUnit, locale)} {t.unit}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-gray-500">{t.margin}</dt>
              <dd className="mt-1 text-xl font-semibold text-black">{result.marginPercent}%</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-gray-500">{t.markup}</dt>
              <dd className="mt-1 text-xl font-semibold text-black">
                {result.markupUndefined ? (
                  <span className="text-base font-normal text-gray-500">{t.markupUndefined}</span>
                ) : (
                  `${result.markupPercent}%`
                )}
              </dd>
            </div>
          </dl>
          <button type="button" onClick={handleCopyResult} className="btn-outline mt-6 no-print">
            {copied ? t.copied : t.copyResult}
          </button>
        </div>
      )}
    </div>
  );
}

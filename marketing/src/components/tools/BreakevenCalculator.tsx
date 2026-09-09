"use client";

import { useState, type FormEvent } from "react";
import { calculateBreakeven, MAX_SUPPORTED_VALUE, type BreakevenResult } from "@/lib/breakeven";
import { trackEvent } from "@/lib/analytics";
import type { Locale } from "@/lib/manifest";

const T = {
  ru: {
    fixedCostsLabel: "Постоянные расходы за период",
    priceLabel: "Цена единицы",
    variableCostLabel: "Переменные расходы на единицу",
    calculate: "Рассчитать",
    contributionMargin: "Маржинальный доход на единицу",
    quantity: "Порог безубыточности (непрерывный)",
    revenue: "Выручка порога",
    quantityCeil: "Порог в целых единицах",
    revenueCeil: "Выручка при целых единицах",
    units: "ед.",
    notPositive:
      "При этих условиях продажи не обеспечивают положительного вклада в покрытие постоянных расходов.",
    errors: {
      FIXED_COSTS_INVALID: "Введите число",
      FIXED_COSTS_NEGATIVE: "Постоянные расходы не могут быть отрицательными",
      FIXED_COSTS_TOO_LARGE: `Слишком большое значение (максимум ${MAX_SUPPORTED_VALUE.toLocaleString("ru-RU")})`,
      PRICE_INVALID: "Введите число",
      PRICE_NOT_POSITIVE: "Цена должна быть больше нуля",
      PRICE_TOO_LARGE: `Слишком большое значение (максимум ${MAX_SUPPORTED_VALUE.toLocaleString("ru-RU")})`,
      VARIABLE_COST_INVALID: "Введите число",
      VARIABLE_COST_NEGATIVE: "Переменные расходы не могут быть отрицательными",
      VARIABLE_COST_TOO_LARGE: `Слишком большое значение (максимум ${MAX_SUPPORTED_VALUE.toLocaleString("ru-RU")})`,
    },
    copyResult: "Скопировать результат",
    copied: "Скопировано",
    unit: "сум",
  },
  uz: {
    fixedCostsLabel: "Davr uchun doimiy xarajatlar",
    priceLabel: "Birlik narxi",
    variableCostLabel: "Birlik uchun o‘zgaruvchan xarajatlar",
    calculate: "Hisoblash",
    contributionMargin: "Birlik uchun marjinal daromad",
    quantity: "Zararsizlik nuqtasi (uzluksiz)",
    revenue: "Nuqtadagi tushum",
    quantityCeil: "Butun birliklarda nuqta",
    revenueCeil: "Butun birliklardagi tushum",
    units: "dona",
    notPositive:
      "Ushbu shartlarda savdo doimiy xarajatlarni qoplashga ijobiy hissa qo‘shmaydi.",
    errors: {
      FIXED_COSTS_INVALID: "Raqam kiriting",
      FIXED_COSTS_NEGATIVE: "Doimiy xarajatlar manfiy bo‘lishi mumkin emas",
      FIXED_COSTS_TOO_LARGE: `Qiymat juda katta (maksimum ${MAX_SUPPORTED_VALUE.toLocaleString("ru-RU")})`,
      PRICE_INVALID: "Raqam kiriting",
      PRICE_NOT_POSITIVE: "Narx noldan katta bo‘lishi kerak",
      PRICE_TOO_LARGE: `Qiymat juda katta (maksimum ${MAX_SUPPORTED_VALUE.toLocaleString("ru-RU")})`,
      VARIABLE_COST_INVALID: "Raqam kiriting",
      VARIABLE_COST_NEGATIVE: "O‘zgaruvchan xarajatlar manfiy bo‘lishi mumkin emas",
      VARIABLE_COST_TOO_LARGE: `Qiymat juda katta (maksimum ${MAX_SUPPORTED_VALUE.toLocaleString("ru-RU")})`,
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

export function BreakevenCalculator({ locale, topicId }: { locale: Locale; topicId: string }) {
  const t = T[locale];
  const [fixedCostsInput, setFixedCostsInput] = useState("1000000");
  const [priceInput, setPriceInput] = useState("150000");
  const [variableCostInput, setVariableCostInput] = useState("100000");
  const [result, setResult] = useState<BreakevenResult | null>(null);
  const [copied, setCopied] = useState(false);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const fixedCosts = normalizeNumberInput(fixedCostsInput);
    const price = normalizeNumberInput(priceInput);
    const variableCost = normalizeNumberInput(variableCostInput);
    const r = calculateBreakeven({ fixedCosts, price, variableCost });
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
            `Калькулятор точки безубыточности — Contador`,
            `Постоянные расходы: ${formatNumber(fixedCostsInput, locale)} ${t.unit}`,
            `Цена: ${formatNumber(priceInput, locale)} ${t.unit}`,
            `Переменные расходы на единицу: ${formatNumber(variableCostInput, locale)} ${t.unit}`,
            `Маржинальный доход на единицу: ${formatNumber(result.contributionMargin, locale)} ${t.unit}`,
            result.positive
              ? `Порог: ${formatNumber(result.quantity!, locale)} ${t.units} (выручка ${formatNumber(result.revenue!, locale)} ${t.unit}); целых единиц: ${result.quantityCeil} (выручка ${formatNumber(result.revenueCeil!, locale)} ${t.unit})`
              : t.notPositive,
          ]
        : [
            `Zararsizlik nuqtasi kalkulyatori — Contador`,
            `Doimiy xarajatlar: ${formatNumber(fixedCostsInput, locale)} ${t.unit}`,
            `Narx: ${formatNumber(priceInput, locale)} ${t.unit}`,
            `Birlik uchun o‘zgaruvchan xarajatlar: ${formatNumber(variableCostInput, locale)} ${t.unit}`,
            `Birlik uchun marjinal daromad: ${formatNumber(result.contributionMargin, locale)} ${t.unit}`,
            result.positive
              ? `Nuqta: ${formatNumber(result.quantity!, locale)} ${t.units} (tushum ${formatNumber(result.revenue!, locale)} ${t.unit}); butun birliklarda: ${result.quantityCeil} (tushum ${formatNumber(result.revenueCeil!, locale)} ${t.unit})`
              : t.notPositive,
          ];
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Буфер обмена недоступен — не критично, значения остаются на экране.
    }
  }

  const fieldError = (field: "fixedCosts" | "price" | "variableCost") =>
    result && !result.ok && result.field === field ? t.errors[result.code] : undefined;

  return (
    <div className="rounded border border-gray-200 p-6">
      <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-3" noValidate>
        <div>
          <label htmlFor="fixedCosts" className="block text-sm font-medium text-black">
            {t.fixedCostsLabel}
          </label>
          <input
            id="fixedCosts"
            name="fixedCosts"
            type="text"
            inputMode="decimal"
            value={fixedCostsInput}
            onChange={(e) => setFixedCostsInput(e.target.value)}
            aria-invalid={Boolean(fieldError("fixedCosts"))}
            aria-describedby={fieldError("fixedCosts") ? "fixedCosts-error" : undefined}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none focus-visible:ring-2 focus-visible:ring-black"
          />
          {fieldError("fixedCosts") && (
            <p id="fixedCosts-error" className="mt-1 text-xs text-red-600">
              {fieldError("fixedCosts")}
            </p>
          )}
        </div>
        <div>
          <label htmlFor="bePrice" className="block text-sm font-medium text-black">
            {t.priceLabel}
          </label>
          <input
            id="bePrice"
            name="bePrice"
            type="text"
            inputMode="decimal"
            value={priceInput}
            onChange={(e) => setPriceInput(e.target.value)}
            aria-invalid={Boolean(fieldError("price"))}
            aria-describedby={fieldError("price") ? "bePrice-error" : undefined}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none focus-visible:ring-2 focus-visible:ring-black"
          />
          {fieldError("price") && (
            <p id="bePrice-error" className="mt-1 text-xs text-red-600">
              {fieldError("price")}
            </p>
          )}
        </div>
        <div>
          <label htmlFor="variableCost" className="block text-sm font-medium text-black">
            {t.variableCostLabel}
          </label>
          <input
            id="variableCost"
            name="variableCost"
            type="text"
            inputMode="decimal"
            value={variableCostInput}
            onChange={(e) => setVariableCostInput(e.target.value)}
            aria-invalid={Boolean(fieldError("variableCost"))}
            aria-describedby={fieldError("variableCost") ? "variableCost-error" : undefined}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none focus-visible:ring-2 focus-visible:ring-black"
          />
          {fieldError("variableCost") && (
            <p id="variableCost-error" className="mt-1 text-xs text-red-600">
              {fieldError("variableCost")}
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
          {!result.positive ? (
            <p className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              {t.notPositive}
            </p>
          ) : (
            <dl className="grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs uppercase tracking-wide text-gray-500">{t.contributionMargin}</dt>
                <dd className="mt-1 text-xl font-semibold text-black">
                  {formatNumber(result.contributionMargin, locale)} {t.unit}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-gray-500">{t.quantity}</dt>
                <dd className="mt-1 text-xl font-semibold text-black">
                  {formatNumber(result.quantity!, locale)} {t.units}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-gray-500">{t.revenue}</dt>
                <dd className="mt-1 text-xl font-semibold text-black">
                  {formatNumber(result.revenue!, locale)} {t.unit}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-gray-500">{t.quantityCeil}</dt>
                <dd className="mt-1 text-xl font-semibold text-black">
                  {result.quantityCeil} {t.units}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-gray-500">{t.revenueCeil}</dt>
                <dd className="mt-1 text-xl font-semibold text-black">
                  {formatNumber(result.revenueCeil!, locale)} {t.unit}
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

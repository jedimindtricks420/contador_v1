"use client";

import { useState, type FormEvent } from "react";
import { calculateTurnoverTax, MAX_SUPPORTED_VALUE, type TurnoverTaxResult } from "@/lib/turnoverTax";
import { trackEvent } from "@/lib/analytics";
import type { Locale } from "@/lib/manifest";

const T = {
  ru: {
    turnoverLabel: "Оборот за период",
    rateLabel: "Ставка налога с оборота, %",
    ratePlaceholder: "Например, 4",
    calculate: "Рассчитать",
    tax: "Налог с оборота",
    rangeWarning: "Стандартный диапазон ставки — 1–4%. Введённая ставка вне этого диапазона: проверьте свой налоговый статус и право на льготную ставку.",
    disclaimer: "Предварительный расчёт по указанной вами ставке; не официальная декларация, не учитывает льготы и вычеты.",
    errors: {
      TURNOVER_INVALID: "Введите число",
      TURNOVER_NEGATIVE: "Оборот не может быть отрицательным",
      TURNOVER_TOO_LARGE: `Слишком большое значение (максимум ${MAX_SUPPORTED_VALUE.toLocaleString("ru-RU")})`,
      RATE_INVALID: "Введите ставку — это обязательное поле",
      RATE_NOT_POSITIVE: "Ставка должна быть больше нуля",
      RATE_TOO_LARGE: "Ставка не может быть больше 100%",
    },
    copyResult: "Скопировать результат",
    copied: "Скопировано",
    unit: "сум",
  },
  uz: {
    turnoverLabel: "Davr uchun aylanma",
    rateLabel: "Aylanma solig'i stavkasi, %",
    ratePlaceholder: "Masalan, 4",
    calculate: "Hisoblash",
    tax: "Aylanma solig'i",
    rangeWarning: "Odatiy stavka diapazoni — 1–4%. Kiritilgan stavka bu diapazondan tashqarida: soliq holatingiz va imtiyozli stavkaga huquqingizni tekshiring.",
    disclaimer: "Siz ko'rsatgan stavka bo'yicha taxminiy hisob-kitob; rasmiy deklaratsiya emas, imtiyoz va chegirmalarni hisobga olmaydi.",
    errors: {
      TURNOVER_INVALID: "Raqam kiriting",
      TURNOVER_NEGATIVE: "Aylanma manfiy bo'lishi mumkin emas",
      TURNOVER_TOO_LARGE: `Qiymat juda katta (maksimum ${MAX_SUPPORTED_VALUE.toLocaleString("ru-RU")})`,
      RATE_INVALID: "Stavkani kiriting — bu majburiy maydon",
      RATE_NOT_POSITIVE: "Stavka noldan katta bo'lishi kerak",
      RATE_TOO_LARGE: "Stavka 100% dan katta bo'lishi mumkin emas",
    },
    copyResult: "Natijani nusxalash",
    copied: "Nusxalandi",
    unit: "so'm",
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

export function TurnoverTaxCalculator({ locale, topicId }: { locale: Locale; topicId: string }) {
  const t = T[locale];
  // Оборот — демонстрационное значение для примера; ставка намеренно оставлена
  // пустой (обязательное поле без "правильного" дефолта, см. wave2-metadata.md §32).
  const [turnoverInput, setTurnoverInput] = useState("50000000");
  const [rateInput, setRateInput] = useState("");
  const [result, setResult] = useState<TurnoverTaxResult | null>(null);
  const [copied, setCopied] = useState(false);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const turnover = normalizeNumberInput(turnoverInput);
    const ratePercent = normalizeNumberInput(rateInput);
    const r = calculateTurnoverTax({ turnover, ratePercent });
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
            `Калькулятор налога с оборота — Contador`,
            `Оборот: ${formatNumber(turnoverInput, locale)} ${t.unit}`,
            `Ставка: ${rateInput}%`,
            `Налог с оборота: ${formatNumber(result.taxAmount, locale)} ${t.unit}`,
            t.disclaimer,
          ]
        : [
            `Aylanma solig'i kalkulyatori — Contador`,
            `Aylanma: ${formatNumber(turnoverInput, locale)} ${t.unit}`,
            `Stavka: ${rateInput}%`,
            `Aylanma solig'i: ${formatNumber(result.taxAmount, locale)} ${t.unit}`,
            t.disclaimer,
          ];
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Буфер обмена недоступен — не критично, значения остаются на экране.
    }
  }

  const fieldError = (field: "turnover" | "rate") =>
    result && !result.ok && result.field === field ? t.errors[result.code] : undefined;

  return (
    <div className="rounded border border-gray-200 p-6">
      <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2" noValidate>
        <div>
          <label htmlFor="turnover" className="block text-sm font-medium text-black">
            {t.turnoverLabel}
          </label>
          <input
            id="turnover"
            name="turnover"
            type="text"
            inputMode="decimal"
            value={turnoverInput}
            onChange={(e) => setTurnoverInput(e.target.value)}
            aria-invalid={Boolean(fieldError("turnover"))}
            aria-describedby={fieldError("turnover") ? "turnover-error" : undefined}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none focus-visible:ring-2 focus-visible:ring-black"
          />
          {fieldError("turnover") && (
            <p id="turnover-error" className="mt-1 text-xs text-red-600">
              {fieldError("turnover")}
            </p>
          )}
        </div>
        <div>
          <label htmlFor="rate" className="block text-sm font-medium text-black">
            {t.rateLabel}
          </label>
          <input
            id="rate"
            name="rate"
            type="text"
            inputMode="decimal"
            placeholder={t.ratePlaceholder}
            value={rateInput}
            onChange={(e) => setRateInput(e.target.value)}
            aria-invalid={Boolean(fieldError("rate"))}
            aria-describedby={fieldError("rate") ? "rate-error" : undefined}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none focus-visible:ring-2 focus-visible:ring-black"
          />
          {fieldError("rate") && (
            <p id="rate-error" className="mt-1 text-xs text-red-600">
              {fieldError("rate")}
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
          {result.rateOutOfTypicalRange && (
            <p className="mb-4 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              {t.rangeWarning}
            </p>
          )}
          <dl>
            <dt className="text-xs uppercase tracking-wide text-gray-500">{t.tax}</dt>
            <dd className="mt-1 text-xl font-semibold text-black">
              {formatNumber(result.taxAmount, locale)} {t.unit}
            </dd>
          </dl>
          <p className="mt-4 text-xs text-gray-500">{t.disclaimer}</p>
          <button type="button" onClick={handleCopyResult} className="btn-outline mt-6 no-print">
            {copied ? t.copied : t.copyResult}
          </button>
        </div>
      )}
    </div>
  );
}

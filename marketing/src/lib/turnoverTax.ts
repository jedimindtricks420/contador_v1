import Decimal from "decimal.js";

// Калькулятор налога с оборота (тема 32, TASK-0004 §4 «32», wave2-metadata.md).
// Публичная статутная формула Налогового кодекса РУз (сумма оборота × ставка),
// НЕ имитация внутренней бизнес-логики продукта — раздел 2.3 TASK-0004 прямо
// требует различать эти два случая. Денежная арифметика — Decimal, не floating
// point (тот же паттерн, что margin.ts/breakeven.ts/runway.ts), вычисления
// выполняются в браузере, сервер их не видит и ничего не сохраняет.

// Тот же порядок, что MAX_SUPPORTED_VALUE в margin.ts/breakeven.ts — большой
// запас над разумными суммами в сумах, но конечен.
export const MAX_SUPPORTED_VALUE = 1_000_000_000_000; // 1 трлн

// Обычный диапазон ставки налога с оборота — v2/src/lib/constants.ts
// TURNOVER_TAX_RATE_MIN=0.01 / TURNOVER_TAX_RATE_MAX=0.04 (1–4%). За пределами
// диапазона — НЕ хардстоп: показывается мягкое предупреждение, т.к. льготные
// категории с иной ставкой существуют (TASK-0004 §4 «32»). Жёстко отклоняются
// только математически бессмысленные значения ставки (<=0 или >100%).
export const TYPICAL_RATE_MIN = 1;
export const TYPICAL_RATE_MAX = 4;
const RATE_HARD_MAX = 100;

export type TurnoverTaxErrorCode =
  | "TURNOVER_INVALID"
  | "TURNOVER_NEGATIVE"
  | "TURNOVER_TOO_LARGE"
  | "RATE_INVALID"
  | "RATE_NOT_POSITIVE"
  | "RATE_TOO_LARGE";

export interface TurnoverTaxInput {
  /** Оборот за период, T >= 0 */
  turnover: number;
  /** Ставка налога с оборота в процентах, R > 0. Обязательное поле — умный
   * дефолт намеренно не подставляется (spec запрещает выдавать "правильную"
   * ставку по умолчанию, т.к. её выбирает сама организация). */
  ratePercent: number;
}

export interface TurnoverTaxSuccess {
  ok: true;
  /** Налог = Оборот × Ставка / 100, как Decimal-строка с 2 знаками. */
  taxAmount: string;
  /** true, если ставка вне обычного диапазона 1–4% — UI показывает мягкое
   * предупреждение рядом с результатом, но результат всё равно считается. */
  rateOutOfTypicalRange: boolean;
}

export interface TurnoverTaxFailure {
  ok: false;
  field: "turnover" | "rate";
  code: TurnoverTaxErrorCode;
}

export type TurnoverTaxResult = TurnoverTaxSuccess | TurnoverTaxFailure;

function isFiniteNumber(value: number): boolean {
  return typeof value === "number" && Number.isFinite(value);
}

export function calculateTurnoverTax(input: TurnoverTaxInput): TurnoverTaxResult {
  const { turnover, ratePercent } = input;

  if (!isFiniteNumber(turnover)) {
    return { ok: false, field: "turnover", code: "TURNOVER_INVALID" };
  }
  if (turnover < 0) {
    return { ok: false, field: "turnover", code: "TURNOVER_NEGATIVE" };
  }
  if (turnover > MAX_SUPPORTED_VALUE) {
    return { ok: false, field: "turnover", code: "TURNOVER_TOO_LARGE" };
  }

  if (!isFiniteNumber(ratePercent)) {
    return { ok: false, field: "rate", code: "RATE_INVALID" };
  }
  if (ratePercent <= 0) {
    return { ok: false, field: "rate", code: "RATE_NOT_POSITIVE" };
  }
  if (ratePercent > RATE_HARD_MAX) {
    return { ok: false, field: "rate", code: "RATE_TOO_LARGE" };
  }

  const T = new Decimal(turnover);
  const R = new Decimal(ratePercent);
  const tax = T.times(R).dividedBy(100);

  const rateOutOfTypicalRange = ratePercent < TYPICAL_RATE_MIN || ratePercent > TYPICAL_RATE_MAX;

  return {
    ok: true,
    taxAmount: tax.toFixed(2),
    rateOutOfTypicalRange,
  };
}

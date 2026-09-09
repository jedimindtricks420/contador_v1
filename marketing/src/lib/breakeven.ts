import Decimal from "decimal.js";

// Калькулятор точки безубыточности (тема 28, spec TASK-0003 §7 «28. Безубыточность»).
// Денежная арифметика — Decimal, не floating point, чтобы не показывать
// артефакты вида 3.3299999999999996. Вычисления выполняются в браузере
// (клиентский компонент), сервер их не видит и ничего не сохраняет.

// Явный верхний предел поддерживаемого ввода — тестируется в breakeven.test.ts.
// Тот же порядок, что и MAX_SUPPORTED_VALUE в margin.ts — большой запас над
// разумными суммами в сумах, но конечен.
export const MAX_SUPPORTED_VALUE = 1_000_000_000_000; // 1 трлн

export type BreakevenErrorCode =
  | "FIXED_COSTS_INVALID"
  | "FIXED_COSTS_NEGATIVE"
  | "FIXED_COSTS_TOO_LARGE"
  | "PRICE_INVALID"
  | "PRICE_NOT_POSITIVE"
  | "PRICE_TOO_LARGE"
  | "VARIABLE_COST_INVALID"
  | "VARIABLE_COST_NEGATIVE"
  | "VARIABLE_COST_TOO_LARGE";

export interface BreakevenInput {
  /** Постоянные расходы за период, F >= 0 */
  fixedCosts: number;
  /** Цена единицы, P > 0 */
  price: number;
  /** Переменные расходы на единицу, V >= 0 */
  variableCost: number;
}

export interface BreakevenSuccess {
  ok: true;
  /** Маржинальный доход на единицу, D = P - V, как Decimal-строка (2 знака). */
  contributionMargin: string;
  /** true, если D > 0 — модель даёт содержательный порог безубыточности. */
  positive: boolean;
  /** Непрерывный порог Q = F / D (2 знака), null если D <= 0. */
  quantity: string | null;
  /** Выручка порога R = Q * P (2 знака), null если D <= 0. */
  revenue: string | null;
  /** Округлённое вверх число неделимых единиц, Qceil = ceil(Q), null если D <= 0. */
  quantityCeil: string | null;
  /** Выручка при округлённом числе единиц, Rceil = Qceil * P, null если D <= 0. */
  revenueCeil: string | null;
}

export interface BreakevenFailure {
  ok: false;
  field: "fixedCosts" | "price" | "variableCost";
  code: BreakevenErrorCode;
}

export type BreakevenResult = BreakevenSuccess | BreakevenFailure;

function isFiniteNumber(value: number): boolean {
  return typeof value === "number" && Number.isFinite(value);
}

export function calculateBreakeven(input: BreakevenInput): BreakevenResult {
  const { fixedCosts, price, variableCost } = input;

  if (!isFiniteNumber(fixedCosts)) {
    return { ok: false, field: "fixedCosts", code: "FIXED_COSTS_INVALID" };
  }
  if (fixedCosts < 0) {
    return { ok: false, field: "fixedCosts", code: "FIXED_COSTS_NEGATIVE" };
  }
  if (fixedCosts > MAX_SUPPORTED_VALUE) {
    return { ok: false, field: "fixedCosts", code: "FIXED_COSTS_TOO_LARGE" };
  }

  if (!isFiniteNumber(price)) {
    return { ok: false, field: "price", code: "PRICE_INVALID" };
  }
  if (price <= 0) {
    return { ok: false, field: "price", code: "PRICE_NOT_POSITIVE" };
  }
  if (price > MAX_SUPPORTED_VALUE) {
    return { ok: false, field: "price", code: "PRICE_TOO_LARGE" };
  }

  if (!isFiniteNumber(variableCost)) {
    return { ok: false, field: "variableCost", code: "VARIABLE_COST_INVALID" };
  }
  if (variableCost < 0) {
    return { ok: false, field: "variableCost", code: "VARIABLE_COST_NEGATIVE" };
  }
  if (variableCost > MAX_SUPPORTED_VALUE) {
    return { ok: false, field: "variableCost", code: "VARIABLE_COST_TOO_LARGE" };
  }

  const F = new Decimal(fixedCosts);
  const P = new Decimal(price);
  const V = new Decimal(variableCost);
  const D = P.minus(V);
  // Decimal#isPositive() is true for zero too ("not negative"); the spec
  // requires strictly D > 0, so compare explicitly (D = 0 must fall into the
  // "not positive" branch, same as D < 0).
  const positive = D.greaterThan(0);

  if (!positive) {
    // D <= 0: продажи не покрывают постоянные расходы — не делим на ноль,
    // не выдаём отрицательный/бесконечный объём (TASK-0003 §7 «28»).
    return {
      ok: true,
      contributionMargin: D.toFixed(2),
      positive: false,
      quantity: null,
      revenue: null,
      quantityCeil: null,
      revenueCeil: null,
    };
  }

  const Q = F.dividedBy(D);
  const R = Q.times(P);
  const Qceil = Q.ceil();
  const Rceil = Qceil.times(P);

  return {
    ok: true,
    contributionMargin: D.toFixed(2),
    positive: true,
    quantity: Q.toFixed(2),
    revenue: R.toFixed(2),
    quantityCeil: Qceil.toFixed(0),
    revenueCeil: Rceil.toFixed(2),
  };
}

import Decimal from "decimal.js";

// Калькулятор маржи и наценки (тема 27, spec TASK-0003 §7).
// Денежная арифметика — Decimal, не floating point, чтобы не показывать
// артефакты вида 24999.999999999996. Вычисления выполняются в браузере
// (клиентский компонент), сервер их не видит и ничего не сохраняет.

// Явный верхний предел поддерживаемого ввода — тестируется в margin.test.ts.
// Выбран с большим запасом над разумными суммами в сумах, но конечен, чтобы
// не пытаться форматировать/делить абсурдно большие числа.
export const MAX_SUPPORTED_VALUE = 1_000_000_000_000; // 1 трлн

export type MarginErrorCode =
  | "COST_INVALID"
  | "COST_NEGATIVE"
  | "COST_TOO_LARGE"
  | "PRICE_INVALID"
  | "PRICE_NOT_POSITIVE"
  | "PRICE_TOO_LARGE";

export interface MarginInput {
  /** Себестоимость, C >= 0 */
  cost: number;
  /** Цена продажи, P > 0 */
  price: number;
}

export interface MarginSuccess {
  ok: true;
  /** Валовая прибыль на единицу, P - C, как Decimal-строка без округления. */
  profitPerUnit: string;
  /** Маржа в процентах, (P-C)/P * 100, округлена до 2 знаков для вывода. */
  marginPercent: string;
  /** Наценка в процентах, (P-C)/C * 100, округлена до 2 знаков; null если C = 0. */
  markupPercent: string | null;
  /** true, если C = 0 — наценка математически не определена (деление на 0). */
  markupUndefined: boolean;
  /** true, если P < C — продажа ниже себестоимости, значения отрицательные. */
  belowCost: boolean;
}

export interface MarginFailure {
  ok: false;
  field: "cost" | "price";
  code: MarginErrorCode;
}

export type MarginResult = MarginSuccess | MarginFailure;

function isFiniteNumber(value: number): boolean {
  return typeof value === "number" && Number.isFinite(value);
}

export function calculateMargin(input: MarginInput): MarginResult {
  const { cost, price } = input;

  if (!isFiniteNumber(cost)) {
    return { ok: false, field: "cost", code: "COST_INVALID" };
  }
  if (cost < 0) {
    return { ok: false, field: "cost", code: "COST_NEGATIVE" };
  }
  if (cost > MAX_SUPPORTED_VALUE) {
    return { ok: false, field: "cost", code: "COST_TOO_LARGE" };
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

  const C = new Decimal(cost);
  const P = new Decimal(price);
  const profit = P.minus(C);
  const marginPercent = profit.dividedBy(P).times(100);

  const markupUndefined = C.isZero();
  const markupPercent = markupUndefined ? null : profit.dividedBy(C).times(100);

  return {
    ok: true,
    profitPerUnit: profit.toFixed(2),
    marginPercent: marginPercent.toFixed(2),
    markupPercent: markupPercent ? markupPercent.toFixed(2) : null,
    markupUndefined,
    belowCost: profit.isNegative(),
  };
}

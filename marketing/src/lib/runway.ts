import Decimal from "decimal.js";

// Калькулятор запаса денежных средств (тема 29, spec TASK-0003 §7 «29. Запас
// денег»). Денежная арифметика — Decimal, не floating point. Вычисления
// выполняются в браузере (клиентский компонент), сервер их не видит и ничего
// не сохраняет.

// Тот же порядок, что и MAX_SUPPORTED_VALUE в margin.ts/breakeven.ts.
export const MAX_SUPPORTED_VALUE = 1_000_000_000_000; // 1 трлн

export type RunwayErrorCode =
  | "CASH_INVALID"
  | "CASH_NEGATIVE"
  | "CASH_TOO_LARGE"
  | "INCOME_INVALID"
  | "INCOME_NEGATIVE"
  | "INCOME_TOO_LARGE"
  | "OUTFLOW_INVALID"
  | "OUTFLOW_NEGATIVE"
  | "OUTFLOW_TOO_LARGE";

export interface RunwayInput {
  /** Доступные деньги, B >= 0 */
  cash: number;
  /** Среднемесячные поступления, I >= 0 */
  income: number;
  /** Среднемесячные выплаты, O >= 0 */
  outflow: number;
}

export interface RunwaySuccess {
  ok: true;
  /** Чистый отток, N = O - I, как Decimal-строка (2 знака). Может быть <= 0. */
  netOutflow: string;
  /** true, если N > 0 — запас в этой модели сокращается. */
  shrinking: boolean;
  /** Запас в месяцах, M = B / N (2 знака), null если N <= 0. */
  months: string | null;
}

export interface RunwayFailure {
  ok: false;
  field: "cash" | "income" | "outflow";
  code: RunwayErrorCode;
}

export type RunwayResult = RunwaySuccess | RunwayFailure;

function isFiniteNumber(value: number): boolean {
  return typeof value === "number" && Number.isFinite(value);
}

export function calculateRunway(input: RunwayInput): RunwayResult {
  const { cash, income, outflow } = input;

  if (!isFiniteNumber(cash)) {
    return { ok: false, field: "cash", code: "CASH_INVALID" };
  }
  if (cash < 0) {
    return { ok: false, field: "cash", code: "CASH_NEGATIVE" };
  }
  if (cash > MAX_SUPPORTED_VALUE) {
    return { ok: false, field: "cash", code: "CASH_TOO_LARGE" };
  }

  if (!isFiniteNumber(income)) {
    return { ok: false, field: "income", code: "INCOME_INVALID" };
  }
  if (income < 0) {
    return { ok: false, field: "income", code: "INCOME_NEGATIVE" };
  }
  if (income > MAX_SUPPORTED_VALUE) {
    return { ok: false, field: "income", code: "INCOME_TOO_LARGE" };
  }

  if (!isFiniteNumber(outflow)) {
    return { ok: false, field: "outflow", code: "OUTFLOW_INVALID" };
  }
  if (outflow < 0) {
    return { ok: false, field: "outflow", code: "OUTFLOW_NEGATIVE" };
  }
  if (outflow > MAX_SUPPORTED_VALUE) {
    return { ok: false, field: "outflow", code: "OUTFLOW_TOO_LARGE" };
  }

  const B = new Decimal(cash);
  const I = new Decimal(income);
  const O = new Decimal(outflow);
  const N = O.minus(I);
  // Decimal#isPositive() is true for zero too ("not negative"); the spec
  // requires strictly N > 0, so compare explicitly (N = 0 must fall into the
  // "not shrinking" branch, same as N < 0).
  const shrinking = N.greaterThan(0);

  if (!shrinking) {
    // N <= 0: поступления покрывают (или превышают) выплаты — запас не
    // сокращается в этой модели; не делим на ноль, не обещаем бесконечную
    // устойчивость (TASK-0003 §7 «29»).
    return {
      ok: true,
      netOutflow: N.toFixed(2),
      shrinking: false,
      months: null,
    };
  }

  const M = B.dividedBy(N);

  return {
    ok: true,
    netOutflow: N.toFixed(2),
    shrinking: true,
    months: M.toFixed(2),
  };
}

import { describe, expect, it } from "vitest";
import { calculateRunway, MAX_SUPPORTED_VALUE } from "./runway";

describe("calculateRunway", () => {
  it("matches the worked example from TASK-0003 §7 (B=30000000, I=8000000, O=13000000 -> 6 months)", () => {
    const result = calculateRunway({ cash: 30_000_000, income: 8_000_000, outflow: 13_000_000 });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok result");
    expect(result.shrinking).toBe(true);
    expect(result.netOutflow).toBe("5000000.00");
    expect(result.months).toBe("6.00");
  });

  it("returns shrinking:false with no months when N = 0 (income equals outflow)", () => {
    const result = calculateRunway({ cash: 10_000_000, income: 5_000_000, outflow: 5_000_000 });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok result");
    expect(result.shrinking).toBe(false);
    expect(result.netOutflow).toBe("0.00");
    expect(result.months).toBeNull();
  });

  it("returns shrinking:false with no months when N < 0 (income exceeds outflow) — no infinite sustainability promised, just null", () => {
    const result = calculateRunway({ cash: 10_000_000, income: 8_000_000, outflow: 5_000_000 });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok result");
    expect(result.shrinking).toBe(false);
    expect(result.netOutflow).toBe("-3000000.00");
    expect(result.months).toBeNull();
  });

  it("B = 0 and N > 0 -> 0 months, not an error", () => {
    const result = calculateRunway({ cash: 0, income: 1_000_000, outflow: 2_000_000 });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok result");
    expect(result.shrinking).toBe(true);
    expect(result.months).toBe("0.00");
  });

  it("rejects negative cash", () => {
    const result = calculateRunway({ cash: -1, income: 1_000_000, outflow: 2_000_000 });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.field).toBe("cash");
    expect(result.code).toBe("CASH_NEGATIVE");
  });

  it("rejects negative income", () => {
    const result = calculateRunway({ cash: 1_000_000, income: -1, outflow: 2_000_000 });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.field).toBe("income");
    expect(result.code).toBe("INCOME_NEGATIVE");
  });

  it("rejects negative outflow", () => {
    const result = calculateRunway({ cash: 1_000_000, income: 1_000_000, outflow: -1 });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.field).toBe("outflow");
    expect(result.code).toBe("OUTFLOW_NEGATIVE");
  });

  it("allows all-zero input (B=0, I=0, O=0) — N=0, not shrinking, no error", () => {
    const result = calculateRunway({ cash: 0, income: 0, outflow: 0 });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok result");
    expect(result.shrinking).toBe(false);
    expect(result.months).toBeNull();
  });

  it("rejects non-finite input (NaN, Infinity) with a field error, never returns NaN/Infinity strings", () => {
    const nan = calculateRunway({ cash: NaN, income: 1_000_000, outflow: 2_000_000 });
    expect(nan.ok).toBe(false);
    const inf = calculateRunway({ cash: 1_000_000, income: Infinity, outflow: 2_000_000 });
    expect(inf.ok).toBe(false);
    const infO = calculateRunway({ cash: 1_000_000, income: 1_000_000, outflow: Infinity });
    expect(infO.ok).toBe(false);
  });

  it("enforces the explicit upper bound on supported input", () => {
    const tooLarge = calculateRunway({
      cash: MAX_SUPPORTED_VALUE + 1,
      income: 1_000_000,
      outflow: 2_000_000,
    });
    expect(tooLarge.ok).toBe(false);
    if (tooLarge.ok) throw new Error("expected failure");
    expect(tooLarge.code).toBe("CASH_TOO_LARGE");

    const atLimit = calculateRunway({
      cash: MAX_SUPPORTED_VALUE,
      income: 1_000_000,
      outflow: 2_000_000,
    });
    expect(atLimit.ok).toBe(true);
  });

  it("avoids floating point artifacts on repeating-decimal splits", () => {
    // N = 30, M = 100/30 = 3.333... — classic FP-noise territory.
    const result = calculateRunway({ cash: 100, income: 0, outflow: 30 });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok result");
    expect(result.months).toBe("3.33");
  });
});

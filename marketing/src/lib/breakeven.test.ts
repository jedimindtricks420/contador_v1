import { describe, expect, it } from "vitest";
import { calculateBreakeven, MAX_SUPPORTED_VALUE } from "./breakeven";

describe("calculateBreakeven", () => {
  it("matches the worked example from TASK-0003 §7 (F=1000000, P=150000, V=100000)", () => {
    const result = calculateBreakeven({ fixedCosts: 1_000_000, price: 150_000, variableCost: 100_000 });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok result");
    expect(result.positive).toBe(true);
    expect(result.contributionMargin).toBe("50000.00");
    expect(result.quantity).toBe("20.00");
    expect(result.revenue).toBe("3000000.00");
    expect(result.quantityCeil).toBe("20");
    expect(result.revenueCeil).toBe("3000000.00");
  });

  it("matches the rounding example from TASK-0003 §7 (F=1025000, same P/V) — Q=20.5, Qceil=21", () => {
    const result = calculateBreakeven({ fixedCosts: 1_025_000, price: 150_000, variableCost: 100_000 });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok result");
    expect(result.quantity).toBe("20.50");
    expect(result.quantityCeil).toBe("21");
    expect(result.revenue).toBe("3075000.00");
    expect(result.revenueCeil).toBe("3150000.00");
  });

  it("returns positive:false with no quantity/revenue when D = 0 (price equals variable cost)", () => {
    const result = calculateBreakeven({ fixedCosts: 500_000, price: 100_000, variableCost: 100_000 });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok result");
    expect(result.positive).toBe(false);
    expect(result.contributionMargin).toBe("0.00");
    expect(result.quantity).toBeNull();
    expect(result.revenue).toBeNull();
    expect(result.quantityCeil).toBeNull();
    expect(result.revenueCeil).toBeNull();
  });

  it("returns positive:false with no quantity/revenue when D < 0 (variable cost above price)", () => {
    const result = calculateBreakeven({ fixedCosts: 500_000, price: 100_000, variableCost: 120_000 });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok result");
    expect(result.positive).toBe(false);
    expect(result.contributionMargin).toBe("-20000.00");
    expect(result.quantity).toBeNull();
    expect(result.revenue).toBeNull();
  });

  it("handles zero fixed costs: breakeven at zero units when D > 0", () => {
    const result = calculateBreakeven({ fixedCosts: 0, price: 100_000, variableCost: 60_000 });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok result");
    expect(result.positive).toBe(true);
    expect(result.quantity).toBe("0.00");
    expect(result.revenue).toBe("0.00");
    expect(result.quantityCeil).toBe("0");
  });

  it("rejects negative fixed costs", () => {
    const result = calculateBreakeven({ fixedCosts: -1, price: 100_000, variableCost: 60_000 });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.field).toBe("fixedCosts");
    expect(result.code).toBe("FIXED_COSTS_NEGATIVE");
  });

  it("rejects price = 0 as a field error, not a division by zero", () => {
    const result = calculateBreakeven({ fixedCosts: 100_000, price: 0, variableCost: 50_000 });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.field).toBe("price");
    expect(result.code).toBe("PRICE_NOT_POSITIVE");
  });

  it("rejects negative price", () => {
    const result = calculateBreakeven({ fixedCosts: 100_000, price: -5, variableCost: 0 });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.field).toBe("price");
  });

  it("rejects negative variable cost", () => {
    const result = calculateBreakeven({ fixedCosts: 100_000, price: 10_000, variableCost: -1 });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.field).toBe("variableCost");
    expect(result.code).toBe("VARIABLE_COST_NEGATIVE");
  });

  it("allows variable cost = 0", () => {
    const result = calculateBreakeven({ fixedCosts: 100_000, price: 10_000, variableCost: 0 });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok result");
    expect(result.positive).toBe(true);
    expect(result.quantity).toBe("10.00");
  });

  it("rejects non-finite input (NaN, Infinity) with a field error, never returns NaN/Infinity strings", () => {
    const nan = calculateBreakeven({ fixedCosts: NaN, price: 10_000, variableCost: 5_000 });
    expect(nan.ok).toBe(false);
    const inf = calculateBreakeven({ fixedCosts: 100_000, price: Infinity, variableCost: 5_000 });
    expect(inf.ok).toBe(false);
    const infV = calculateBreakeven({ fixedCosts: 100_000, price: 10_000, variableCost: Infinity });
    expect(infV.ok).toBe(false);
  });

  it("enforces the explicit upper bound on supported input", () => {
    const tooLarge = calculateBreakeven({
      fixedCosts: 100_000,
      price: MAX_SUPPORTED_VALUE + 1,
      variableCost: 10_000,
    });
    expect(tooLarge.ok).toBe(false);
    if (tooLarge.ok) throw new Error("expected failure");
    expect(tooLarge.code).toBe("PRICE_TOO_LARGE");

    const atLimit = calculateBreakeven({
      fixedCosts: 100_000,
      price: MAX_SUPPORTED_VALUE,
      variableCost: 10_000,
    });
    expect(atLimit.ok).toBe(true);
  });

  it("avoids floating point artifacts on repeating-decimal splits", () => {
    // D = 30000, Q = 100000/30000 = 3.333... — classic FP-noise territory.
    const result = calculateBreakeven({ fixedCosts: 100_000, price: 130_000, variableCost: 100_000 });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok result");
    expect(result.quantity).toBe("3.33");
    expect(result.quantityCeil).toBe("4");
  });
});

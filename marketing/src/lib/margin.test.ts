import { describe, expect, it } from "vitest";
import { calculateMargin, MAX_SUPPORTED_VALUE } from "./margin";

describe("calculateMargin", () => {
  it("matches the worked example from TASK-0003 §7 (C=100000, P=125000)", () => {
    const result = calculateMargin({ cost: 100_000, price: 125_000 });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok result");
    expect(result.profitPerUnit).toBe("25000.00");
    expect(result.marginPercent).toBe("20.00");
    expect(result.markupPercent).toBe("25.00");
    expect(result.markupUndefined).toBe(false);
    expect(result.belowCost).toBe(false);
  });

  it("treats markup as undefined when cost is 0, but still computes margin", () => {
    const result = calculateMargin({ cost: 0, price: 50_000 });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok result");
    expect(result.markupUndefined).toBe(true);
    expect(result.markupPercent).toBeNull();
    expect(result.marginPercent).toBe("100.00");
    expect(result.profitPerUnit).toBe("50000.00");
  });

  it("rejects price = 0 as a field error, not a division by zero", () => {
    const result = calculateMargin({ cost: 10_000, price: 0 });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.field).toBe("price");
    expect(result.code).toBe("PRICE_NOT_POSITIVE");
  });

  it("rejects negative price", () => {
    const result = calculateMargin({ cost: 10_000, price: -5 });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.field).toBe("price");
  });

  it("rejects negative cost", () => {
    const result = calculateMargin({ cost: -1, price: 10_000 });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.field).toBe("cost");
    expect(result.code).toBe("COST_NEGATIVE");
  });

  it("produces negative profit/margin/markup with a below-cost sale (P < C)", () => {
    const result = calculateMargin({ cost: 150_000, price: 100_000 });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok result");
    expect(result.belowCost).toBe(true);
    expect(result.profitPerUnit).toBe("-50000.00");
    expect(Number(result.marginPercent)).toBeLessThan(0);
    expect(result.markupPercent).not.toBeNull();
    expect(Number(result.markupPercent)).toBeLessThan(0);
  });

  it("allows cost = 0 and price = 0 combination to be rejected via price rule, not NaN", () => {
    const result = calculateMargin({ cost: 0, price: 0 });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.field).toBe("price");
  });

  it("rejects non-finite input (NaN, Infinity) with a field error, never returns NaN/Infinity strings", () => {
    const nan = calculateMargin({ cost: NaN, price: 10_000 });
    expect(nan.ok).toBe(false);
    const inf = calculateMargin({ cost: 10_000, price: Infinity });
    expect(inf.ok).toBe(false);
  });

  it("enforces the explicit upper bound on supported input", () => {
    const tooLarge = calculateMargin({ cost: 10_000, price: MAX_SUPPORTED_VALUE + 1 });
    expect(tooLarge.ok).toBe(false);
    if (tooLarge.ok) throw new Error("expected failure");
    expect(tooLarge.code).toBe("PRICE_TOO_LARGE");

    const atLimit = calculateMargin({ cost: 10_000, price: MAX_SUPPORTED_VALUE });
    expect(atLimit.ok).toBe(true);
  });

  it("avoids floating point artifacts on repeating-decimal splits", () => {
    // 1/3-style split that is notorious for 0.1 + 0.2 style FP noise.
    const result = calculateMargin({ cost: 10, price: 30 });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok result");
    // 20/30*100 = 66.666...% -> rounded to 2 decimals for display, no artifact digits.
    expect(result.marginPercent).toBe("66.67");
  });
});

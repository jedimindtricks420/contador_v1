import { describe, expect, it } from "vitest";
import { calculateTurnoverTax, MAX_SUPPORTED_VALUE, TYPICAL_RATE_MAX, TYPICAL_RATE_MIN } from "./turnoverTax";

describe("calculateTurnoverTax", () => {
  it("matches the worked example from wave2-metadata.md §32 (turnover=50 000 000, rate=4%)", () => {
    const result = calculateTurnoverTax({ turnover: 50_000_000, ratePercent: 4 });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok result");
    // 50 000 000 * 4 / 100 = 2 000 000 — hand-computed.
    expect(result.taxAmount).toBe("2000000.00");
    expect(result.rateOutOfTypicalRange).toBe(false);
  });

  it("computes zero tax for zero turnover without error", () => {
    const result = calculateTurnoverTax({ turnover: 0, ratePercent: 2 });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok result");
    expect(result.taxAmount).toBe("0.00");
  });

  it("rejects negative turnover", () => {
    const result = calculateTurnoverTax({ turnover: -1, ratePercent: 2 });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.field).toBe("turnover");
    expect(result.code).toBe("TURNOVER_NEGATIVE");
  });

  it("rejects rate = 0 as a field error (rate is a mandatory, non-defaulted field)", () => {
    const result = calculateTurnoverTax({ turnover: 1_000_000, ratePercent: 0 });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.field).toBe("rate");
    expect(result.code).toBe("RATE_NOT_POSITIVE");
  });

  it("rejects negative rate", () => {
    const result = calculateTurnoverTax({ turnover: 1_000_000, ratePercent: -4 });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.field).toBe("rate");
    expect(result.code).toBe("RATE_NOT_POSITIVE");
  });

  it("rejects non-finite input (NaN, Infinity) with a field error, never returns NaN/Infinity strings", () => {
    const nanTurnover = calculateTurnoverTax({ turnover: NaN, ratePercent: 2 });
    expect(nanTurnover.ok).toBe(false);
    const infTurnover = calculateTurnoverTax({ turnover: Infinity, ratePercent: 2 });
    expect(infTurnover.ok).toBe(false);
    const nanRate = calculateTurnoverTax({ turnover: 1_000_000, ratePercent: NaN });
    expect(nanRate.ok).toBe(false);
    const infRate = calculateTurnoverTax({ turnover: 1_000_000, ratePercent: Infinity });
    expect(infRate.ok).toBe(false);
  });

  it("enforces the explicit upper bound on supported turnover", () => {
    const tooLarge = calculateTurnoverTax({ turnover: MAX_SUPPORTED_VALUE + 1, ratePercent: 2 });
    expect(tooLarge.ok).toBe(false);
    if (tooLarge.ok) throw new Error("expected failure");
    expect(tooLarge.code).toBe("TURNOVER_TOO_LARGE");

    const atLimit = calculateTurnoverTax({ turnover: MAX_SUPPORTED_VALUE, ratePercent: 2 });
    expect(atLimit.ok).toBe(true);
  });

  it("rejects a mathematically nonsensical rate above 100%, but allows exactly 100%", () => {
    const tooLarge = calculateTurnoverTax({ turnover: 1_000_000, ratePercent: 100.01 });
    expect(tooLarge.ok).toBe(false);
    if (tooLarge.ok) throw new Error("expected failure");
    expect(tooLarge.code).toBe("RATE_TOO_LARGE");

    const atLimit = calculateTurnoverTax({ turnover: 1_000_000, ratePercent: 100 });
    expect(atLimit.ok).toBe(true);
  });

  it("does NOT hard-block a rate outside the typical 1-4% range — soft warning only (preferential regimes exist)", () => {
    const below = calculateTurnoverTax({ turnover: 10_000_000, ratePercent: 0.5 });
    expect(below.ok).toBe(true);
    if (!below.ok) throw new Error("expected ok result");
    expect(below.rateOutOfTypicalRange).toBe(true);
    expect(below.taxAmount).toBe("50000.00");

    const above = calculateTurnoverTax({ turnover: 10_000_000, ratePercent: 6 });
    expect(above.ok).toBe(true);
    if (!above.ok) throw new Error("expected ok result");
    expect(above.rateOutOfTypicalRange).toBe(true);
    expect(above.taxAmount).toBe("600000.00");
  });

  it("marks the boundaries of the typical range (1% and 4%) as within range, not out of range", () => {
    const atMin = calculateTurnoverTax({ turnover: 1_000_000, ratePercent: TYPICAL_RATE_MIN });
    expect(atMin.ok).toBe(true);
    if (!atMin.ok) throw new Error("expected ok result");
    expect(atMin.rateOutOfTypicalRange).toBe(false);

    const atMax = calculateTurnoverTax({ turnover: 1_000_000, ratePercent: TYPICAL_RATE_MAX });
    expect(atMax.ok).toBe(true);
    if (!atMax.ok) throw new Error("expected ok result");
    expect(atMax.rateOutOfTypicalRange).toBe(false);
  });

  it("avoids floating point artifacts that plain JS multiplication/division would produce", () => {
    // Native JS: 99999999.99 * 1.01 / 100 = 1009999.9998989999 (visible float noise).
    const result = calculateTurnoverTax({ turnover: 99_999_999.99, ratePercent: 1.01 });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok result");
    expect(result.taxAmount).toBe("1010000.00");
  });
});

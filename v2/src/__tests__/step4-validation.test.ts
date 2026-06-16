import { describe, it, expect } from "vitest";

// Unit test for Step4 accruals validation logic
// (from src/app/closing/steps/Step4Accruals.tsx handleSubmit)

function validateAccruals(
  salaryAmount: string,
  depreciationAmount: string,
  rentAmount: string
): string | null {
  const sal = parseFloat(salaryAmount) || 0;
  const dep = parseFloat(depreciationAmount) || 0;
  const ren = parseFloat(rentAmount) || 0;
  if (sal < 0 || dep < 0 || ren < 0) {
    return "Суммы начислений не могут быть отрицательными";
  }
  return null;
}

describe("Step4 accruals: negative amount validation", () => {
  it("accepts zero values", () => {
    expect(validateAccruals("0", "0", "0")).toBeNull();
  });

  it("accepts positive values", () => {
    expect(validateAccruals("50000", "10000", "5000")).toBeNull();
  });

  it("accepts empty strings (parsed as 0)", () => {
    expect(validateAccruals("", "", "")).toBeNull();
  });

  it("rejects negative salary", () => {
    expect(validateAccruals("-1", "0", "0")).toBe(
      "Суммы начислений не могут быть отрицательными"
    );
  });

  it("rejects negative depreciation", () => {
    expect(validateAccruals("0", "-100", "0")).toBe(
      "Суммы начислений не могут быть отрицательными"
    );
  });

  it("rejects negative rent", () => {
    expect(validateAccruals("0", "0", "-5000")).toBe(
      "Суммы начислений не могут быть отрицательными"
    );
  });

  it("rejects when all three are negative", () => {
    expect(validateAccruals("-1", "-2", "-3")).toBe(
      "Суммы начислений не могут быть отрицательными"
    );
  });

  it("accepts mixed large positive values", () => {
    expect(validateAccruals("1000000", "250000", "300000")).toBeNull();
  });
});

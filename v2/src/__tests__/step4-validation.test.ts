import { describe, it, expect } from "vitest";
import { closingAccrualsSchema } from "@/lib/closingInput";

function validateAccruals(
  salaryAmount: string,
  depreciationAmount: string,
  rentAmount: string
): string | null {
  const parsed = closingAccrualsSchema.safeParse({ salaryAmount, depreciationAmount, rentAmount, expenseAccountCode: "9420" });
  return parsed.success ? null : parsed.error.issues[0].message;
}

describe("Step4 accruals: negative amount validation", () => {
  it("accepts zero values", () => {
    expect(validateAccruals("0", "0", "0")).toBeNull();
  });

  it("accepts positive values", () => {
    expect(validateAccruals("50000", "10000", "5000")).toBeNull();
  });

  it("rejects empty strings instead of silently saving zero", () => {
    expect(validateAccruals("", "", "")).not.toBeNull();
  });

  it("rejects negative salary", () => {
    expect(validateAccruals("-1", "0", "0")).toMatch(/неотрицательное/);
  });

  it("rejects negative depreciation", () => {
    expect(validateAccruals("0", "-100", "0")).toMatch(/неотрицательное/);
  });

  it("rejects negative rent", () => {
    expect(validateAccruals("0", "0", "-5000")).toMatch(/неотрицательное/);
  });

  it("rejects when all three are negative", () => {
    expect(validateAccruals("-1", "-2", "-3")).toMatch(/неотрицательное/);
  });

  it("accepts mixed large positive values", () => {
    expect(validateAccruals("1000000", "250000", "300000")).toBeNull();
  });
});

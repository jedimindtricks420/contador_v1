import { describe, it, expect } from "vitest";

// Isolated unit test for the HISTORICAL mode auto-detection logic
// (extracted from /api/import/bank/route.ts)

function determinePeriodMode(year: number, month: number, now: Date): "ACTIVE" | "HISTORICAL" {
  const isPast =
    year < now.getFullYear() ||
    (year === now.getFullYear() && month < now.getMonth() + 1);
  return isPast ? "HISTORICAL" : "ACTIVE";
}

describe("Bank import: HISTORICAL mode auto-detection", () => {
  it("marks past year as HISTORICAL", () => {
    const now = new Date("2024-06-15");
    expect(determinePeriodMode(2023, 1, now)).toBe("HISTORICAL");
    expect(determinePeriodMode(2023, 12, now)).toBe("HISTORICAL");
  });

  it("marks previous months in same year as HISTORICAL", () => {
    const now = new Date("2024-06-15");
    expect(determinePeriodMode(2024, 1, now)).toBe("HISTORICAL");
    expect(determinePeriodMode(2024, 5, now)).toBe("HISTORICAL");
  });

  it("marks current month as ACTIVE", () => {
    const now = new Date("2024-06-15");
    expect(determinePeriodMode(2024, 6, now)).toBe("ACTIVE");
  });

  it("marks future months as ACTIVE", () => {
    const now = new Date("2024-06-15");
    expect(determinePeriodMode(2024, 7, now)).toBe("ACTIVE");
    expect(determinePeriodMode(2024, 12, now)).toBe("ACTIVE");
    expect(determinePeriodMode(2025, 1, now)).toBe("ACTIVE");
  });

  it("handles January boundary correctly", () => {
    const now = new Date("2024-01-01");
    expect(determinePeriodMode(2024, 1, now)).toBe("ACTIVE");
    expect(determinePeriodMode(2023, 12, now)).toBe("HISTORICAL");
  });
});

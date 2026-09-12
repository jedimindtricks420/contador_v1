import { describe, expect, it } from "vitest";
import { InvalidReportPeriod, reportPeriod } from "@/lib/reports/reportPeriod";

describe("financial report calendar boundaries", () => {
  it("includes the entire final day in Tashkent with an exclusive upper bound", () => {
    const period = reportPeriod("2026-09-01", "2026-09-30");
    expect(period.startDate.toISOString()).toBe("2026-08-31T19:00:00.000Z");
    expect(period.endExclusive.toISOString()).toBe("2026-09-30T19:00:00.000Z");
    expect(period.endDate.toISOString()).toBe("2026-09-30T18:59:59.999Z");
    expect(period.months).toEqual(["2026-09"]);
  });

  it("accepts leap day and generates months across a year boundary", () => {
    expect(reportPeriod("2023-12-31", "2024-02-29").months).toEqual(["2023-12", "2024-01", "2024-02"]);
    expect(reportPeriod("2024-02-29", "2024-02-29").endExclusive.toISOString()).toBe("2024-02-29T19:00:00.000Z");
  });

  it("defaults to the current accounting year, independently of the host timezone", () => {
    const period = reportPeriod(null, null, new Date("2025-12-31T20:00:00Z"));
    expect(period.months).toHaveLength(12);
    expect(period.months[0]).toBe("2026-01");
    expect(period.months[11]).toBe("2026-12");
  });

  it.each(["2026-02-29", "2026-04-31", "2026-13-01", "", "2026-9-1", "2026-09-01T00:00:00Z"])("rejects invalid calendar input %s", (date) => {
    expect(() => reportPeriod(date, "2026-12-31")).toThrow(InvalidReportPeriod);
    expect(() => reportPeriod("2026-01-01", date)).toThrow(InvalidReportPeriod);
  });

  it("rejects a reversed range", () => {
    expect(() => reportPeriod("2026-10-01", "2026-09-30")).toThrow(InvalidReportPeriod);
  });

  it("stops month generation at the maximum four-digit year", () => {
    expect(reportPeriod("9999-12-01", "9999-12-31").months).toEqual(["9999-12"]);
  });
});
import Decimal from "decimal.js";
import { describe, expect, it, vi } from "vitest";
import { computeCumulativeNetProfit, upsertTaxCalendarEventsForPeriod } from "@/lib/closing";
import { tashkentDate } from "@/lib/accountingDate";

vi.mock("@/lib/prisma", () => ({ default: {} }));

describe("closing ledger calculations", () => {
  it.each([
    [2026, 0, 1, "2025-12-31T19:00:00.000Z"],
    [2024, 2, 0, "2024-02-28T19:00:00.000Z"],
    [2026, 2, 0, "2026-02-27T19:00:00.000Z"],
    [2026, 12, 20, "2027-01-19T19:00:00.000Z"],
  ] as const)("constructs Tashkent date %i/%i/%i independently of host timezone", (year, monthIndex, day, expected) => {
    expect(tashkentDate(year, monthIndex, day).toISOString()).toBe(expected);
  });

  it("updates turnover tax from posted business net revenue only", async () => {
    const transaction = {
      period: { findUnique: vi.fn().mockResolvedValue({
        year: 2026, month: 9, org: { taxRegime: "TURNOVER_TAX", turnoverTaxRate: "0.04" },
      }) },
      journalEntry: { findMany: vi.fn().mockResolvedValue([
        { debit: new Decimal(20), credit: new Decimal(100) },
      ]) },
      taxCalendarEvent: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn() },
    };
    await upsertTaxCalendarEventsForPeriod("period", "org", transaction);
    const query = transaction.journalEntry.findMany.mock.calls[0][0];
    expect(query.where.document).toEqual({
      orgId: "org", periodId: "period", status: "POSTED",
      type: { code: { notIn: ["PERIOD_CLOSING", "YEAR_END_CLOSE"] } },
    });
    const event = transaction.taxCalendarEvent.create.mock.calls[0][0].data;
    expect(event.estimatedAmount.toString()).toBe("3.2");
    expect(event.dueDate.toISOString()).toBe("2026-10-19T19:00:00.000Z");
  });

  it("uses net turnover for revenue, expenses and both FX sides", async () => {
    const journalEntry = { findMany: vi.fn()
      .mockResolvedValueOnce([{ credit: new Decimal(100), debit: new Decimal(20) }])
      .mockResolvedValueOnce([{ credit: new Decimal(30), debit: new Decimal(5) }])
      .mockResolvedValueOnce([{ credit: new Decimal(10), debit: new Decimal(2) }])
      .mockResolvedValueOnce([{ credit: new Decimal(1), debit: new Decimal(4) }])
      .mockResolvedValueOnce([{ credit: new Decimal(10), debit: new Decimal(50) }]),
    };
    const from = new Date("2025-12-31T19:00:00Z");
    const to = new Date("2026-03-31T18:59:59.999Z");
    expect((await computeCumulativeNetProfit("org", from, to, { journalEntry })).toString()).toBe("70");
    for (const [query] of journalEntry.findMany.mock.calls) {
      expect(query.where.document).toEqual({
        orgId: "org", status: "POSTED", date: { gte: from, lte: to },
        type: { code: { notIn: ["PERIOD_CLOSING"] } },
      });
    }
  });
});
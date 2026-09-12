import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/pnl/route";

const { database } = vi.hoisted(() => ({
  database: {
    organization: { findUnique: vi.fn() }, $queryRaw: vi.fn(),
    period: { findMany: vi.fn() }, taxCalendarEvent: { findMany: vi.fn() }
  }
}));
vi.mock("@/lib/prisma", () => ({ default: database }));
vi.mock("@/lib/context", () => ({ getActiveOrgId: vi.fn().mockResolvedValue("org-report") }));

type Row = { code: string; sumDebit: string; sumCredit: string };
async function report(rows: Row[]) {
  database.$queryRaw.mockResolvedValueOnce(rows)
    .mockResolvedValueOnce(rows.map((row) => ({ ...row, month: "2026-09" })));
  const response = await GET(new NextRequest("http://localhost/api/pnl?from=2026-09-01&to=2026-09-30"));
  expect(response.status).toBe(200);
  return response.json();
}

describe("P&L agrees with ledger and monthly totals", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    database.organization.findUnique.mockResolvedValue({ taxRegime: "VAT" });
    database.period.findMany.mockResolvedValue([{ id: "period", year: 2026, month: 9 }]);
    database.taxCalendarEvent.findMany.mockResolvedValue([{ estimatedAmount: "99" }]);
  });

  it.each([
    ["0", "15", -15, 15],
    ["15", "15", 0, 0],
    ["15", "0", 15, -15]
  ])("keeps tax debit %s minus credit %s without calendar substitution", async (debit, credit, tax, profit) => {
    const result = await report([{ code: "9810", sumDebit: String(debit), sumCredit: String(credit) }]);
    expect(result.lines.line250).toBe(tax);
    expect(result.lines.line270).toBe(profit);
    expect(result.monthlyNetProfit).toEqual([profit]);
    expect(database.taxCalendarEvent.findMany).not.toHaveBeenCalled();
  });

  it("does not invent a tax expense when only a calendar estimate exists", async () => {
    const result = await report([]);
    expect(result.lines.line250).toBe(0);
    expect(result.lines.line270).toBe(0);
    expect(database.taxCalendarEvent.findMany).not.toHaveBeenCalled();
  });

  it.each([
    "from=2026-10-01&to=2026-09-30",
    "from=2026-02-29&to=2026-09-30",
    "from=2026-09-01&to=invalid",
  ])("rejects invalid report period before reading ledger: %s", async (query) => {
    const response = await GET(new NextRequest(`http://localhost/api/pnl?${query}`));
    expect(response.status).toBe(400);
    expect(database.$queryRaw).not.toHaveBeenCalled();
  });

  it("uses the same exclusive day boundary for totals and months", async () => {
    await report([]);
    for (const [query, orgId, startDate, endExclusive] of database.$queryRaw.mock.calls) {
      expect(orgId).toBe("org-report");
      expect(startDate.toISOString()).toBe("2026-08-31T19:00:00.000Z");
      expect(endExclusive.toISOString()).toBe("2026-09-30T19:00:00.000Z");
      expect(query.join("?")).toMatch(/d\.date\s*<\s*\?/);
    }
    expect(database.$queryRaw.mock.calls[1][0].join("?")).toContain("AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tashkent'");
  });

  it.each([
    ["9010", "line010", 1], ["9020", "line010", 1], ["9030", "line010", 1],
    ["9040", "line010", 1], ["9050", "line010", 1],
    ["9110", "line020", -1], ["9120", "line020", -1], ["9130", "line020", -1],
    ["9410", "line050", -1], ["9420", "line060", -1], ["9430", "line070", -1],
    ["9310", "line090", 1], ["9320", "line090", 1], ["9330", "line090", 1],
    ["9520", "line120", 1], ["9530", "line130", 1], ["9550", "line140", 1],
    ["9540", "line150", 1], ["9510", "line160", 1],
    ["9610", "line180", -1], ["9620", "line200", -1], ["9630", "line210", -1],
    ["9710", "line230", 1], ["9720", "line230", 1], ["9820", "line260", -1]
  ] as const)("nets both sides of %s into %s and the monthly result", async (code, line, direction) => {
    const result = await report([{ code, sumDebit: "40", sumCredit: "100" }]);
    expect(result.lines[line]).toBe(60 * direction);
    expect(result.lines.line270).toBe(60);
    expect(result.monthlyNetProfit).toEqual([60]);
  });

  it("reconciles a sale correction, returned goods and expense reversal", async () => {
    const result = await report([
      { code: "9030", sumDebit: "200", sumCredit: "1000" },
      { code: "9120", sumDebit: "500", sumCredit: "100" },
      { code: "9420", sumDebit: "100", sumCredit: "20" },
      { code: "9810", sumDebit: "0", sumCredit: "15" }
    ]);
    expect(result.lines).toMatchObject({ line010: 800, line020: 400, line060: 80, line250: -15, line270: 335 });
    expect(result.monthlyRevenue).toEqual([800]);
    expect(result.monthlyNetProfit).toEqual([335]);
  });

  it("reports a disposal loss as operating expense without reducing other income", async () => {
    const result = await report([
      { code: "9430", sumDebit: "60", sumCredit: "0" },
      { code: "9210", sumDebit: "60", sumCredit: "60" },
    ]);
    expect(result.lines).toMatchObject({ line070: 60, line090: 0, line270: -60 });
    expect(result.monthlyNetProfit).toEqual([-60]);
  });
});
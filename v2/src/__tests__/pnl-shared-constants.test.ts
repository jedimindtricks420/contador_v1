/**
 * Regression: line010 (revenue) and line020 (COGS) of Форма №2 (pnl/route.ts) must
 * be computed from the SAME REVENUE_ACCOUNT_CODES / COGS_ACCOUNT_CODES constants
 * that closing.ts uses for tax calculations — not a separately hand-copied list of
 * account codes that can silently drift out of sync.
 *
 * This test imports the constants directly (same module the route imports) and
 * builds its mocked ledger rows FROM them, rather than hardcoding "9010" etc itself
 * — so if a code is ever added to/removed from the constant, this test keeps
 * validating the real current set without needing to be edited.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { REVENUE_ACCOUNT_CODES, COGS_ACCOUNT_CODES } from "@/lib/constants";

const mockGetActiveOrgId = vi.fn().mockResolvedValue("org-1");
vi.mock("@/lib/context", () => ({ getActiveOrgId: mockGetActiveOrgId }));

const mockPrisma: any = {
  organization: { findUnique: vi.fn().mockResolvedValue({ taxRegime: "VAT", turnoverTaxRate: 0.04 }) },
  period: { findMany: vi.fn().mockResolvedValue([]) },
  taxCalendarEvent: { findMany: vi.fn().mockResolvedValue([]) },
  $queryRaw: vi.fn(),
};
vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));

describe("GET /api/pnl — line010/line020 use REVENUE_ACCOUNT_CODES/COGS_ACCOUNT_CODES", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sums exactly the codes currently in REVENUE_ACCOUNT_CODES into line010, and COGS_ACCOUNT_CODES into line020", async () => {
    mockPrisma.organization.findUnique.mockResolvedValue({ taxRegime: "VAT", turnoverTaxRate: 0.04 });
    mockPrisma.period.findMany.mockResolvedValue([]);

    // One row per revenue code (credit 1,000,000 each) + one per COGS code (debit
    // 200,000 each) + one unrelated "9990" row that must NOT be picked up by either.
    const revenueRows = REVENUE_ACCOUNT_CODES.map((code) => ({ code, sumDebit: "0", sumCredit: "1000000" }));
    const cogsRows = COGS_ACCOUNT_CODES.map((code) => ({ code, sumDebit: "200000", sumCredit: "0" }));
    const noiseRow = { code: "9990", sumDebit: "999999", sumCredit: "999999" };

    // First $queryRaw call = the whole-period aggregate; second = monthly breakdown.
    mockPrisma.$queryRaw
      .mockResolvedValueOnce([...revenueRows, ...cogsRows, noiseRow])
      .mockResolvedValueOnce([]);

    const { GET } = await import("@/app/api/pnl/route");
    const req = new NextRequest("http://localhost/api/pnl?from=2026-01-01&to=2026-01-31");
    const res = await GET(req);
    const data = await res.json();

    const expectedRevenue = REVENUE_ACCOUNT_CODES.length * 1_000_000;
    const expectedCogs = COGS_ACCOUNT_CODES.length * 200_000;

    expect(data.lines.line010).toBe(expectedRevenue);
    expect(data.lines.line020).toBe(expectedCogs);
    expect(data.lines.line030).toBe(expectedRevenue - expectedCogs);
  });
});

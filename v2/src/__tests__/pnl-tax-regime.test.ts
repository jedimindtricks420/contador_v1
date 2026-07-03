import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockGetActiveOrgId = vi.fn().mockResolvedValue("org-1");
vi.mock("@/lib/context", () => ({ getActiveOrgId: mockGetActiveOrgId }));

const mockPrisma = {
  organization: {
    findUnique: vi.fn(),
  },
  journalEntry: {
    findMany: vi.fn(),
  },
  taxCalendarEvent: {
    findMany: vi.fn(),
  },
  period: {
    findMany: vi.fn(),
  },
  $queryRaw: vi.fn(),
};
vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));

describe("GET /api/pnl — taxRegime field", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.journalEntry.findMany.mockResolvedValue([]);
    mockPrisma.taxCalendarEvent.findMany.mockResolvedValue([]);
    mockPrisma.period.findMany.mockResolvedValue([]);
    mockPrisma.$queryRaw.mockResolvedValue([]);
  });

  it("includes taxRegime=VAT in response for VAT org", async () => {
    mockPrisma.organization.findUnique.mockResolvedValue({ taxRegime: "VAT" });

    const { GET } = await import("@/app/api/pnl/route");
    const req = new NextRequest(
      "http://localhost/api/pnl?from=2024-01-01&to=2024-12-31"
    );

    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.taxRegime).toBe("VAT");
  });

  it("includes taxRegime=TURNOVER_TAX in response for USN org", async () => {
    mockPrisma.organization.findUnique.mockResolvedValue({
      taxRegime: "TURNOVER_TAX",
    });

    const { GET } = await import("@/app/api/pnl/route");
    const req = new NextRequest(
      "http://localhost/api/pnl?from=2024-01-01&to=2024-12-31"
    );

    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.taxRegime).toBe("TURNOVER_TAX");
  });

  it("defaults to TURNOVER_TAX when org has no taxRegime field", async () => {
    mockPrisma.organization.findUnique.mockResolvedValue({ taxRegime: null });

    const { GET } = await import("@/app/api/pnl/route");
    const req = new NextRequest(
      "http://localhost/api/pnl?from=2024-01-01&to=2024-12-31"
    );

    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.taxRegime).toBe("TURNOVER_TAX");
  });

  it("response contains months, monthlyRevenue, monthlyNetProfit arrays and NSBU line items", async () => {
    // Note: the API contract is `lines.lineXXX` (NSBU report line items) plus
    // monthly arrays — there is no top-level revenue/expenses/profitBeforeTax.
    mockPrisma.organization.findUnique.mockResolvedValue({ taxRegime: "VAT" });

    const { GET } = await import("@/app/api/pnl/route");
    const req = new NextRequest(
      "http://localhost/api/pnl?from=2024-01-01&to=2024-03-31"
    );

    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.months)).toBe(true);
    expect(body.months).toHaveLength(3); // Jan, Feb, Mar
    expect(Array.isArray(body.monthlyRevenue)).toBe(true);
    expect(Array.isArray(body.monthlyNetProfit)).toBe(true);
    expect(typeof body.lines).toBe("object");
  });
});

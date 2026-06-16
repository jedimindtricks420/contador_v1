import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockGetActiveOrgId = vi.fn().mockResolvedValue("org-1");
vi.mock("@/lib/context", () => ({ getActiveOrgId: mockGetActiveOrgId }));

const mockPrisma = {
  period: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
  },
  stagedTransaction: {
    count: vi.fn(),
  },
  document: {
    count: vi.fn(),
    findFirst: vi.fn(),
  },
  bankAccount: {
    findMany: vi.fn(),
  },
  taxCalendarEvent: {
    findMany: vi.fn(),
  },
  openItem: {
    findMany: vi.fn(),
    count: vi.fn(),
  },
  $queryRaw: vi.fn(),
};
vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));

function setupDefaults() {
  mockPrisma.period.findFirst.mockResolvedValue(null);
  mockPrisma.period.findMany.mockResolvedValue([]);
  mockPrisma.stagedTransaction.count.mockResolvedValue(0);
  mockPrisma.document.count.mockResolvedValue(0);
  mockPrisma.document.findFirst.mockResolvedValue(null);
  mockPrisma.bankAccount.findMany.mockResolvedValue([]);
  mockPrisma.taxCalendarEvent.findMany.mockResolvedValue([]);
  mockPrisma.openItem.findMany.mockResolvedValue([]);
  mockPrisma.openItem.count.mockResolvedValue(0);
  mockPrisma.$queryRaw.mockResolvedValue([]);
}

describe("GET /api/dashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaults();
  });

  it("returns allPeriods array in response", async () => {
    const periods = [
      { id: "p1", year: 2024, month: 6, status: "OPEN", mode: "ACTIVE" },
      { id: "p2", year: 2024, month: 5, status: "CLOSED", mode: "ACTIVE" },
    ];
    mockPrisma.period.findMany.mockResolvedValue(periods);

    const { GET } = await import("@/app/api/dashboard/route");
    const req = new NextRequest("http://localhost/api/dashboard");

    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.allPeriods)).toBe(true);
    expect(body.allPeriods).toHaveLength(2);
  });

  it("uses periodId param to look up specific period", async () => {
    const specificPeriod = {
      id: "p-specific",
      year: 2023,
      month: 3,
      status: "CLOSED",
      mode: "ACTIVE",
      orgId: "org-1",
    };
    mockPrisma.period.findFirst.mockResolvedValue(specificPeriod);
    mockPrisma.period.findMany.mockResolvedValue([specificPeriod]);

    const { GET } = await import("@/app/api/dashboard/route");
    const req = new NextRequest(
      "http://localhost/api/dashboard?periodId=p-specific"
    );

    const res = await GET(req);
    expect(res.status).toBe(200);
    // findFirst should have been called with the specific periodId
    const callArgs = mockPrisma.period.findFirst.mock.calls[0][0];
    expect(callArgs.where.id).toBe("p-specific");
  });

  it("returns null period and empty allPeriods for new user", async () => {
    const { GET } = await import("@/app/api/dashboard/route");
    const req = new NextRequest("http://localhost/api/dashboard");

    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.period).toBeNull();
    expect(body.allPeriods).toHaveLength(0);
  });

  it("returns closingChecklist and kpi fields", async () => {
    const { GET } = await import("@/app/api/dashboard/route");
    const req = new NextRequest("http://localhost/api/dashboard");

    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.closingChecklist)).toBe(true);
    expect(body.kpi).toBeDefined();
    expect(typeof body.kpi.totalBalance).toBe("string");
  });
});

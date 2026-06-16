import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockGetActiveOrgId = vi.fn().mockResolvedValue("org-1");
vi.mock("@/lib/context", () => ({ getActiveOrgId: mockGetActiveOrgId }));

const mockPrisma = {
  period: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
  },
};
vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));

describe("POST /api/periods", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when year or month is missing", async () => {
    const { POST } = await import("@/app/api/periods/route");
    const req = new NextRequest("http://localhost/api/periods", {
      method: "POST",
      body: JSON.stringify({ year: 2024 }), // missing month
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/обязательны/);
  });

  it("creates a new period with default ACTIVE mode", async () => {
    mockPrisma.period.findFirst.mockResolvedValue(null);
    const newPeriod = {
      id: "period-1",
      orgId: "org-1",
      year: 2024,
      month: 6,
      mode: "ACTIVE",
      status: "OPEN",
    };
    mockPrisma.period.create.mockResolvedValue(newPeriod);

    const { POST } = await import("@/app/api/periods/route");
    const req = new NextRequest("http://localhost/api/periods", {
      method: "POST",
      body: JSON.stringify({ year: 2024, month: 6 }),
    });

    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.mode).toBe("ACTIVE");
    expect(mockPrisma.period.create).toHaveBeenCalledWith({
      data: { orgId: "org-1", year: 2024, month: 6, mode: "ACTIVE", status: "OPEN" },
    });
  });

  it("creates a HISTORICAL period when mode is specified", async () => {
    mockPrisma.period.findFirst.mockResolvedValue(null);
    const historicalPeriod = {
      id: "period-2",
      orgId: "org-1",
      year: 2023,
      month: 3,
      mode: "HISTORICAL",
      status: "OPEN",
    };
    mockPrisma.period.create.mockResolvedValue(historicalPeriod);

    const { POST } = await import("@/app/api/periods/route");
    const req = new NextRequest("http://localhost/api/periods", {
      method: "POST",
      body: JSON.stringify({ year: 2023, month: 3, mode: "HISTORICAL" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.mode).toBe("HISTORICAL");
  });

  it("returns existing period instead of creating duplicate (idempotency)", async () => {
    const existingPeriod = {
      id: "period-existing",
      orgId: "org-1",
      year: 2024,
      month: 6,
      mode: "ACTIVE",
      status: "OPEN",
    };
    mockPrisma.period.findFirst.mockResolvedValue(existingPeriod);

    const { POST } = await import("@/app/api/periods/route");
    const req = new NextRequest("http://localhost/api/periods", {
      method: "POST",
      body: JSON.stringify({ year: 2024, month: 6 }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe("period-existing");
    expect(mockPrisma.period.create).not.toHaveBeenCalled();
  });
});

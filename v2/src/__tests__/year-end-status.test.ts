import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockGetActiveOrgId = vi.fn().mockResolvedValue("org-1");
vi.mock("@/lib/context", () => ({ getActiveOrgId: mockGetActiveOrgId }));

const mockPrisma = {
  period: { findFirst: vi.fn() },
  document: {
    findFirst: vi.fn(),
  },
};
vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));

describe("GET /api/closing/year-end/status", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockGetActiveOrgId.mockResolvedValue("org-1");
    mockPrisma.period.findFirst.mockResolvedValue({ id: "period-1", status: "CLOSED", month: 12 });
  });

  it("rejects a missing period rather than claiming a status", async () => {
    const { GET } = await import("@/app/api/closing/year-end/status/route");
    const req = new NextRequest("http://localhost/api/closing/year-end/status");

    const res = await GET(req);
    expect(res.status).toBe(400);
    expect(mockPrisma.period.findFirst).not.toHaveBeenCalled();
    expect(mockPrisma.document.findFirst).not.toHaveBeenCalled();
  });

  it("returns done:false when no year-end doc exists", async () => {
    mockPrisma.document.findFirst.mockResolvedValue(null);

    const { GET } = await import("@/app/api/closing/year-end/status/route");
    const req = new NextRequest(
      "http://localhost/api/closing/year-end/status?periodId=period-1"
    );

    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.done).toBe(false);
  });

  it("returns done:true when year-end doc exists", async () => {
    mockPrisma.document.findFirst.mockResolvedValue({ id: "doc-1" });

    const { GET } = await import("@/app/api/closing/year-end/status/route");
    const req = new NextRequest(
      "http://localhost/api/closing/year-end/status?periodId=period-1"
    );

    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.done).toBe(true);
    expect(mockPrisma.period.findFirst).toHaveBeenCalledWith({ where: { id: "period-1", orgId: "org-1" } });
    expect(mockPrisma.document.findFirst).toHaveBeenCalledWith({ where: {
      orgId: "org-1", periodId: "period-1", status: "POSTED", type: { code: "YEAR_END_CLOSE" },
    } });
  });

  it("returns 404 for an unknown or foreign period without reading documents", async () => {
    mockPrisma.period.findFirst.mockResolvedValue(null);
    const { GET } = await import("@/app/api/closing/year-end/status/route");
    const response = await GET(new NextRequest("http://localhost/api/closing/year-end/status?periodId=foreign"));
    expect(response.status).toBe(404);
    expect(mockPrisma.document.findFirst).not.toHaveBeenCalled();
  });

  it.each([{ status: "OPEN", month: 12 }, { status: "CLOSED", month: 11 }])
    ("does not report completion for $status month $month", async period => {
      mockPrisma.period.findFirst.mockResolvedValue(period);
      const { GET } = await import("@/app/api/closing/year-end/status/route");
      const response = await GET(new NextRequest("http://localhost/api/closing/year-end/status?periodId=period-1"));
      expect(await response.json()).toEqual({ done: false });
      expect(mockPrisma.document.findFirst).not.toHaveBeenCalled();
    });

  it.each(["FORBIDDEN", "NO_ACTIVE_ORG"])("refuses %s without reporting done:false", async message => {
    mockGetActiveOrgId.mockRejectedValue(new Error(message));
    const { GET } = await import("@/app/api/closing/year-end/status/route");
    const response = await GET(new NextRequest("http://localhost/api/closing/year-end/status?periodId=period-1"));
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: message });
    expect(mockPrisma.period.findFirst).not.toHaveBeenCalled();
    expect(mockPrisma.document.findFirst).not.toHaveBeenCalled();
  });
});

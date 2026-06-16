import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockGetActiveOrgId = vi.fn().mockResolvedValue("org-1");
vi.mock("@/lib/context", () => ({ getActiveOrgId: mockGetActiveOrgId }));

const mockPrisma = {
  document: {
    findFirst: vi.fn(),
  },
};
vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));

describe("GET /api/closing/year-end/status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns done:false when periodId is missing", async () => {
    const { GET } = await import("@/app/api/closing/year-end/status/route");
    const req = new NextRequest("http://localhost/api/closing/year-end/status");

    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.done).toBe(false);
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
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockGetActiveOrgId = vi.fn().mockResolvedValue("org-1");
vi.mock("@/lib/context", () => ({ getActiveOrgId: mockGetActiveOrgId }));

const mockClearClosingState = vi.fn();
vi.mock("@/lib/closing", () => ({ clearClosingState: mockClearClosingState }));

const mockPrisma = {
  period: { findFirst: vi.fn() },
  document: { findFirst: vi.fn() },
  $transaction: vi.fn(async (fn: any) => fn({
    document: { findMany: vi.fn().mockResolvedValue([]), deleteMany: vi.fn() },
    openItem: { deleteMany: vi.fn() },
    taxCalendarEvent: { deleteMany: vi.fn() },
    period: { update: vi.fn() },
  })),
};
vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));

describe("POST /api/periods/[id]/reopen — ClosingJob cleanup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.period.findFirst.mockResolvedValue({
      id: "period-1", orgId: "org-1", status: "CLOSED", month: 6,
    });
    mockPrisma.document.findFirst.mockResolvedValue(null);
  });

  it("awaits clearClosingState before responding — a rejection surfaces as a 500, not an unhandled rejection", async () => {
    mockClearClosingState.mockRejectedValue(new Error("ClosingJob table unavailable"));

    const { POST } = await import("@/app/api/periods/[id]/reopen/route");
    const req = new NextRequest("http://localhost/api/periods/period-1/reopen", { method: "POST" });

    const res = await POST(req, { params: Promise.resolve({ id: "period-1" }) });

    // If clearClosingState were fired without await, its rejection would not
    // be caught here and the route would incorrectly report success.
    expect(mockClearClosingState).toHaveBeenCalledWith("period-1", "org-1");
    expect(res.status).toBe(500);
  });

  it("clears ClosingJob and returns success on the happy path", async () => {
    mockClearClosingState.mockResolvedValue(undefined);

    const { POST } = await import("@/app/api/periods/[id]/reopen/route");
    const req = new NextRequest("http://localhost/api/periods/period-1/reopen", { method: "POST" });

    const res = await POST(req, { params: Promise.resolve({ id: "period-1" }) });

    expect(mockClearClosingState).toHaveBeenCalledWith("period-1", "org-1");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});

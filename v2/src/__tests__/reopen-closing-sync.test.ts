import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockGetActiveMembership = vi.fn().mockResolvedValue({ orgId: "org-1", userId: "user", role: "OWNER" });
vi.mock("@/lib/context", () => ({ getActiveMembership: mockGetActiveMembership }));

const mockClearClosingState = vi.fn();

const mockPrisma = {
  period: { findFirst: vi.fn() },
  document: { findFirst: vi.fn() },
  $transaction: vi.fn(async (fn: any) => fn({
    $queryRaw: vi.fn(),
    document: { findMany: vi.fn().mockResolvedValue([]), deleteMany: vi.fn() },
    openItem: { deleteMany: vi.fn() },
    taxCalendarEvent: { deleteMany: vi.fn() },
    period: { findFirst: mockPrisma.period.findFirst, update: vi.fn() },
    closingJob: { deleteMany: mockClearClosingState },
    auditLog: { create: vi.fn() },
  })),
};
vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));

describe("POST /api/periods/[id]/reopen — ClosingJob cleanup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.period.findFirst.mockReset().mockResolvedValueOnce({
      id: "period-1", orgId: "org-1", status: "CLOSED", year: 2026, month: 6,
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
    expect(mockClearClosingState).toHaveBeenCalledWith({ where: { periodId: "period-1", orgId: "org-1" } });
    expect(res.status).toBe(500);
  });

  it("clears ClosingJob and returns success on the happy path", async () => {
    mockClearClosingState.mockResolvedValue(undefined);

    const { POST } = await import("@/app/api/periods/[id]/reopen/route");
    const req = new NextRequest("http://localhost/api/periods/period-1/reopen", { method: "POST" });

    const res = await POST(req, { params: Promise.resolve({ id: "period-1" }) });

    expect(mockClearClosingState).toHaveBeenCalledWith({ where: { periodId: "period-1", orgId: "org-1" } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it("blocks reopening when a later period remains closed", async () => {
    mockPrisma.period.findFirst.mockResolvedValueOnce({ year: 2026, month: 9, status: "CLOSED" });
    const { POST } = await import("@/app/api/periods/[id]/reopen/route");
    const response = await POST(new NextRequest("http://localhost/api/periods/period-1/reopen", { method: "POST" }), {
      params: Promise.resolve({ id: "period-1" }),
    });
    expect(response.status).toBe(400);
    expect(mockClearClosingState).not.toHaveBeenCalled();
  });
});

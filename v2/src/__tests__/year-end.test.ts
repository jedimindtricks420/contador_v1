import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mocks must be before dynamic imports
const mockGetActiveOrgId = vi.fn().mockResolvedValue("org-1");
vi.mock("@/lib/context", () => ({ getActiveOrgId: mockGetActiveOrgId }));

const mockPrisma = {
  period: {
    findFirst: vi.fn(),
  },
  document: {
    findFirst: vi.fn(),
    create: vi.fn(),
  },
  documentType: {
    findUnique: vi.fn(),
    create: vi.fn(),
  },
  account: {
    findUnique: vi.fn(),
  },
  journalEntry: {
    createMany: vi.fn(),
  },
  $queryRaw: vi.fn(),
};
vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));

describe("POST /api/closing/year-end", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 404 when period not found", async () => {
    mockPrisma.period.findFirst.mockResolvedValue(null);

    const { POST } = await import("@/app/api/closing/year-end/route");
    const req = new NextRequest("http://localhost/api/closing/year-end", {
      method: "POST",
      body: JSON.stringify({ periodId: "period-1" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/не найден/);
  });

  it("returns 400 when period is not December", async () => {
    mockPrisma.period.findFirst.mockResolvedValue({
      id: "period-1",
      orgId: "org-1",
      month: 6,
      year: 2024,
      status: "CLOSED",
    });

    const { POST } = await import("@/app/api/closing/year-end/route");
    const req = new NextRequest("http://localhost/api/closing/year-end", {
      method: "POST",
      body: JSON.stringify({ periodId: "period-1" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/декабр/);
  });

  it("returns 400 when period is not CLOSED", async () => {
    mockPrisma.period.findFirst.mockResolvedValue({
      id: "period-1",
      orgId: "org-1",
      month: 12,
      year: 2024,
      status: "OPEN",
    });

    const { POST } = await import("@/app/api/closing/year-end/route");
    const req = new NextRequest("http://localhost/api/closing/year-end", {
      method: "POST",
      body: JSON.stringify({ periodId: "period-1" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/закрыт/);
  });

  it("returns 409 when year-end close already exists (idempotency)", async () => {
    mockPrisma.period.findFirst.mockResolvedValue({
      id: "period-1",
      orgId: "org-1",
      month: 12,
      year: 2024,
      status: "CLOSED",
    });
    mockPrisma.document.findFirst.mockResolvedValue({
      id: "doc-existing",
      typeId: "year-end-type",
    });

    const { POST } = await import("@/app/api/closing/year-end/route");
    const req = new NextRequest("http://localhost/api/closing/year-end", {
      method: "POST",
      body: JSON.stringify({ periodId: "period-1" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/уже выполнено/);
  });

  it("returns 200 with transferred=0 when 9910 balance is zero", async () => {
    mockPrisma.period.findFirst.mockResolvedValue({
      id: "period-1",
      orgId: "org-1",
      month: 12,
      year: 2024,
      status: "CLOSED",
    });
    mockPrisma.document.findFirst.mockResolvedValue(null);
    mockPrisma.$queryRaw.mockResolvedValue([{ net: "0" }]);

    const { POST } = await import("@/app/api/closing/year-end/route");
    const req = new NextRequest("http://localhost/api/closing/year-end", {
      method: "POST",
      body: JSON.stringify({ periodId: "period-1" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.transferred).toBe(0);
  });
});

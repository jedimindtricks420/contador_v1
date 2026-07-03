import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockGetActiveOrgId = vi.fn().mockResolvedValue("org-1");
vi.mock("@/lib/context", () => ({ getActiveOrgId: mockGetActiveOrgId }));

const mockPrisma = {
  rule: {
    findFirst: vi.fn(),
    create: vi.fn(),
  },
};
vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));

describe("POST /api/rules — duplicate prevention", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects a rule when one already exists for (orgId, matchType, matchValue)", async () => {
    // Regression test: this endpoint used to call prisma.rule.create() with no
    // existence check, which produced duplicate/conflicting classification
    // rules for the same counterparty in production.
    mockPrisma.rule.findFirst.mockResolvedValue({
      id: "existing-rule", orgId: "org-1", matchType: "INN", matchValue: "123456789",
    });

    const { POST } = await import("@/app/api/rules/route");
    const req = new NextRequest("http://localhost/api/rules", {
      method: "POST",
      body: JSON.stringify({ matchType: "INN", matchValue: "123456789", categoryId: "cat-1" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(409);
    expect(mockPrisma.rule.create).not.toHaveBeenCalled();
  });

  it("creates the rule when no existing match is found", async () => {
    mockPrisma.rule.findFirst.mockResolvedValue(null);
    mockPrisma.rule.create.mockResolvedValue({
      id: "new-rule", orgId: "org-1", matchType: "INN", matchValue: "987654321", categoryId: "cat-1",
    });

    const { POST } = await import("@/app/api/rules/route");
    const req = new NextRequest("http://localhost/api/rules", {
      method: "POST",
      body: JSON.stringify({ matchType: "INN", matchValue: "987654321", categoryId: "cat-1" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(201);
    expect(mockPrisma.rule.create).toHaveBeenCalled();
  });

  it("returns 409 (not 500) if the DB unique constraint catches a race", async () => {
    mockPrisma.rule.findFirst.mockResolvedValue(null);
    const dbError: any = new Error("Unique constraint failed");
    dbError.code = "P2002";
    mockPrisma.rule.create.mockRejectedValue(dbError);

    const { POST } = await import("@/app/api/rules/route");
    const req = new NextRequest("http://localhost/api/rules", {
      method: "POST",
      body: JSON.stringify({ matchType: "INN", matchValue: "555555555", categoryId: "cat-1" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(409);
  });
});

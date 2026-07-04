/**
 * Regression tests for POST /api/settings/charter-capital — first declaration,
 * funding-type variants, decrease rejection, increase confirmation requirement,
 * and the OWNER/ADMIN-only role check. The CAPITAL_CONTRIBUTION posting guard
 * itself is covered separately in charter-capital-posting-guard.test.ts, which
 * needs the real (unmocked) postingEngine.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import Decimal from "decimal.js";

const mockGetCharterCapitalDebt = vi.fn();
vi.mock("@/lib/charterCapital", () => ({ getCharterCapitalDebt: mockGetCharterCapitalDebt }));

const mockGetActiveOrgId = vi.fn().mockResolvedValue("org-1");
const mockGetActiveMembership = vi.fn().mockResolvedValue({ orgId: "org-1", userId: "user-1", role: "OWNER" });
vi.mock("@/lib/context", () => ({
  getActiveOrgId: mockGetActiveOrgId,
  getActiveMembership: mockGetActiveMembership,
}));
vi.mock("@/lib/posting/postingEngine", () => ({ postDocument: vi.fn().mockResolvedValue(undefined) }));

const mockPrisma: any = {
  organization: { findUnique: vi.fn(), update: vi.fn() },
  account: { findUnique: vi.fn() },
  period: { findFirst: vi.fn(), create: vi.fn() },
  documentType: { findUnique: vi.fn() },
  document: { create: vi.fn() },
  $transaction: vi.fn(async (fn: any) => fn(mockPrisma)),
};
vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));

function postReq(body: any) {
  return new NextRequest("http://localhost/api/settings/charter-capital", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/settings/charter-capital", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetActiveMembership.mockResolvedValue({ orgId: "org-1", userId: "user-1", role: "OWNER" });
    mockGetCharterCapitalDebt.mockResolvedValue(new Decimal(0));
    mockPrisma.period.findFirst.mockResolvedValue({ id: "period-1", year: 2026, month: 4, status: "OPEN" });
    mockPrisma.documentType.findUnique.mockResolvedValue({ id: "type-1", code: "OPENING_CAPITAL_DECLARATION" });
    mockPrisma.document.create.mockResolvedValue({ id: "doc-1" });
  });

  it("rejects non-owner/admin roles", async () => {
    mockGetActiveMembership.mockResolvedValue({ orgId: "org-1", userId: "user-1", role: "ACCOUNTANT" });
    const { POST } = await import("@/app/api/settings/charter-capital/route");
    const res = await POST(postReq({ amount: 10_000_000, fundingType: "NOT_PAID" }));
    expect(res.status).toBe(403);
  });

  it("rejects a missing/invalid amount", async () => {
    mockPrisma.organization.findUnique.mockResolvedValue({ id: "org-1", charterCapitalDeclaredAt: null });
    const { POST } = await import("@/app/api/settings/charter-capital/route");
    const res = await POST(postReq({ amount: 0, fundingType: "NOT_PAID" }));
    expect(res.status).toBe(400);
  });

  it("rejects PARTIALLY_PAID without paidAmount", async () => {
    mockPrisma.organization.findUnique.mockResolvedValue({ id: "org-1", charterCapitalDeclaredAt: null });
    const { POST } = await import("@/app/api/settings/charter-capital/route");
    const res = await POST(postReq({ amount: 10_000_000, fundingType: "PARTIALLY_PAID" }));
    expect(res.status).toBe(400);
  });

  it("rejects PAID_IN_KIND with an out-of-range account code", async () => {
    mockPrisma.organization.findUnique.mockResolvedValue({ id: "org-1", charterCapitalDeclaredAt: null });
    const { POST } = await import("@/app/api/settings/charter-capital/route");
    const res = await POST(postReq({ amount: 10_000_000, fundingType: "PAID_IN_KIND", paidAmount: 10_000_000, fundedAccountCode: "5110" }));
    expect(res.status).toBe(400);
  });

  it("creates the OPENING_CAPITAL_DECLARATION document on first declaration (NOT_PAID)", async () => {
    mockPrisma.organization.findUnique.mockResolvedValue({ id: "org-1", charterCapitalDeclaredAt: null });
    const { POST } = await import("@/app/api/settings/charter-capital/route");
    const res = await POST(postReq({ amount: 10_000_000, fundingType: "NOT_PAID" }));
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(mockPrisma.document.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          payload: expect.objectContaining({ amount: 10_000_000, fundingType: "NOT_PAID" }),
        }),
      })
    );
    expect(mockPrisma.organization.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ charterCapitalAmount: expect.anything() }) })
    );
    expect(data.success).toBe(true);
  });

  it("accepts PAID_IN_KIND with a valid asset account and forwards fundedAccountCode", async () => {
    mockPrisma.organization.findUnique.mockResolvedValue({ id: "org-1", charterCapitalDeclaredAt: null });
    mockPrisma.account.findUnique.mockResolvedValue({ id: "acc-1", code: "0110" });
    const { POST } = await import("@/app/api/settings/charter-capital/route");
    const res = await POST(postReq({ amount: 10_000_000, fundingType: "PAID_IN_KIND", paidAmount: 4_000_000, fundedAccountCode: "0110" }));
    expect(res.status).toBe(201);
    expect(mockPrisma.document.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          payload: expect.objectContaining({ fundedAccountCode: "0110", paidAmount: 4_000_000 }),
        }),
      })
    );
  });

  it("rejects a resubmission with the same amount", async () => {
    mockPrisma.organization.findUnique.mockResolvedValue({
      id: "org-1", charterCapitalDeclaredAt: new Date(), charterCapitalAmount: new Decimal(10_000_000),
    });
    const { POST } = await import("@/app/api/settings/charter-capital/route");
    const res = await POST(postReq({ amount: 10_000_000, fundingType: "NOT_PAID" }));
    expect(res.status).toBe(400);
    expect(mockPrisma.document.create).not.toHaveBeenCalled();
  });

  it("rejects a decrease — never automated", async () => {
    mockPrisma.organization.findUnique.mockResolvedValue({
      id: "org-1", charterCapitalDeclaredAt: new Date(), charterCapitalAmount: new Decimal(10_000_000),
    });
    const { POST } = await import("@/app/api/settings/charter-capital/route");
    const res = await POST(postReq({ amount: 5_000_000, fundingType: "NOT_PAID" }));
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.error).toMatch(/[Уу]меньшение/);
  });

  it("rejects an increase without registration confirmation", async () => {
    mockPrisma.organization.findUnique.mockResolvedValue({
      id: "org-1", charterCapitalDeclaredAt: new Date(), charterCapitalAmount: new Decimal(10_000_000),
    });
    const { POST } = await import("@/app/api/settings/charter-capital/route");
    const res = await POST(postReq({ amount: 15_000_000, fundingType: "NOT_PAID" }));
    expect(res.status).toBe(400);
    expect(mockPrisma.document.create).not.toHaveBeenCalled();
  });

  it("posts a correction document for just the difference on a confirmed increase", async () => {
    mockPrisma.organization.findUnique.mockResolvedValue({
      id: "org-1", charterCapitalDeclaredAt: new Date("2026-01-01"), charterCapitalAmount: new Decimal(10_000_000),
    });
    const { POST } = await import("@/app/api/settings/charter-capital/route");
    const res = await POST(postReq({
      amount: 15_000_000, fundingType: "NOT_PAID",
      confirmedRegistration: true, registrationDate: "2026-07-01",
    }));
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(mockPrisma.document.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          payload: expect.objectContaining({ amount: 5_000_000, confirmedRegistration: true }),
        }),
      })
    );
    expect(data.success).toBe(true);
  });
});

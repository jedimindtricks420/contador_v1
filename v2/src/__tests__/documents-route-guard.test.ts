/**
 * Regression: POST /api/documents (the generic manual-document endpoint used by
 * /documents/new) must reject OPENING_CAPITAL_DECLARATION. That type has stateful
 * business rules (once-only first declaration, no decrease, registration
 * confirmation for increases) and must keep Organization.charterCapitalAmount/
 * DeclaredAt in sync — all of that lives in POST /api/settings/charter-capital.
 * Creating it here would post real 4610/8330 entries while leaving
 * charterCapitalDeclaredAt null, permanently blocking the CAPITAL_CONTRIBUTION
 * guard from ever recognizing the debt it just created.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockGetActiveMembership = vi.fn().mockResolvedValue({ orgId: "org-1", userId: "user-1", role: "OWNER" });
vi.mock("@/lib/context", () => ({ getActiveMembership: mockGetActiveMembership }));
vi.mock("@/lib/posting/postingEngine", () => ({ postDocument: vi.fn().mockResolvedValue(undefined) }));

const mockPrisma: any = {
  period: { findFirst: vi.fn() },
  documentType: { findUnique: vi.fn() },
  document: { create: vi.fn() },
  $transaction: vi.fn(async (fn: any) => fn(mockPrisma)),
};
vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));

function postReq(body: any) {
  return new NextRequest("http://localhost/api/documents", { method: "POST", body: JSON.stringify(body) });
}

describe("POST /api/documents — OPENING_CAPITAL_DECLARATION guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.period.findFirst.mockResolvedValue({ id: "period-1", orgId: "org-1", status: "OPEN" });
  });

  it("rejects OPENING_CAPITAL_DECLARATION — must go through /api/settings/charter-capital", async () => {
    mockPrisma.documentType.findUnique.mockResolvedValue({ id: "type-1", code: "OPENING_CAPITAL_DECLARATION" });

    const { POST } = await import("@/app/api/documents/route");
    const res = await POST(postReq({ typeId: "type-1", periodId: "period-1", date: "2026-04-01", payload: { amount: 10_000_000, fundingType: "NOT_PAID" } }));

    expect(res.status).toBe(400);
    expect(mockPrisma.document.create).not.toHaveBeenCalled();
  });

  it("still allows other manual document types (e.g. DEPRECIATION_ACCRUAL) through", async () => {
    mockPrisma.documentType.findUnique.mockResolvedValue({ id: "type-2", code: "DEPRECIATION_ACCRUAL" });
    mockPrisma.document.create.mockResolvedValue({ id: "doc-1", status: "POSTED" });

    const { POST } = await import("@/app/api/documents/route");
    const res = await POST(postReq({ typeId: "type-2", periodId: "period-1", date: "2026-04-01", payload: { depreciationAmount: 100 } }));

    expect(res.status).toBe(201);
    expect(mockPrisma.document.create).toHaveBeenCalled();
  });
});

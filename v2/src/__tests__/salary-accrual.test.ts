/**
 * SALARY_ACCRUAL — gross salary + employer social tax must post to the account
 * matching the employee's function (COGS_PRODUCTION/EXPENSE_SALES/EXPENSE_ADMIN/
 * EXPENSE_OTHER), not always EXPENSE_ADMIN (9420) as before.
 *
 * 1. POST /api/closing/[periodId]/step/4/complete — rejects a missing/invalid
 *    expenseAccountCode when salaryAmount > 0, doesn't require it when salaryAmount
 *    is 0, and saves the valid choice into ClosingState.
 * 2. postDocument (real template engine, no mocks) — a SALARY_ACCRUAL document with
 *    payload.expenseAccountCode = "9110" actually posts its debit lines to 9110,
 *    not the old hardcoded 9420, and fails loudly if expenseAccountCode is missing.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockGetActiveOrgId = vi.fn().mockResolvedValue("org-1");
vi.mock("@/lib/context", () => ({ getActiveOrgId: mockGetActiveOrgId }));

const mockSaveClosingState = vi.fn().mockResolvedValue(undefined);
const mockGetClosingState = vi.fn().mockResolvedValue({});
vi.mock("@/lib/closing", () => ({
  saveClosingState: mockSaveClosingState,
  getClosingState: mockGetClosingState,
}));

const mockPrisma: any = {
  period: { findFirst: vi.fn() },
};
vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));

function completeReq(body: any) {
  return new NextRequest("http://localhost/api/closing/period-1/step/4/complete", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/closing/[periodId]/step/4/complete — SALARY_ACCRUAL function", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.period.findFirst.mockResolvedValue({ id: "period-1", orgId: "org-1", status: "OPEN" });
  });

  it("rejects a missing expenseAccountCode when salaryAmount > 0", async () => {
    const { POST } = await import("@/app/api/closing/[periodId]/step/[stepNumber]/complete/route");
    const res = await POST(completeReq({ salaryAmount: 5_000_000 }), { params: Promise.resolve({ periodId: "period-1", stepNumber: "4" }) });
    expect(res.status).toBe(400);
    expect(mockSaveClosingState).not.toHaveBeenCalled();
  });

  it("rejects an invalid expenseAccountCode (not one of the 4 function accounts)", async () => {
    const { POST } = await import("@/app/api/closing/[periodId]/step/[stepNumber]/complete/route");
    const res = await POST(
      completeReq({ salaryAmount: 5_000_000, expenseAccountCode: "5110" }),
      { params: Promise.resolve({ periodId: "period-1", stepNumber: "4" }) }
    );
    expect(res.status).toBe(400);
    expect(mockSaveClosingState).not.toHaveBeenCalled();
  });

  it("does not require expenseAccountCode when salaryAmount is 0", async () => {
    const { POST } = await import("@/app/api/closing/[periodId]/step/[stepNumber]/complete/route");
    const res = await POST(
      completeReq({ salaryAmount: 0, depreciationAmount: 100, rentAmount: 0 }),
      { params: Promise.resolve({ periodId: "period-1", stepNumber: "4" }) }
    );
    expect(res.status).toBe(200);
    expect(mockSaveClosingState).toHaveBeenCalled();
  });

  it("accepts a valid expenseAccountCode (COGS_PRODUCTION) and saves it", async () => {
    const { POST } = await import("@/app/api/closing/[periodId]/step/[stepNumber]/complete/route");
    const res = await POST(
      completeReq({ salaryAmount: 5_000_000, expenseAccountCode: "9110" }),
      { params: Promise.resolve({ periodId: "period-1", stepNumber: "4" }) }
    );
    expect(res.status).toBe(200);
    expect(mockSaveClosingState).toHaveBeenCalledWith(
      "period-1",
      expect.objectContaining({ accruals: expect.objectContaining({ expenseAccountCode: "9110", salaryAmount: 5_000_000 }) }),
      "org-1"
    );
  });
});

describe("postDocument — SALARY_ACCRUAL posts to the function-specific expense account", () => {
  const mockTx: any = {
    document: { findUnique: vi.fn(), update: vi.fn() },
    period: { findUnique: vi.fn() },
    organization: { findUnique: vi.fn() },
    counterparty: { findFirst: vi.fn(), create: vi.fn() },
    account: { findUnique: vi.fn() },
    journalEntry: { create: vi.fn() },
    auditLog: { create: vi.fn() },
  };

  function salaryDoc(payload: Record<string, unknown>) {
    return {
      id: "doc-1",
      orgId: "org-1",
      periodId: "period-1",
      status: "POSTED",
      payload,
      type: {
        code: "SALARY_ACCRUAL",
        postingTemplate: {
          lines: [
            { accountCode: "$expenseAccountCode", side: "debit", expression: "salaryAmount" },
            { accountCode: "6710", side: "credit", expression: "salaryAmount" },
          ],
        },
      },
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockTx.period.findUnique.mockResolvedValue({ id: "period-1", status: "OPEN", lockDate: null });
    mockTx.organization.findUnique.mockResolvedValue({ id: "org-1", isVatPayer: false, charterCapitalDeclaredAt: null });
    mockTx.journalEntry.create.mockResolvedValue({ id: "je-1" });
  });

  it("resolves $expenseAccountCode to 9110 when payload says COGS_PRODUCTION", async () => {
    mockTx.document.findUnique.mockResolvedValue(salaryDoc({ salaryAmount: 5_000_000, expenseAccountCode: "9110" }));
    mockTx.account.findUnique.mockImplementation(({ where }: any) =>
      Promise.resolve({ id: `acc-${where.code}`, code: where.code })
    );

    const { postDocument } = await import("@/lib/posting/postingEngine");
    await postDocument("doc-1", mockTx);

    const debitLineCall = mockTx.journalEntry.create.mock.calls.find((c: any) => Number(c[0].data.debit) > 0);
    expect(debitLineCall[0].data.accountId).toBe("acc-9110");
  });

  it("throws when expenseAccountCode is missing from payload (never silently falls back to 9420)", async () => {
    mockTx.document.findUnique.mockResolvedValue(salaryDoc({ salaryAmount: 5_000_000 }));

    const { postDocument } = await import("@/lib/posting/postingEngine");
    await expect(postDocument("doc-1", mockTx)).rejects.toThrow(/Некорректный счёт расхода/);
    expect(mockTx.journalEntry.create).not.toHaveBeenCalled();
  });

  it("throws when expenseAccountCode is a real account outside the 4 valid function codes (e.g. the bank account) — regression for the generic /api/documents bypass", async () => {
    mockTx.document.findUnique.mockResolvedValue(salaryDoc({ salaryAmount: 5_000_000, expenseAccountCode: "5110" }));
    // Account 5110 genuinely exists (it's the UZS bank account) — proves the guard
    // rejects it by business rule, not because the account lookup fails.
    mockTx.account.findUnique.mockImplementation(({ where }: any) =>
      Promise.resolve({ id: `acc-${where.code}`, code: where.code })
    );

    const { postDocument } = await import("@/lib/posting/postingEngine");
    await expect(postDocument("doc-1", mockTx)).rejects.toThrow(/Некорректный счёт расхода/);
    expect(mockTx.journalEntry.create).not.toHaveBeenCalled();
  });
});

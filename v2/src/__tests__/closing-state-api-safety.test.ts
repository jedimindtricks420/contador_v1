import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/closing/[periodId]/state/route";

const mocks = vi.hoisted(() => ({
  getActiveOrgId: vi.fn(), getClosingState: vi.fn(),
  period: { findFirst: vi.fn() }, document: { findMany: vi.fn() },
}));
vi.mock("@/lib/context", () => ({ getActiveOrgId: mocks.getActiveOrgId }));
vi.mock("@/lib/closing", () => ({ getClosingState: mocks.getClosingState }));
vi.mock("@/lib/prisma", () => ({ default: { period: mocks.period, document: mocks.document } }));

const period = { id: "current", orgId: "own", month: 1, year: 2026, status: "OPEN", mode: "STANDARD" };
const request = () => GET(new NextRequest("http://localhost/api/closing/current/state"), {
  params: Promise.resolve({ periodId: "current" }),
});

describe("closing state API amount preservation", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.getActiveOrgId.mockResolvedValue("own");
    mocks.period.findFirst.mockResolvedValue(period);
    mocks.getClosingState.mockResolvedValue({ currentStep: 5, accruals: {
      salaryAmount: 0, depreciationAmount: 0, rentAmount: 0, expenseAccountCode: "9420",
    } });
    mocks.document.findMany.mockResolvedValue([
      { status: "POSTED", type: { code: "SALARY_ACCRUAL" }, payload: { salaryAmount: 900 } },
      { status: "VOIDED", type: { code: "RENT_ACCRUAL" }, payload: { rentAmount: 700 } },
    ]);
  });
  afterEach(() => vi.restoreAllMocks());

  it.each(["OPEN", "CLOSED"])("preserves explicit zero accruals for a %s period without reading previous documents", async status => {
    mocks.period.findFirst.mockResolvedValue({ ...period, status });
    const stored = await mocks.getClosingState();
    const expected = structuredClone(stored);
    const response = await request();
    expect(response.status).toBe(200);
    expect((await response.json()).accruals).toEqual(expected.accruals);
    expect(stored).toEqual(expected);
    expect(mocks.period.findFirst).toHaveBeenCalledExactlyOnceWith({ where: { id: "current", orgId: "own" } });
    expect(mocks.document.findMany).not.toHaveBeenCalled();
    expect(mocks.getClosingState).toHaveBeenLastCalledWith("current", "own");
  });

  it("preserves decimal strings and the expense function", async () => {
    const accruals = { salaryAmount: "123.45", depreciationAmount: "0.00", rentAmount: "12.01", expenseAccountCode: "9410" };
    mocks.getClosingState.mockResolvedValue({ currentStep: 5, accruals });
    const response = await request();
    expect(response.status).toBe(200);
    expect((await response.json()).accruals).toEqual(accruals);
    expect(mocks.document.findMany).not.toHaveBeenCalled();
  });

  it("uses verified period metadata instead of a stored period field", async () => {
    mocks.getClosingState.mockResolvedValue({ currentStep: 1, period: { id: "foreign", status: "CLOSED" } });
    const response = await request();
    expect((await response.json()).period).toEqual({ id: "current", month: 1, year: 2026, status: "OPEN", mode: "STANDARD" });
  });

  it("does not read state for an unknown or foreign period", async () => {
    mocks.period.findFirst.mockResolvedValue(null);
    expect((await request()).status).toBe(404);
    expect(mocks.getClosingState).not.toHaveBeenCalled();
    expect(mocks.document.findMany).not.toHaveBeenCalled();
  });

  it.each(["FORBIDDEN", "NO_ACTIVE_ORG"])("rejects %s before querying state", async message => {
    mocks.getActiveOrgId.mockRejectedValue(new Error(message));
    expect((await request()).status).toBe(403);
    expect(mocks.period.findFirst).not.toHaveBeenCalled();
    expect(mocks.getClosingState).not.toHaveBeenCalled();
  });

  it("does not substitute defaults when stored state cannot be loaded", async () => {
    mocks.getClosingState.mockRejectedValue(new Error("unavailable"));
    const response = await request();
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "unavailable" });
  });
});
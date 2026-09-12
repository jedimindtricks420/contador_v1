import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/closing/[periodId]/step/[stepNumber]/complete/route";
import { PostingValidationError } from "@/lib/posting/errors";

const mocks = vi.hoisted(() => ({ membership: vi.fn(), period: vi.fn(), save: vi.fn(), get: vi.fn() }));
vi.mock("@/lib/context", () => ({ getActiveMembership: mocks.membership }));
vi.mock("@/lib/prisma", () => ({ default: { period: { findFirst: mocks.period } } }));
vi.mock("@/lib/closing", () => ({ saveClosingState: mocks.save, getClosingState: mocks.get }));

const accruals = { salaryAmount: "100.10", depreciationAmount: "10.01", rentAmount: "50", expenseAccountCode: "9420" };
const fxDiff = { exchangeRate: "12500.1234", difference: "-12.01" };

function submit(stepNumber: string, body: unknown) {
  return POST(new NextRequest("http://localhost/api/closing/period/step/complete", {
    method: "POST", body: JSON.stringify(body),
  }), { params: Promise.resolve({ periodId: "period", stepNumber }) });
}

describe("closing step financial input", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.membership.mockResolvedValue({ orgId: "org", userId: "user", role: "ACCOUNTANT" });
    mocks.period.mockResolvedValue({ id: "period", status: "OPEN" });
    mocks.get.mockResolvedValue({});
  });

  it.each([
    { step: "4", body: accruals, key: "accruals", value: { salaryAmount: 100.1, depreciationAmount: 10.01, rentAmount: 50, expenseAccountCode: "9420" } },
    { step: "5", body: fxDiff, key: "fxDiff", value: { exchangeRate: 12500.1234, difference: -12.01 } },
    { step: "5", body: { exchangeRate: 0, difference: 0 }, key: "fxDiff", value: { exchangeRate: 0, difference: 0 } },
  ])("saves step $step values and progress in one operation", async ({ step, body, key, value }) => {
    expect((await submit(step, body)).status).toBe(200);
    expect(mocks.save).toHaveBeenCalledExactlyOnceWith("period", { currentStep: Number(step) + 1, [key]: value }, "org");
  });

  const invalidMoney = ["", " ", "100abc", "1e3", "0x10", "1,20", "Infinity", "NaN", "1.001", "90071992547409.92", "70368744177664.01", null, true, {}, []];
  it.each(["salaryAmount", "depreciationAmount", "rentAmount", "difference"].flatMap(field =>
    invalidMoney.map(value => ({ field, value }))))("rejects invalid $field=$value without writes", async ({ field, value }) => {
    const step = field === "difference" ? "5" : "4";
    expect((await submit(step, { ...(step === "4" ? accruals : fxDiff), [field]: value })).status).toBe(400);
    expect(mocks.save).not.toHaveBeenCalled();
    expect(mocks.get).not.toHaveBeenCalled();
  });

  it.each(["salaryAmount", "depreciationAmount", "rentAmount"])("rejects negative %s", async field => {
    expect((await submit("4", { ...accruals, [field]: "-0.01" })).status).toBe(400);
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it.each(["", "1abc", "-1", "1e4", null, true, {}, "9007199254740992", "12500.123456789123456"])("rejects invalid rate %s", async value => {
    expect((await submit("5", { ...fxDiff, exchangeRate: value })).status).toBe(400);
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it.each([null, [], {}, { ...accruals, extra: true }, { ...accruals, expenseAccountCode: "5110" }])("rejects invalid accrual shape %s", async body => {
    expect((await submit("4", body)).status).toBe(400);
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it("requires a positive rate for a nonzero difference", async () => {
    expect((await submit("5", { exchangeRate: 0, difference: -1 })).status).toBe(400);
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it("returns a controlled refusal when currencies cannot be revalued", async () => {
    mocks.save.mockRejectedValue(new PostingValidationError("Unsupported currency"));
    const response = await submit("5", { exchangeRate: 0, difference: 0 });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Unsupported currency" });
    expect(mocks.get).not.toHaveBeenCalled();
  });

  it("allows explicit zero accruals without an employee function", async () => {
    expect((await submit("4", { salaryAmount: 0, depreciationAmount: 0, rentAmount: 0, expenseAccountCode: "" })).status).toBe(200);
  });
});
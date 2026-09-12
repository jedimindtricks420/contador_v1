import { beforeEach, describe, expect, it, vi } from "vitest";
import { finalizePeriod, getClosingState, saveClosingState } from "@/lib/closing";
import type { Prisma } from "@prisma/client";

const { transaction, prisma } = vi.hoisted(() => {
  const transaction = {
    $queryRaw: vi.fn(), period: { findFirst: vi.fn() },
    closingJob: { findUnique: vi.fn(), upsert: vi.fn() },
    stagedTransaction: { count: vi.fn() },
    soliqImportBatch: { count: vi.fn() },
    bankAccount: { findFirst: vi.fn() },
  };
  return { transaction, prisma: { $transaction: vi.fn() } };
});
vi.mock("@/lib/prisma", () => ({ default: prisma }));

describe("period closing safety", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    prisma.$transaction.mockImplementation(async (callback) => callback(transaction));
    transaction.period.findFirst.mockResolvedValue({
      id: "period", orgId: "org", status: "OPEN", lockDate: null, org: {},
    });
    transaction.closingJob.findUnique.mockResolvedValue(null);
    transaction.stagedTransaction.count.mockResolvedValue(1);
    transaction.soliqImportBatch.count.mockResolvedValue(0);
    transaction.bankAccount.findFirst.mockResolvedValue(null);
  });

  it("locks the tenant period before reading state and blocks unprocessed bank rows", async () => {
    await expect(finalizePeriod("period", "org", "user")).rejects.toThrow(/операций не обработаны/);
    expect(transaction.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(transaction.period.findFirst.mock.invocationCallOrder[0]);
    expect(transaction.$queryRaw.mock.calls[0].slice(1)).toEqual(["period", "org"]);
    expect(transaction.period.findFirst).toHaveBeenCalledWith({ where: { id: "period", orgId: "org" }, include: { org: true } });
    expect(transaction.stagedTransaction.count).toHaveBeenCalledWith({
      where: { orgId: "org", periodId: "period", status: { in: ["IMPORTED", "NEEDS_CLARIFICATION"] } },
    });
    expect(transaction.closingJob.upsert).not.toHaveBeenCalled();
  });

  it("blocks pending Soliq batches before any closing writes", async () => {
    transaction.stagedTransaction.count.mockResolvedValue(0);
    transaction.soliqImportBatch.count.mockResolvedValue(1);
    await expect(finalizePeriod("period", "org", "user")).rejects.toThrow(/пакетов Soliq не проведены/);
    expect(transaction.soliqImportBatch.count).toHaveBeenCalledWith({
      where: { orgId: "org", periodId: "period", status: "READY" },
    });
    expect(transaction.closingJob.upsert).not.toHaveBeenCalled();
  });

  it("rejects a foreign or missing period before creating a job", async () => {
    transaction.period.findFirst.mockResolvedValue(null);
    await expect(finalizePeriod("period", "other-org", "user")).rejects.toThrow(/Период не найден/);
    expect(transaction.closingJob.findUnique).not.toHaveBeenCalled();
    expect(transaction.closingJob.upsert).not.toHaveBeenCalled();
  });

  it.each([
    { accruals: { salaryAmount: "100abc", depreciationAmount: 0, rentAmount: 0, expenseAccountCode: "9420" } },
    { accruals: { salaryAmount: 0, depreciationAmount: -1, rentAmount: 0, expenseAccountCode: "" } },
    { accruals: { salaryAmount: 0, depreciationAmount: 0, rentAmount: "70368744177664.01", expenseAccountCode: "" } },
    { accruals: { salaryAmount: 100, depreciationAmount: 0, rentAmount: 0 } },
    { fxDiff: { exchangeRate: 0, difference: 100 } },
    { fxDiff: { exchangeRate: 12000, difference: "1.001" } },
  ])("rejects corrupt persisted state before marking RUNNING: %s", async data => {
    transaction.stagedTransaction.count.mockResolvedValue(0);
    transaction.closingJob.findUnique.mockResolvedValue({ status: "DRAFT", data });
    await expect(finalizePeriod("period", "org", "user")).rejects.toThrow();
    expect(transaction.closingJob.upsert).not.toHaveBeenCalled();
  });

  it("rejects an invalid override before any closing writes", async () => {
    transaction.stagedTransaction.count.mockResolvedValue(0);
    await expect(finalizePeriod("period", "org", "user", { rentAmount: -1 })).rejects.toThrow();
    expect(transaction.closingJob.upsert).not.toHaveBeenCalled();
  });

  it.each(["EUR", "RUB"])("blocks saving and finalizing unsupported %s accounts before writes", async currency => {
    transaction.stagedTransaction.count.mockResolvedValue(0);
    transaction.bankAccount.findFirst.mockResolvedValue({ currency });
    await expect(saveClosingState("period", { currentStep: 6, fxDiff: { exchangeRate: 0, difference: 0 } }, "org"))
      .rejects.toThrow(/переоценка банковских счетов/);
    await expect(finalizePeriod("period", "org", "user")).rejects.toThrow(/переоценка банковских счетов/);
    expect(transaction.bankAccount.findFirst).toHaveBeenCalledWith({
      where: { orgId: "org", currency: { notIn: ["UZS", "USD"] } }, select: { currency: true },
    });
    expect(transaction.closingJob.upsert).not.toHaveBeenCalled();
  });

  it("returns an already completed closed period without repeating accruals", async () => {
    const period = { id: "period", orgId: "org", status: "CLOSED", lockDate: new Date(), org: {} };
    transaction.period.findFirst.mockResolvedValue(period);
    transaction.closingJob.findUnique.mockResolvedValue({ status: "COMPLETED" });
    await expect(finalizePeriod("period", "org", "user")).resolves.toEqual({ period, taxEvents: [], warnings: [] });
    expect(transaction.closingJob.upsert).not.toHaveBeenCalled();
  });

  it("rejects a locked period even when its status is open", async () => {
    transaction.period.findFirst.mockResolvedValue({ status: "OPEN", lockDate: new Date(), org: {} });
    await expect(finalizePeriod("period", "org", "user")).rejects.toThrow(/закрыт для редактирования/);
    expect(transaction.closingJob.upsert).not.toHaveBeenCalled();
  });

  it.each([getClosingState, saveClosingState])("does not read or mutate a foreign period state", async (operation) => {
    transaction.period.findFirst.mockResolvedValue(null);
    const request = operation === getClosingState
      ? getClosingState("period", "org") : saveClosingState("period", {}, "org");
    await expect(request).rejects.toThrow(/not found or access denied/);
    expect(transaction.closingJob.findUnique).not.toHaveBeenCalled();
    expect(transaction.closingJob.upsert).not.toHaveBeenCalled();
  });

  it("cannot update wizard data after period closure", async () => {
    transaction.period.findFirst.mockResolvedValue({ status: "CLOSED", lockDate: new Date() });
    await expect(saveClosingState("period", { accruals: {} }, "org")).rejects.toThrow(/закрыт для редактирования/);
    expect(transaction.closingJob.upsert).not.toHaveBeenCalled();
  });

  it("does not claim completion for an open period with a lock date", async () => {
    transaction.period.findFirst.mockResolvedValue({ status: "OPEN", lockDate: new Date() });
    await expect(getClosingState("period", "org")).rejects.toThrow(/закрыт для редактирования/);
  });

  it("preserves legacy accruals when first saving a different wizard step", async () => {
    transaction.period.findFirst.mockResolvedValue({
      status: "OPEN", lockDate: null, closingData: { accruals: { salaryAmount: 100 } },
    });
    await saveClosingState("period", { currentStep: 5 }, "org");
    expect(transaction.closingJob.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ data: { currentStep: 5, accruals: { salaryAmount: 100 } } }),
    }));
  });

  it("reuses the caller transaction and propagates state-write failure", async () => {
    transaction.closingJob.upsert.mockRejectedValue(new Error("state write failed"));
    await expect(saveClosingState("period", { currentStep: 7 }, "org", transaction as unknown as Prisma.TransactionClient))
      .rejects.toThrow("state write failed");
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(transaction.closingJob.upsert).toHaveBeenCalledOnce();
  });
});
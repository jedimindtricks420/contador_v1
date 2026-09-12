import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE } from "@/app/api/periods/[id]/route";

const mocks = vi.hoisted(() => ({
  membership: vi.fn(), transaction: vi.fn(), queryRaw: vi.fn(),
  period: { findFirst: vi.fn(), delete: vi.fn() }, auditLog: { create: vi.fn() },
  document: { findFirst: vi.fn() }, openItem: { findFirst: vi.fn() },
}));
vi.mock("@/lib/context", () => ({ getActiveMembership: mocks.membership }));
vi.mock("@/lib/prisma", () => ({ default: { $transaction: mocks.transaction } }));
const tx = { $queryRaw: mocks.queryRaw, period: mocks.period, auditLog: mocks.auditLog,
  document: mocks.document, openItem: mocks.openItem };
const emptyPeriod = () => ({ id: "own-period", orgId: "own", year: 2026, month: 9, mode: "ACTIVE",
  status: "OPEN", lockDate: null, closingData: null,
  _count: { documents: 0, stagedTransactions: 0, taxEvents: 0, closingJobs: 0, soliqImportBatches: 0 },
});
const request = () => DELETE(new NextRequest("http://localhost/api/periods/own-period", { method: "DELETE" }), {
  params: Promise.resolve({ id: "own-period" }),
});

describe("period deletion refuses accounting history", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.membership.mockResolvedValue({ orgId: "own", userId: "current-user", role: "OWNER" });
    mocks.transaction.mockImplementation(callback => callback(tx));
    mocks.period.findFirst.mockResolvedValue(emptyPeriod());
  });
  afterEach(() => vi.restoreAllMocks());

  it.each(["OWNER", "ADMIN"])("allows %s to remove an empty period with the current actor", async role => {
    mocks.membership.mockResolvedValue({ orgId: "own", userId: "current-user", role });
    const response = await request();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ deleted: true });
    expect(mocks.period.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "own-period", orgId: "own" } }));
    expect(mocks.period.delete).toHaveBeenCalledExactlyOnceWith({ where: { id: "own-period", orgId: "own" } });
    expect(mocks.auditLog.create).toHaveBeenCalledWith({ data: {
      orgId: "own", userId: "current-user", action: "DELETE_PERIOD", entityType: "Period", entityId: "own-period",
      oldValue: { year: 2026, month: 9, mode: "ACTIVE", status: "OPEN" },
    } });
    const lock = mocks.queryRaw.mock.calls[0];
    expect(lock[0].join("?")).toContain("FOR UPDATE");
    expect(lock.slice(1)).toEqual(["own-period", "own"]);
    expect(mocks.queryRaw.mock.invocationCallOrder[0]).toBeLessThan(mocks.period.findFirst.mock.invocationCallOrder[0]);
    expect(mocks.transaction).toHaveBeenCalledWith(expect.any(Function), { maxWait: 5000, timeout: 10000 });
  });

  it.each(["ACCOUNTANT", "VIEWER", "UNKNOWN"])("denies %s before a transaction", async role => {
    mocks.membership.mockResolvedValue({ orgId: "own", userId: "current-user", role });
    expect((await request()).status).toBe(403);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it.each(["FORBIDDEN", "NO_ACTIVE_ORG"])("denies %s before a transaction", async message => {
    mocks.membership.mockRejectedValue(new Error(message));
    expect((await request()).status).toBe(403);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("denies an unknown or foreign period without deleting or auditing", async () => {
    mocks.period.findFirst.mockResolvedValue(null);
    expect((await request()).status).toBe(404);
    expect(mocks.period.delete).not.toHaveBeenCalled();
    expect(mocks.auditLog.create).not.toHaveBeenCalled();
  });

  it.each([{ status: "CLOSED", lockDate: null }, { status: "OPEN", lockDate: new Date() }])
    ("denies a closed or locked period", async fields => {
      mocks.period.findFirst.mockResolvedValue({ ...emptyPeriod(), ...fields });
      expect((await request()).status).toBe(400);
      expect(mocks.period.delete).not.toHaveBeenCalled();
      expect(mocks.auditLog.create).not.toHaveBeenCalled();
    });

  it.each(["documents", "stagedTransactions", "taxEvents", "closingJobs", "soliqImportBatches"] as const)
    ("preserves a period with %s", async relation => {
      const period = emptyPeriod();
      period._count[relation] = 1;
      mocks.period.findFirst.mockResolvedValue(period);
      const response = await request();
      expect(response.status).toBe(409);
      expect((await response.json()).code).toBe("PERIOD_NOT_EMPTY");
      expect(mocks.period.delete).not.toHaveBeenCalled();
      expect(mocks.auditLog.create).not.toHaveBeenCalled();
    });

  it("preserves legacy closingData even without a job", async () => {
    mocks.period.findFirst.mockResolvedValue({ ...emptyPeriod(), closingData: { currentStep: 1 } });
    expect((await request()).status).toBe(409);
    expect(mocks.period.delete).not.toHaveBeenCalled();
  });

  it.each(["document", "openItem"] as const)("preserves soft period references from %s", async model => {
    mocks[model].findFirst.mockResolvedValue({ id: "reference" });
    expect((await request()).status).toBe(409);
    expect(mocks.document.findFirst).toHaveBeenCalledWith({ where: { orgId: "own", correctionForPeriodId: "own-period" }, select: { id: true } });
    expect(mocks.openItem.findFirst).toHaveBeenCalledWith({ where: { orgId: "own", affectedPeriodId: "own-period" }, select: { id: true } });
    expect(mocks.period.delete).not.toHaveBeenCalled();
    expect(mocks.auditLog.create).not.toHaveBeenCalled();
  });

  it("does not acknowledge success when audit insertion fails", async () => {
    mocks.auditLog.create.mockRejectedValue(new Error("audit unavailable"));
    expect((await request()).status).toBe(500);
  });
});
import { NextRequest } from "next/server";
import Decimal from "decimal.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PUT, DELETE } from "@/app/api/bank-accounts/[id]/route";
import { POST } from "@/app/api/bank-accounts/route";

const mocks = vi.hoisted(() => ({
  membership: vi.fn(), transaction: vi.fn(), queryRaw: vi.fn(),
  bankAccount: { findFirst: vi.fn(), findMany: vi.fn(), update: vi.fn(), create: vi.fn(), delete: vi.fn() },
  auditLog: { findFirst: vi.fn(), create: vi.fn() },
}));
vi.mock("@/lib/context", () => ({ getActiveMembership: mocks.membership, getActiveOrgId: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ default: { $transaction: mocks.transaction } }));
const database = { $queryRaw: mocks.queryRaw, bankAccount: mocks.bankAccount, auditLog: mocks.auditLog };
const account = () => ({ id: "bank", orgId: "own", name: "Synthetic", bankName: null,
  accountNumber: "00000000000000000001", currency: "UZS", lastBalance: new Decimal("0.00"), lastSyncedAt: null as Date | null,
  _count: { stagedTransactions: 0 },
});
const update = (body: Record<string, unknown>) => PUT(new NextRequest("http://localhost/api/bank-accounts/bank", {
  method: "PUT", body: JSON.stringify(body),
}), { params: Promise.resolve({ id: "bank" }) });
const create = (body: Record<string, unknown>) => POST(new NextRequest("http://localhost/api/bank-accounts", { method: "POST", body: JSON.stringify(body) }));
const remove = () => DELETE(new NextRequest("http://localhost/api/bank-accounts/bank", { method: "DELETE" }), { params: Promise.resolve({ id: "bank" }) });

describe("bank account identity protection", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.membership.mockResolvedValue({ orgId: "own", userId: "actor", role: "OWNER" });
    mocks.transaction.mockImplementation(callback => callback(database));
    mocks.bankAccount.findFirst.mockResolvedValue(account());
    mocks.bankAccount.findMany.mockResolvedValue([]);
    mocks.bankAccount.create.mockImplementation(({ data }) => Promise.resolve({ id: "new-bank", ...data }));
    mocks.bankAccount.update.mockImplementation(({ data }) => Promise.resolve({ ...account(), ...data }));
    mocks.auditLog.findFirst.mockResolvedValue(null);
  });
  afterEach(() => vi.restoreAllMocks());

  it.each(["OWNER", "ADMIN"])("allows %s to update an unused account with atomic audit", async role => {
    mocks.membership.mockResolvedValue({ orgId: "own", userId: "actor", role });
    expect((await update({ currency: "USD" })).status).toBe(200);
    expect(mocks.transaction).toHaveBeenCalledWith(expect.any(Function), { maxWait: 5000, timeout: 10000 });
    expect(mocks.queryRaw.mock.calls[0][0].join("?")).toContain("pg_advisory_xact_lock");
    expect(mocks.queryRaw.mock.calls[0].slice(1)).toEqual(["bank-account:own"]);
    expect(mocks.queryRaw.mock.calls[1][0].join("?")).toContain("FOR NO KEY UPDATE");
    expect(mocks.queryRaw.mock.calls[1].slice(1)).toEqual(["bank", "own"]);
    expect(mocks.queryRaw.mock.invocationCallOrder[0]).toBeLessThan(mocks.bankAccount.findFirst.mock.invocationCallOrder[0]);
    expect(mocks.bankAccount.update).toHaveBeenCalledWith({ where: { id: "bank", orgId: "own" }, data: expect.objectContaining({ currency: "USD" }) });
    expect(mocks.auditLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      orgId: "own", userId: "actor", action: "UPDATE_BANK_ACCOUNT", entityId: "bank",
      oldValue: expect.objectContaining({ currency: "UZS", lastBalance: "0.00" }),
      newValue: expect.objectContaining({ currency: "USD", lastBalance: "0.00" }),
    }) });
  });

  it.each(["ACCOUNTANT", "VIEWER", "UNKNOWN"])("denies writes by %s", async role => {
    mocks.membership.mockResolvedValue({ orgId: "own", userId: "actor", role });
    expect((await update({ name: "Changed" })).status).toBe(403);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("does not find foreign or unknown accounts", async () => {
    mocks.bankAccount.findFirst.mockResolvedValue(null);
    expect((await update({ name: "Changed" })).status).toBe(404);
    expect(mocks.bankAccount.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "bank", orgId: "own" } }));
    expect(mocks.bankAccount.update).not.toHaveBeenCalled();
  });

  it.each(["rows", "sync", "audit"])("keeps financial identity immutable when history exists as %s", async history => {
    const value = account();
    if (history === "rows") value._count.stagedTransactions = 1;
    if (history === "sync") value.lastSyncedAt = new Date("2026-09-10T00:00:00Z");
    if (history === "audit") mocks.auditLog.findFirst.mockResolvedValue({ id: "import" });
    mocks.bankAccount.findFirst.mockResolvedValue(value);
    for (const body of [{ accountNumber: "00000000000000000002" }, { currency: "USD" }, { lastBalance: "0.01" }]) {
      const response = await update(body);
      expect(response.status).toBe(409);
      expect((await response.json()).code).toBe("BANK_ACCOUNT_IN_USE");
    }
    expect(mocks.bankAccount.update).not.toHaveBeenCalled();
    expect(mocks.auditLog.create).not.toHaveBeenCalled();
  });

  it("allows descriptive changes and unchanged identity for a used account", async () => {
    const value = account();
    value._count.stagedTransactions = 1;
    mocks.bankAccount.findFirst.mockResolvedValue(value);
    expect((await update({ name: "Renamed", bankName: "Synthetic bank", accountNumber: value.accountNumber,
      currency: "UZS", lastBalance: "0.00" })).status).toBe(200);
  });

  it("does not acknowledge success if audit insertion fails", async () => {
    mocks.auditLog.create.mockRejectedValue(new Error("audit unavailable"));
    expect((await update({ name: "Changed" })).status).toBe(500);
  });

  it.each([
    {}, { name: " " }, { lastBalance: true }, { lastBalance: null }, { lastBalance: "" },
    { lastBalance: "1e3" }, { lastBalance: "0.001" }, { lastBalance: "1000000000000000000" },
    { lastBalance: 9007199254740993 }, { currency: "usd" }, { currency: "USDT" },
    { accountNumber: null }, { accountNumber: "" }, { accountNumber: 123 },
    { name: "Changed", orgId: "foreign" }, { lastSyncedAt: "2026-09-10T00:00:00Z" },
  ])("rejects invalid update %j before opening a transaction", async body => {
    expect((await update(body)).status).toBe(400);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it.each(["FORBIDDEN", "NO_ACTIVE_ORG"])("denies stale membership: %s", async message => {
    mocks.membership.mockRejectedValue(new Error(message));
    expect((await create({ name: "New", accountNumber: account().accountNumber })).status).toBe(403);
    expect((await update({ name: "Changed" })).status).toBe(403);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it.each(["OWNER", "ADMIN"])("creates a validated account for %s with exact balance and audit", async role => {
    mocks.membership.mockResolvedValue({ orgId: "own", userId: "actor", role });
    const response = await create({ name: " New ", accountNumber: "00000 00000 00000 00001", lastBalance: "9007199254740993.27" });
    expect(response.status).toBe(201);
    expect(mocks.bankAccount.create).toHaveBeenCalledWith({ data: {
      orgId: "own", name: "New", bankName: null, accountNumber: account().accountNumber, currency: "UZS", lastBalance: "9007199254740993.27",
    } });
    expect(mocks.auditLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      userId: "actor", action: "CREATE_BANK_ACCOUNT", newValue: expect.objectContaining({ lastBalance: "9007199254740993.27" }),
    }) });
  });

  it.each(["ACCOUNTANT", "VIEWER"])("denies account creation to %s", async role => {
    mocks.membership.mockResolvedValue({ orgId: "own", userId: "actor", role });
    expect((await create({ name: "New", accountNumber: account().accountNumber })).status).toBe(403);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it.each([{}, { name: "New" }, { name: "New", accountNumber: "bad" }, { name: "New", accountNumber: account().accountNumber, force: true }])
    ("rejects invalid create %j", async body => {
      expect((await create(body)).status).toBe(400);
      expect(mocks.transaction).not.toHaveBeenCalled();
    });

  it.each(["create", "update"])("rejects a legacy spaced duplicate on %s", async operation => {
    mocks.bankAccount.findMany.mockResolvedValue([{ accountNumber: "00000 00000 00000 00001" }]);
    const body = { name: "New", accountNumber: account().accountNumber };
    const response = await (operation === "create" ? create(body) : update(body));
    expect(response.status).toBe(409);
    expect((await response.json()).code).toBe("BANK_ACCOUNT_DUPLICATE");
    expect(mocks.bankAccount.create).not.toHaveBeenCalled();
    expect(mocks.bankAccount.update).not.toHaveBeenCalled();
    expect(mocks.auditLog.create).not.toHaveBeenCalled();
  });

  it("does not acknowledge account creation if audit fails", async () => {
    mocks.auditLog.create.mockRejectedValue(new Error("audit unavailable"));
    expect((await create({ name: "New", accountNumber: account().accountNumber })).status).toBe(500);
  });

  it.each(["OWNER", "ADMIN"])("allows %s to remove an unused zero-balance account atomically", async role => {
    mocks.membership.mockResolvedValue({ orgId: "own", userId: "actor", role });
    expect((await remove()).status).toBe(200);
    expect(mocks.queryRaw.mock.calls[0][0].join("?")).toContain("FOR UPDATE");
    expect(mocks.bankAccount.delete).toHaveBeenCalledWith({ where: { id: "bank", orgId: "own" } });
    expect(mocks.auditLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      orgId: "own", userId: "actor", action: "DELETE_BANK_ACCOUNT", entityId: "bank",
    }) });
  });

  it.each(["ACCOUNTANT", "VIEWER", "UNKNOWN"])("denies deletion to %s", async role => {
    mocks.membership.mockResolvedValue({ orgId: "own", userId: "actor", role });
    expect((await remove()).status).toBe(403);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it.each(["rows", "sync", "audit", "balance"])("preserves account with %s", async history => {
    const value = account();
    if (history === "rows") value._count.stagedTransactions = 1;
    if (history === "sync") value.lastSyncedAt = new Date();
    if (history === "audit") mocks.auditLog.findFirst.mockResolvedValue({ id: "import" });
    if (history === "balance") value.lastBalance = new Decimal("0.01");
    mocks.bankAccount.findFirst.mockResolvedValue(value);
    expect((await remove()).status).toBe(409);
    expect(mocks.bankAccount.delete).not.toHaveBeenCalled();
    expect(mocks.auditLog.create).not.toHaveBeenCalled();
  });

  it("returns 404 for a foreign or unknown delete target", async () => {
    mocks.bankAccount.findFirst.mockResolvedValue(null);
    expect((await remove()).status).toBe(404);
    expect(mocks.bankAccount.delete).not.toHaveBeenCalled();
  });

  it("does not acknowledge deletion if audit fails", async () => {
    mocks.auditLog.create.mockRejectedValue(new Error("audit unavailable"));
    expect((await remove()).status).toBe(500);
  });
});
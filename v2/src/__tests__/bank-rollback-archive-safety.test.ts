import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Decimal from "decimal.js";
import { DELETE } from "@/app/api/import/bank/rollback/route";
import { bankSourceHash } from "@/lib/bankImportBatch";
import { bankImportFingerprint } from "@/lib/bankImportFingerprint";

const { database, membership } = vi.hoisted(() => ({
  membership: vi.fn(),
  database: {
    $transaction: vi.fn(), $queryRaw: vi.fn(),
    stagedTransaction: { findFirst: vi.fn(), findMany: vi.fn(), deleteMany: vi.fn() },
    bankAccount: { findFirst: vi.fn(), update: vi.fn() },
    bankImportBatch: { findFirst: vi.fn(), update: vi.fn() },
    document: { findFirst: vi.fn() },
    auditLog: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
  },
}));
vi.mock("@/lib/prisma", () => ({ default: database }));
vi.mock("@/lib/context", () => ({ getActiveMembership: membership }));

const batchId = randomUUID();
const date = new Date("2026-09-11T00:00:00Z");
const sourceData = Buffer.from("synthetic source");
const row = {
  id: "row", orgId: "org", bankAccountId: "bank", periodId: "period", importBatchId: batchId,
  amount: new Decimal("0.10"), date, createdAt: date, direction: "CREDIT" as const, description: "synthetic",
  status: "IMPORTED" as const, documentId: null, aiSuggestion: null, counterpartyHint: null, counterpartyInn: null, hash: "hash",
};
const oldValue = { accountNumber: "00000000000000000001", currency: "UZS", lastBalance: "0.00", lastSyncedAt: null };
const newValue = {
  ...oldValue, lastBalance: "0.10", lastSyncedAt: date.toISOString(), rollbackVersion: 2,
  bankBatchVersion: 1, sourceHash: bankImportFingerprint([row]), importBatchId: batchId, imported: 1,
};
const archive = { id: batchId, status: "IMPORTED", bankCurrency: "UZS", sourceData,
  sourceHash: bankSourceHash(sourceData), result: { oldValue, newValue } };
const rollback = () => DELETE(new NextRequest("http://localhost/api/import/bank/rollback", {
  method: "DELETE", body: JSON.stringify({ batchId }),
}));

describe("bank rollback archive integration", () => {
  let committed: boolean;
  beforeEach(() => {
    vi.resetAllMocks();
    committed = false;
    membership.mockResolvedValue({ orgId: "org", userId: "actor", role: "OWNER" });
    database.$transaction.mockImplementation(async callback => {
      const result = await callback(database);
      committed = true;
      return result;
    });
    database.$queryRaw.mockResolvedValue([{ id: "period", status: "OPEN", lockDate: null }]);
    database.stagedTransaction.findFirst.mockResolvedValue({ bankAccountId: "bank" });
    database.stagedTransaction.findMany.mockResolvedValue([row]);
    database.stagedTransaction.deleteMany.mockResolvedValue({ count: 1 });
    database.bankAccount.findFirst.mockResolvedValue({ ...newValue, lastBalance: new Decimal("0.10"), lastSyncedAt: date });
    database.bankImportBatch.findFirst.mockResolvedValue(archive);
    database.auditLog.findMany.mockResolvedValue([{ id: "audit", createdAt: date, oldValue, newValue }]);
    database.auditLog.create.mockResolvedValue({ id: "rollback-audit" });
    database.auditLog.findFirst.mockResolvedValue(null);
    database.document.findFirst.mockResolvedValue(null);
  });

  it("retains the source and records a lifecycle transition with its audit", async () => {
    expect((await rollback()).status).toBe(200);
    expect(database.bankImportBatch.update).toHaveBeenCalledWith({ where: { id: batchId }, data: {
      status: "ROLLED_BACK", rolledBackBy: "actor", rolledBackAt: expect.any(Date), rollbackAuditId: "rollback-audit",
    } });
    expect(committed).toBe(true);
  });

  it.each([null, { ...archive, sourceHash: "corrupt" }, { ...archive, status: "ROLLED_BACK" },
    { ...archive, result: { oldValue, newValue: { ...newValue, imported: 2 } } },
  ])("rejects missing or inconsistent archives before writes: %j", async value => {
    database.bankImportBatch.findFirst.mockResolvedValue(value);
    expect((await rollback()).status).toBe(409);
    expect(database.stagedTransaction.deleteMany).not.toHaveBeenCalled();
    expect(database.bankAccount.update).not.toHaveBeenCalled();
  });

  it.each([false, true])("allows an unmarked legacy snapshot only without an archive: %s", async hasArchive => {
    const { bankBatchVersion, ...legacy } = newValue;
    expect(bankBatchVersion).toBe(1);
    database.auditLog.findMany.mockResolvedValue([{ id: "audit", createdAt: date, oldValue, newValue: legacy }]);
    if (!hasArchive) database.bankImportBatch.findFirst.mockResolvedValue(null);
    expect((await rollback()).status).toBe(hasArchive ? 409 : 200);
    expect(database.bankImportBatch.update).not.toHaveBeenCalled();
  });

  it("aborts the transaction when the archive transition fails", async () => {
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
    database.bankImportBatch.update.mockRejectedValue(new Error("archive unavailable"));
    expect((await rollback()).status).toBe(500);
    expect(committed).toBe(false);
    errorLog.mockRestore();
  });
});
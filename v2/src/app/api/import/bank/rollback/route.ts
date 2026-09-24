import { NextRequest, NextResponse } from "next/server";
import { getActiveMembership } from "@/lib/context";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { bankImportFingerprint } from "@/lib/bankImportFingerprint";
import { normalizeBankAccountNumber } from "@/lib/bankStatementValidation";
import { bankSourceHash } from "@/lib/bankImportBatch";
import { lockBankStatementPeriods } from "@/lib/bankStatementPeriodLocks";
import { isDeepStrictEqual } from "node:util";

const accountSnapshot = z.object({
  accountNumber: z.string().regex(/^\d{20}$/),
  lastBalance: z.string().regex(/^-?\d{1,18}\.\d{2}$/),
  lastSyncedAt: z.string().datetime().nullable(),
  currency: z.string().min(1),
});
const importSnapshot = z.object({
  oldValue: accountSnapshot,
  newValue: accountSnapshot.extend({
    lastSyncedAt: z.string().datetime(), rollbackVersion: z.literal(2),
    bankBatchVersion: z.literal(1).optional(),
    sourceHash: z.string().regex(/^[a-f0-9]{64}$/),
    importBatchId: z.string().uuid(), imported: z.number().int().nonnegative().safe(),
  }),
});

export async function DELETE(req: NextRequest) {
  try {
    const membership = await getActiveMembership();
    if (!["OWNER", "ADMIN"].includes(membership.role)) throw new Error("FORBIDDEN");
    const { orgId, userId } = membership;
    const body = z.object({ batchId: z.string().uuid() }).strict().safeParse(await req.json().catch(() => null));
    if (!body.success) return NextResponse.json({ error: "Некорректный batchId" }, { status: 400 });
    const { batchId } = body.data;

    return await prisma.$transaction(async database => {
      const candidate = await database.stagedTransaction.findFirst({
        where: { orgId, importBatchId: batchId }, select: { bankAccountId: true },
      }) ?? await database.bankImportBatch.findFirst({ where: { id: batchId, orgId, status: "IMPORTED" }, select: { bankAccountId: true } });
      if (!candidate) return NextResponse.json({ error: "Транзакции не найдены или уже удалены" }, { status: 404 });
      const bankAccountId = candidate.bankAccountId;
      await database.$queryRaw`SELECT "id" FROM "BankAccount" WHERE "id" = ${bankAccountId} AND "orgId" = ${orgId} FOR NO KEY UPDATE`;
      const bank = await database.bankAccount.findFirst({ where: { id: bankAccountId, orgId } });
      if (!bank) return NextResponse.json({ error: "Банковский счёт не найден" }, { status: 404 });
      let periods = await database.$queryRaw<{ id: string; status: string; lockDate: Date | null }[]>`
        SELECT "id", "status", "lockDate" FROM "Period" WHERE "orgId" = ${orgId} AND "id" IN (
          SELECT "periodId" FROM "StagedTransaction" WHERE "orgId" = ${orgId} AND "importBatchId" = ${batchId}
        ) ORDER BY "year", "month", "id" FOR NO KEY UPDATE
      `;
      await database.$queryRaw`SELECT "id" FROM "StagedTransaction" WHERE "orgId" = ${orgId} AND "importBatchId" = ${batchId} ORDER BY "id" FOR UPDATE`;
      const transactions = await database.stagedTransaction.findMany({ where: { orgId, importBatchId: batchId } });
      const reviewRequired = () => NextResponse.json({
        error: "Откат не подтверждён исходным снимком импорта и текущим состоянием счёта. Требуется сверка.",
        code: "BATCH_REQUIRES_REVIEW",
      }, { status: 409 });
      const periodIds = new Set(periods.map(period => period.id));
      if (transactions.some(row => row.bankAccountId !== bankAccountId || !periodIds.has(row.periodId))) return reviewRequired();
      if (periods.some(period => period.status !== "OPEN" || period.lockDate !== null)) {
        return NextResponse.json({ error: "Нельзя откатить импорт закрытого или заблокированного периода", code: "PERIOD_LOCKED" }, { status: 409 });
      }
      if (transactions.some(row => row.status !== "IMPORTED" || row.documentId !== null || row.aiSuggestion !== null)) {
        return NextResponse.json({ error: "Нельзя откатить обработанные банковские операции", code: "BATCH_PROCESSED" }, { status: 409 });
      }
      const sourceDocument = await database.document.findFirst({ where: {
        orgId, sourceTransactionId: { in: transactions.map(row => row.id) },
      }, select: { id: true } });
      if (sourceDocument) return reviewRequired();
      const audits = await database.auditLog.findMany({ where: {
        orgId, action: "IMPORT_BANK", entityType: "BankAccount", entityId: bankAccountId,
        newValue: { path: ["importBatchId"], equals: batchId },
      }, take: 2 });
      if (audits.length !== 1) return reviewRequired();
      const audit = audits[0];
      const snapshot = importSnapshot.safeParse(audit);
      if (!snapshot.success) return reviewRequired();
      const previous = snapshot.data.oldValue;
      const imported = snapshot.data.newValue;
      await database.$queryRaw`SELECT "id" FROM "BankImportBatch" WHERE "id" = ${batchId} AND "orgId" = ${orgId} FOR UPDATE`;
      const archive = await database.bankImportBatch.findFirst({ where: { id: batchId, orgId, bankAccountId } });
      if (transactions.length === 0) {
        if (archive?.status === "ROLLED_BACK") return NextResponse.json({ error: "Импорт уже отменён" }, { status: 404 });
        const empty = z.object({ periodStart: z.string().datetime(), periodEnd: z.string().datetime(),
          rowCount: z.literal(0), openingBalance: z.string(), closingBalance: z.string(), credits: z.literal("0.00"), debits: z.literal("0.00"),
        }).safeParse(archive?.statement);
        if (!archive || !Array.isArray(archive.rows) || archive.rows.length !== 0 || !empty.success ||
            empty.data.openingBalance !== empty.data.closingBalance || imported.imported !== 0) return reviewRequired();
        periods = await lockBankStatementPeriods(database, orgId, new Date(empty.data.periodStart), new Date(empty.data.periodEnd));
        if (periods.some(period => period.status !== "OPEN" || period.lockDate !== null)) {
          return NextResponse.json({ error: "Нельзя откатить импорт закрытого или заблокированного периода", code: "PERIOD_LOCKED" }, { status: 409 });
        }
      }
      if (imported.bankBatchVersion === 1 || archive) {
        if (!archive || imported.bankBatchVersion !== 1 || archive.status !== "IMPORTED" ||
            archive.bankCurrency !== imported.currency || archive.sourceHash !== bankSourceHash(archive.sourceData) ||
            !isDeepStrictEqual(archive.result, { oldValue: audit.oldValue, newValue: audit.newValue })) {
          return reviewRequired();
        }
      }
      if (imported.importBatchId !== batchId || imported.imported !== transactions.length ||
          imported.sourceHash !== bankImportFingerprint(transactions) ||
          previous.currency !== imported.currency || bank.currency !== imported.currency ||
          previous.accountNumber !== imported.accountNumber || normalizeBankAccountNumber(bank.accountNumber) !== imported.accountNumber ||
          bank.lastBalance.toFixed(2) !== imported.lastBalance || bank.lastSyncedAt?.toISOString() !== imported.lastSyncedAt) {
        return reviewRequired();
      }
      const subsequentChange = await database.auditLog.findFirst({ where: {
        orgId, entityType: "BankAccount", entityId: bankAccountId,
        id: { not: audit.id }, OR: [
          { createdAt: { gte: audit.createdAt } },
          { oldValue: { path: ["lastSyncedAt"], equals: imported.lastSyncedAt } },
        ],
      }, select: { id: true } });
      if (subsequentChange) return reviewRequired();
      const deleted = await database.stagedTransaction.deleteMany({ where: {
        orgId, importBatchId: batchId, bankAccountId, status: "IMPORTED", documentId: null,
        id: { in: transactions.map(row => row.id) },
      } });
      if (deleted.count !== transactions.length) throw new Error("Состав импорта изменился во время отката");
      await database.bankAccount.update({ where: { id: bankAccountId, orgId }, data: {
        lastBalance: previous.lastBalance, lastSyncedAt: previous.lastSyncedAt ? new Date(previous.lastSyncedAt) : null,
      } });
      const rollbackAudit = await database.auditLog.create({ data: {
        orgId, userId, action: "ROLLBACK_IMPORT_BANK", entityType: "BankAccount", entityId: bankAccountId,
        oldValue: { ...imported, transactions: transactions.map(row => ({
          ...row, amount: row.amount.toFixed(2), date: row.date.toISOString(), createdAt: row.createdAt.toISOString(),
        })) },
        newValue: { ...previous, importBatchId: batchId, importAuditId: audit.id, sourceHash: imported.sourceHash, deleted: deleted.count },
      } });
      if (archive) {
        await database.bankImportBatch.update({ where: { id: batchId }, data: {
          status: "ROLLED_BACK", rolledBackBy: userId, rolledBackAt: new Date(), rollbackAuditId: rollbackAudit.id,
        } });
      }
      return NextResponse.json({ deleted: deleted.count });
    }, { maxWait: 5000, timeout: 15000 });
  } catch (err: any) {
    console.error("ROLLBACK IMPORT ERROR:", err);
    return NextResponse.json({ error: err.message || "Internal error" }, { status: ["FORBIDDEN", "NO_ACTIVE_ORG"].includes(err.message) ? 403 : 500 });
  }
}

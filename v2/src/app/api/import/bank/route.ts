import { NextRequest, NextResponse } from "next/server";
import { getActiveMembership } from "@/lib/context";
import prisma from "@/lib/prisma";
import crypto from "crypto";
import Decimal from "decimal.js";
import { assertAccountingWriteRole } from "@/lib/posting/documentPolicy";
import { bankImportFingerprint } from "@/lib/bankImportFingerprint";
import { bankSourceHash, buildBankImportSource } from "@/lib/bankImportBatch";
import { bankTransactionReferenceHash, matchesArchivedBankRow } from "@/lib/bankTransactionReference";
import { assertBankStatementContinuity } from "@/lib/bankStatementContinuity";
import { lockBankStatementPeriods } from "@/lib/bankStatementPeriodLocks";
import { assertStatementAccount, assertStatementCurrency, BankStatementValidationError } from "@/lib/bankStatementValidation";
import { BANK_UPLOAD_MAX_FILE_BYTES, BankUploadError, readBankUpload } from "@/lib/bankUpload";

import { parse1CExchange } from "@/lib/parsers/parser1c";
import { ParsedBankStatement, ParsedTransaction } from "@/lib/parsers/types";

export async function POST(req: NextRequest) {
  try {

    const membership = await getActiveMembership();
    assertAccountingWriteRole(membership.role);
    const orgId = membership.orgId;
    const formData = await readBankUpload(req);
    const file = formData.get("file");
    const bankAccountId = formData.get("bankAccountId");
    const parserType = formData.get("parserType");
    const confirmedCurrency = formData.get("confirmedCurrency");

    const url = new URL(req.url);
    const isPreview = url.searchParams.get("preview") === "true";

    if (!(file instanceof File) || typeof bankAccountId !== "string" || !bankAccountId.trim() ||
        formData.getAll("file").length !== 1 || formData.getAll("bankAccountId").length !== 1 ||
        formData.getAll("parserType").length > 1 ||
        formData.getAll("confirmedCurrency").length > 1 ||
        (confirmedCurrency !== null && (typeof confirmedCurrency !== "string" || !/^[A-Z]{3}$/.test(confirmedCurrency))) ||
        (parserType !== null && (typeof parserType !== "string" || !["1C", "AUTO", "Asaka", "Kapital", "IpakYoli"].includes(parserType)))) {
      return NextResponse.json({ error: "file и bankAccountId обязательны" }, { status: 400 });
    }
    if (file.size === 0 || file.size > BANK_UPLOAD_MAX_FILE_BYTES) {
      return NextResponse.json({ error: "Размер выписки должен быть от 1 байта до 5 МиБ" }, { status: file.size === 0 ? 400 : 413 });
    }

    const bankAccount = await prisma.bankAccount.findFirst({
      where: { id: bankAccountId, orgId },
    });
    if (!bankAccount) {
      return NextResponse.json({ error: "Банковский счёт не найден" }, { status: 404 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let parsed: ParsedTransaction[] = [];
    let statement: ParsedBankStatement;
    let statementOpeningBalance: number | string | undefined;
    let statementClosingBalance: number | string | undefined;
    let statementAccountNumber: string | undefined;
    let usedParser = "";

    // Format detection: check ASCII prefix of the buffer (works for both UTF-8 and CP1251)
    const headerSnippet = buffer.slice(0, 64).toString("latin1");
    const is1CHeader = headerSnippet.includes("1CClientBankExchange");

    if (is1CHeader && (parserType === "1C" || parserType === "AUTO" || parserType === null)) {
      const result = parse1CExchange(buffer);
      statement = result;
      parsed = result.transactions;
      statementOpeningBalance = result.openingBalance;
      statementClosingBalance = result.closingBalance;
      statementAccountNumber = result.accountNumber;
      usedParser = "1CClientBankExchange";
    } else {
      return NextResponse.json({
        error: "Формат выписки не подтверждает номер счёта и контрольные итоги. Требуется проверенный формат 1CClientBankExchange",
        code: "BANK_STATEMENT_UNSUPPORTED",
      }, { status: 422 });
    }

    assertStatementAccount(statementAccountNumber, bankAccount.accountNumber);
    assertStatementCurrency(statement.currency, bankAccount.currency, confirmedCurrency, true);

    // Preview mode: return the parsed results without saving to DB
    if (isPreview) {
      return NextResponse.json({
        parser: usedParser,
        total: parsed.length,
        currency: statement.currency ?? null,
        bankCurrency: bankAccount.currency,
        requiresCurrencyConfirmation: statement.currency === undefined,
        openingBalance: statementOpeningBalance ?? null,
        closingBalance: statementClosingBalance ?? null,
        transactions: parsed.map(tx => ({
          date: tx.date.toISOString().split("T")[0],
          amount: tx.amount,
          direction: tx.direction,
          description: tx.description,
          counterpartyHint: tx.counterpartyHint || "",
          counterpartyInn: tx.counterpartyInn || "",
          bankDocumentNumber: tx.bankDocumentNumber ?? null,
        }))
      });
    }

    if (statement.currency === undefined && confirmedCurrency === null) {
      throw new BankUploadError("В файле не указана валюта. Подтвердите валюту выписки", 422, "BANK_CURRENCY_CONFIRMATION_REQUIRED");
    }
    const source = buildBankImportSource(buffer, file.name, statement);
    return await prisma.$transaction(async (database) => {
    const [lockedAccount] = await database.$queryRaw<{ lastBalance: string; lastSyncedAt: Date | null; currency: string; accountNumber: string | null }[]>`
      SELECT "lastBalance"::text, "lastSyncedAt", "currency", "accountNumber" FROM "BankAccount"
      WHERE id = ${bankAccountId} AND "orgId" = ${orgId} FOR NO KEY UPDATE
    `;
    if (!lockedAccount) throw new Error("Банковский счёт не найден");
    const confirmedAccountNumber = assertStatementAccount(statementAccountNumber, lockedAccount.accountNumber);
    assertStatementCurrency(statement.currency, lockedAccount.currency, confirmedCurrency);
    const emptyStatement = parsed.length === 0;
    if (emptyStatement) {
      const existing = await database.bankImportBatch.findFirst({ where: {
        orgId, bankAccountId, status: "IMPORTED", sourceHash: source.sourceHash,
      } });
      if (existing) {
        if (existing.sourceHash !== bankSourceHash(existing.sourceData)) throw new BankStatementValidationError("Исходный файл архива повреждён");
        return NextResponse.json({ imported: 0, duplicates: 0, locked: 0, total: 0, parser: usedParser,
          emptyStatement: true, alreadyImported: true, importBatchId: null,
          openingBalance: statementOpeningBalance, closingBalance: statementClosingBalance, balanceDiscrepancy: null });
      }
      const periods = await lockBankStatementPeriods(database, orgId, statement.periodStart!, statement.periodEnd!);
      if (periods.some(period => period.status !== "OPEN" || period.lockDate !== null)) {
        throw new BankStatementValidationError("Нельзя импортировать выписку закрытого или заблокированного периода");
      }
    }
    let imported = 0;
    let duplicates = 0;
    let locked = 0;
    let netDeltaCents = BigInt(0);
    const importBatchId = crypto.randomUUID();
    const statementReferences = new Set<string>();

    for (const tx of [...parsed].sort((first, second) => first.date.getTime() - second.date.getTime())) {
      const amount = new Decimal(tx.amount);
      if (!amount.isFinite() || !amount.gt(0) || amount.decimalPlaces() > 2 || amount.gte("1000000000000000000")) {
        throw new Error("Некорректная сумма банковской операции");
      }
      if (!["CREDIT", "DEBIT"].includes(tx.direction)) throw new Error("Некорректное направление банковской операции");
      const dateParts = new Intl.DateTimeFormat("en", {
        timeZone: "Asia/Tashkent", year: "numeric", month: "numeric",
      }).formatToParts(tx.date);
      const year = Number(dateParts.find((part) => part.type === "year")?.value);
      const month = Number(dateParts.find((part) => part.type === "month")?.value);

      // Find or create accounting period (upsert is race-safe: @@unique([orgId, year, month]))
      const period = await database.period.upsert({
        where: { orgId_year_month: { orgId, year, month } },
        create: { orgId, year, month, mode: "ACTIVE", status: "OPEN" },
        update: {}
      });

      // Skip transactions whose period is already closed — they cannot be classified
      await database.$queryRaw`SELECT "id" FROM "Period" WHERE "id" = ${period.id} FOR NO KEY UPDATE`;
      const currentPeriod = await database.period.findUniqueOrThrow({ where: { id: period.id } });
      if (currentPeriod.status === "CLOSED" || currentPeriod.lockDate !== null) {
        locked++;
        continue;
      }

      const referenceHash = bankTransactionReferenceHash(tx, orgId, bankAccountId, lockedAccount.currency);
      if (referenceHash) {
        if (statementReferences.has(referenceHash)) {
          throw new BankStatementValidationError("Повтор номера банковского документа в выписке. Требуется сверка");
        }
        statementReferences.add(referenceHash);
        const existing = await database.stagedTransaction.findUnique({ where: { orgId_hash: { orgId, hash: referenceHash } } });
        if (existing) {
          const archive = existing.importBatchId ? await database.bankImportBatch.findFirst({ where: {
            id: existing.importBatchId, orgId, bankAccountId, status: "IMPORTED",
          } }) : null;
          if (!archive || archive.sourceHash !== bankSourceHash(archive.sourceData) || !Array.isArray(archive.rows) || archive.rows.filter(row => matchesArchivedBankRow(row, tx)).length !== 1 ||
              existing.bankAccountId !== bankAccountId || existing.date.getTime() !== tx.date.getTime() ||
              existing.direction !== tx.direction || !amount.eq(existing.amount.toString()) || existing.description !== tx.description ||
              existing.counterpartyInn !== (tx.counterpartyInn || null) || existing.counterpartyHint !== (tx.counterpartyHint || null)) {
            throw new BankStatementValidationError("Реквизиты повторного банковского документа изменились. Требуется сверка");
          }
          duplicates += 1;
          continue;
        }
      }
      const legacyHash: string = crypto
        .createHash("sha256")
        .update(`${orgId}:${bankAccountId}:${tx.date.toISOString()}:${Number(tx.amount)}:${tx.description}`)
        .digest("hex");
      const legacy = await database.stagedTransaction.findUnique({
        where: { orgId_hash: { orgId, hash: legacyHash } },
      });
      if (legacy && legacy.bankAccountId === bankAccountId && legacy.direction === tx.direction &&
          legacy.date.getTime() === tx.date.getTime() && amount.eq(legacy.amount.toString()) &&
          legacy.description === tx.description) {
        if (referenceHash) throw new BankStatementValidationError("Документ совпадает с импортом без номера. Требуется сверка");
        duplicates += 1;
        continue;
      }
      const previousHash = crypto.createHash("sha256").update(JSON.stringify([
        "bank-v2", orgId, bankAccountId, lockedAccount.currency, tx.date.toISOString(),
        tx.direction, amount.toFixed(2), tx.description,
      ])).digest("hex");
      if (referenceHash && await database.stagedTransaction.findUnique({ where: { orgId_hash: { orgId, hash: previousHash } } })) {
        throw new BankStatementValidationError("Документ совпадает с импортом без номера. Требуется сверка");
      }
      const hash = referenceHash ?? previousHash;

        const inserted = await database.stagedTransaction.createMany({
          skipDuplicates: true,
          data: {
            orgId,
            bankAccountId,
            periodId: period.id,
            date: tx.date,
            amount: amount.toFixed(2),
            direction: tx.direction,
            description: tx.description,
            counterpartyHint: tx.counterpartyHint || null,
            counterpartyInn: tx.counterpartyInn || null,
            hash,
            status: "IMPORTED",
            importBatchId,
          },
        });
        if (inserted.count === 0) {
          duplicates += 1;
        } else {
          imported += 1;
          const cents = BigInt(amount.toFixed(2).replace(".", ""));
          netDeltaCents += tx.direction === "CREDIT" ? cents : -cents;
        }
    }

    // Update bank balance.
    // If the statement provides an opening balance AND the account has never been synced
    // (lastBalance === 0 and lastSyncedAt is null), seed lastBalance from the statement.
    // This ensures the first import correctly reflects the real bank opening position.
    let newBalance = new Decimal(lockedAccount.lastBalance);
    if (imported > 0 || emptyStatement) {
        if (duplicates > 0 || locked > 0) {
          throw new BankStatementValidationError("Частичный импорт выписки запрещён: найдены повторные или заблокированные операции. Требуется сверка");
        }
        const previousArchives = await database.bankImportBatch.findMany({ where: {
          orgId, bankAccountId, status: "IMPORTED",
          ...(lockedAccount.lastSyncedAt ? { result: { path: ["newValue", "lastSyncedAt"], equals: lockedAccount.lastSyncedAt.toISOString() } } : {}),
        }, take: 2 });
        const previousBatchId = assertBankStatementContinuity(statement, lockedAccount, previousArchives);
        const isFirstSync = !lockedAccount.lastSyncedAt && newBalance.isZero();
        const baseBalance = (isFirstSync && statementOpeningBalance !== undefined)
          ? new Decimal(statementOpeningBalance)
          : newBalance;
        if (!baseBalance.isFinite() || baseBalance.decimalPlaces() > 2) {
          throw new Error("Некорректный начальный банковский остаток");
        }
        const baseCents = BigInt(baseBalance.toFixed(2).replace(".", ""));
        newBalance = new Decimal((baseCents + netDeltaCents).toString()).div(100);
        if (!newBalance.isFinite() || newBalance.decimalPlaces() > 2 || newBalance.abs().gte("1000000000000000000")) {
          throw new Error("Остаток банковского счёта не представим без потери точности");
        }
        const syncedAt = new Date();
        const sourceRows = await database.stagedTransaction.findMany({ where: { orgId, importBatchId } });
        await database.bankAccount.update({
          where: { id: bankAccountId },
          data: { lastSyncedAt: syncedAt, lastBalance: newBalance.toFixed(2) }
        });
        const result = {
          oldValue: { lastBalance: lockedAccount.lastBalance, lastSyncedAt: lockedAccount.lastSyncedAt?.toISOString() ?? null, currency: lockedAccount.currency, accountNumber: confirmedAccountNumber },
          newValue: {
            lastBalance: newBalance.toFixed(2), lastSyncedAt: syncedAt.toISOString(), currency: lockedAccount.currency, accountNumber: confirmedAccountNumber,
            imported, duplicates, locked, importBatchId, rollbackVersion: 2, bankBatchVersion: 1, sourceHash: bankImportFingerprint(sourceRows),
            currencyEvidence: statement.currency === undefined ? "USER_CONFIRMED" : "SOURCE",
            confirmedCurrency,
            sequenceVersion: 1, previousBatchId,
          },
        };
        await database.bankImportBatch.create({ data: {
          id: importBatchId, orgId, bankAccountId, bankCurrency: lockedAccount.currency,
          ...source, result, createdBy: membership.userId,
        } });
        await database.auditLog.create({ data: {
          orgId, userId: membership.userId, action: "IMPORT_BANK", entityType: "BankAccount", entityId: bankAccountId,
          ...result,
        } });
    }

    if (statementClosingBalance !== undefined && (imported > 0 || emptyStatement)) {
      if (!newBalance.eq(statementClosingBalance)) {
        throw new BankStatementValidationError("Конечный остаток выписки не совпадает с состоянием счёта после импорта. Требуется сверка последовательности выписок");
      }
    }

    return NextResponse.json({
      imported, duplicates, locked, total: parsed.length, parser: usedParser,
      importBatchId: imported > 0 || emptyStatement ? importBatchId : null,
      emptyStatement,
      openingBalance: statementOpeningBalance ?? null,
      closingBalance: statementClosingBalance ?? null,
      balanceDiscrepancy: null
    });
    }, { maxWait: 5000, timeout: 30000 });
  } catch (err: any) {
    if (err instanceof BankUploadError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    }
    if (err instanceof BankStatementValidationError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: 422 });
    }
    console.error("BANK STATEMENT IMPORT ERROR:", err);
    return NextResponse.json({ error: err.message || "Internal error" }, { status: ["FORBIDDEN", "NO_ACTIVE_ORG"].includes(err.message) ? 403 : 500 });
  }
}

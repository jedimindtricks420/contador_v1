import prisma from "../prisma";
import { evaluate } from "./expressionEval";
import Decimal from "decimal.js";
import { getRiskDeadline } from "../openItems";
import { TAX_RATES, SALARY_EXPENSE_ACCOUNT_CODES } from "../constants";
import { PostingValidationError } from "./errors";
import { appendPostingRevision, assertPostingRevisionState } from "./postingRevision";

type PostingResult = { journalEntries: any[]; openItem: any };

function assertNotOpeningBalance(code: string) {
  if (code === "OPENING_BALANCE") {
    throw new PostingValidationError("Начальные остатки требуют отдельной процедуры проверки и исправления");
  }
}

function resolveAccountCode(reference: unknown, payload: Record<string, any>): string {
  if (typeof reference !== "string" || !reference.trim()) {
    throw new Error("Некорректный код счёта в шаблоне");
  }
  if (!reference.startsWith("$")) return reference;
  const fieldName = reference.slice(1);
  const value = Object.hasOwn(payload, fieldName) ? payload[fieldName] : undefined;
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Обязательное поле "${fieldName}" не указано в данных документа (нужен код счёта)`);
  }
  return value.trim();
}

/**
 * Posts a document by resolving its templates, evaluating mathematical expressions,
 * validating balance debit=credit, inserting journal entries, creating open items, and logging.
 */
export async function postDocument(
  documentId: string,
  tx: any = prisma,
  passedUserId?: string
): Promise<PostingResult> {
  if (typeof tx.$transaction === "function") {
    return tx.$transaction(
      (transaction: any) => postDocumentInTransaction(documentId, transaction, passedUserId),
      { maxWait: 5000, timeout: 30000 }
    );
  }
  return postDocumentInTransaction(documentId, tx, passedUserId);
}

async function postDocumentInTransaction(documentId: string, tx: any, passedUserId?: string) {
  await tx.$queryRaw`SELECT "id" FROM "Document" WHERE "id" = ${documentId} FOR UPDATE`;
  // 1. Fetch Document and type
  const doc = await tx.document.findUnique({
    where: { id: documentId },
    include: { type: true }
  });

  if (!doc) throw new Error("Документ не найден");
  assertNotOpeningBalance(doc.type.code);
  if (doc.status === "VOIDED") {
    throw new Error("Сторнированный документ нельзя провести повторно");
  }

  // 2. Check period lock
  await tx.$queryRaw`SELECT "id" FROM "Period" WHERE "id" = ${doc.periodId} FOR NO KEY UPDATE`;
  const period = await tx.period.findUnique({
    where: { id: doc.periodId }
  });
  if (!period) throw new Error("Период не найден");
  if (period.orgId !== doc.orgId) {
    throw new Error("Период не принадлежит организации документа");
  }
  if (period.status === "CLOSED" || period.lockDate !== null) {
    throw new Error("Период закрыт для редактирования");
  }

  const accountingDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tashkent", year: "numeric", month: "numeric"
  }).formatToParts(doc.date);
  const year = Number(accountingDate.find((part) => part.type === "year")?.value);
  const month = Number(accountingDate.find((part) => part.type === "month")?.value);
  if (year !== period.year || month !== period.month) {
    throw new Error("Дата документа не входит в выбранный период (Asia/Tashkent)");
  }

  const existingEntry = await tx.journalEntry.findFirst({
    where: { documentId: doc.id }, select: { id: true }
  });
  if (existingEntry) {
    throw new Error("Документ уже проведён; повторное проведение запрещено");
  }

  await assertPostingRevisionState(tx, doc, "POST");

  // 3. Fetch Organization to verify VAT status
  const org = await tx.organization.findUnique({
    where: { id: doc.orgId }
  });
  if (!org) throw new Error("Организация не найдена");

  const payload = (doc.payload || {}) as Record<string, any>;

  // 5. Build evaluation context payload
  const evalPayload = {
    ...payload,
    isVatPayer: org.isVatPayer,
    vatRate: org.isVatPayer ? (payload.vatRate !== undefined ? Number(payload.vatRate) : TAX_RATES.VAT) : 0
  };

  const template = doc.type.postingTemplate as any;
  if (!template || !Array.isArray(template.lines)) {
    throw new Error("Шаблон проводок документа пуст или некорректен");
  }

  if ((payload.contractId !== undefined && payload.contractId !== null && payload.contractId !== "") ||
      template.lines.some((line: any) => line.subcontoType === "contract")) {
    throw new Error("Договорная аналитика требует проверяемого реестра договоров; проведение остановлено");
  }
  for (const field of ["counterpartyId", "counterpartyInn", "counterpartyHint"]) {
    if (payload[field] !== undefined && payload[field] !== null && typeof payload[field] !== "string") {
      throw new Error(`Поле ${field} должно быть строкой`);
    }
  }
  const explicitCounterpartyId = payload.counterpartyId?.trim();
  if (payload.counterpartyId !== undefined && payload.counterpartyId !== null && !explicitCounterpartyId) {
    throw new Error("Идентификатор контрагента не может быть пустым");
  }

  const isLongTermLoan = ["LONG_TERM_LOAN_RECEIVED", "LONG_TERM_LOAN_REPAYMENT"].includes(doc.type.code);
  if (isLongTermLoan && !["7810", "7820"].includes(resolveAccountCode("$loanAccountCode", payload))) {
    throw new Error("Допустимые счета долгосрочного кредита/займа: 7810, 7820");
  }
  const openingAccountCode = template.opensItem
    ? resolveAccountCode(template.itemAccountCode, payload) : null;
  const closingAccountCode = template.closesOpenItemByAccount
    ? resolveAccountCode(template.closesOpenItemByAccount, payload) : null;
  const selectedOpenItemId = payload.openItemId;
  if (selectedOpenItemId !== undefined &&
      (typeof selectedOpenItemId !== "string" || !selectedOpenItemId.trim() || !closingAccountCode)) {
    throw new Error("Выбранная задолженность требует корректного идентификатора и счёта погашения");
  }

  // Guard: CAPITAL_CONTRIBUTION credits 4610 (debt of the founders towards the
  // company) — it must never post when there's no declared/outstanding debt on that
  // account, and never for more than what's actually still owed (that would leave
  // 4610 negative — overpaid "debt" — which НСБУ-21 §348 doesn't allow; the excess
  // belongs on 6630 via CAPITAL_INCREASE_PENDING instead). Any $transaction wrapper
  // around postDocument (category route, clarification/answer, rulesEngine,
  // aiClassifier) rolls back on this throw, leaving the transaction unclassified/
  // NEEDS_CLARIFICATION instead of posting — regardless of which code path attempted
  // it, not just the AI classifier's own (best-effort) prompt-level guidance.
  if (doc.type.code === "CAPITAL_CONTRIBUTION") {
    const { getCharterCapitalDebt } = await import("../charterCapital");
    const debt = await getCharterCapitalDebt(doc.orgId, tx);
    if (!org.charterCapitalDeclaredAt || debt.lte(0)) {
      throw new Error(
        "Невозможно провести как «Оплата доли в уставном капитале»: уставный капитал не задекларирован или долг по счёту 4610 уже полностью погашен. Укажите уставный капитал в Настройках или выберите другую категорию."
      );
    }
    const contributionAmount = new Decimal(payload.amount ?? 0);
    if (contributionAmount.gt(debt)) {
      throw new Error(
        `Сумма операции (${contributionAmount.toString()}) превышает остаток долга по уставному капиталу на счёте 4610 (${debt.toString()}). Разделите операцию: часть в пределах остатка — «Оплата доли в уставном капитале», остальное — «Довзнос учредителя сверх устава» (CAPITAL_INCREASE_PENDING).`
      );
    }
  }

  // Guard: VAT_OFFSET (4410 → 6410) must never exceed the input VAT actually
  // confirmed by the Soliq reconciliation (SOLIQ_IMPORT.payload.taxSummary.inputVat,
  // saved permanently at Step 6 of period closing — no separate ЭСФ model needed,
  // a signed ЭСФ with a wrong amount can't exist in either party's registry).
  // Same rollback behaviour as the CAPITAL_CONTRIBUTION guard above.
  if (doc.type.code === "VAT_OFFSET") {
    const soliqDoc = await tx.document.findFirst({
      where: { periodId: doc.periodId, orgId: doc.orgId, type: { code: "SOLIQ_IMPORT" }, status: "POSTED" }
    });
    if (!soliqDoc) {
      throw new Error("Зачёт НДС невозможен: для этого периода ещё не загружен отчёт Soliq (Шаг 6 закрытия).");
    }

    const inputVat = new Decimal((soliqDoc.payload as any)?.taxSummary?.inputVat ?? 0);

    const alreadyOffset = await tx.journalEntry.aggregate({
      where: {
        document: { periodId: doc.periodId, orgId: doc.orgId, type: { code: "VAT_OFFSET" }, status: "POSTED" },
        account: { code: "4410" }
      },
      _sum: { credit: true }
    });
    const usedSoFar = new Decimal(alreadyOffset._sum.credit?.toString() ?? 0);

    const vatAmount = new Decimal(payload.vatAmount ?? 0);
    if (usedSoFar.plus(vatAmount).gt(inputVat)) {
      throw new Error(
        `Сумма зачёта (${vatAmount.toString()}) превышает входящий НДС по отчёту Soliq за период (${inputVat.toString()} сум, уже зачтено ${usedSoFar.toString()} сум).`
      );
    }
  }

  // Guard: SALARY_ACCRUAL's gross-salary/social-tax lines resolve $expenseAccountCode
  // dynamically (see step 6 below) — that mechanism accepts ANY existing account code,
  // so without this check a document created outside the closing wizard's own
  // validated step-4 flow (e.g. via the generic POST /api/documents used by
  // /documents/new) could post payroll expense to an arbitrary account (even a
  // bank or liability account). closing.ts's finalizePeriod already validates this
  // for the normal wizard flow — this is the same check enforced universally.
  if (doc.type.code === "SALARY_ACCRUAL") {
    const expenseAccountCode = payload.expenseAccountCode;
    if (!SALARY_EXPENSE_ACCOUNT_CODES.includes(expenseAccountCode)) {
      throw new Error(
        `Некорректный счёт расхода для начисления ЗП: "${expenseAccountCode ?? ""}". Допустимые: ${SALARY_EXPENSE_ACCOUNT_CODES.join(", ")}.`
      );
    }
  }

  const preparedEntries: { line: any; accountId: string; amount: Decimal }[] = [];

  // 6. Generate entries
  for (const line of template.lines) {
    if (line.side !== "debit" && line.side !== "credit") {
      throw new Error("Некорректная сторона проводки: ожидается debit или credit");
    }
    if (line.condition) {
      const condResult = evaluate(line.condition, evalPayload);
      if (condResult.isZero()) continue;
    }

    // Find account — supports "$fieldName" for payload-driven dynamic account codes
    const resolvedAccountCode = resolveAccountCode(line.accountCode, payload);

    const account = await tx.account.findUnique({
      where: { code: resolvedAccountCode }
    });
    if (!account) {
      throw new Error(`Счёт с кодом ${resolvedAccountCode} не найден в плане счетов`);
    }

    // Calculate amount
    const amt = evaluate(line.expression, evalPayload);
    if (!amt.isFinite() || amt.isNegative()) {
      throw new Error("Сумма проводки должна быть конечной и неотрицательной");
    }
    if (amt.decimalPlaces() > 2 || amt.gte("1000000000000000000")) {
      throw new Error("Сумма проводки не представима в Decimal(20,2) без округления или переполнения");
    }
    if (amt.isZero()) continue; // Skip zero amount entries

    if (resolvedAccountCode === "4410" && org.isVatPayer !== true) {
      throw new PostingValidationError("Проводки по входному НДС (4410) требуют статуса плательщика НДС. Учёт НДС в стоимости требует отдельного подтверждённого правила операции.");
    }

    preparedEntries.push({ line, accountId: account.id, amount: amt });
  }

  if (preparedEntries.length === 0) {
    throw new Error("Документ не содержит ненулевых проводок");
  }

  // 7. Verify balance (Σ Debit = Σ Credit)
  let totalDebitCents = BigInt(0);
  let totalCreditCents = BigInt(0);
  for (const entry of preparedEntries) {
    const cents = BigInt(entry.amount.toFixed(2).replace(".", ""));
    if (entry.line.side === "debit") totalDebitCents += cents;
    else totalCreditCents += cents;
  }

  const formatCents = (cents: bigint) => `${cents / BigInt(100)}.${(cents % BigInt(100)).toString().padStart(2, "0")}`;
  const totalDebit = formatCents(totalDebitCents);
  const totalCredit = formatCents(totalCreditCents);
  if (totalDebitCents !== totalCreditCents) {
    throw new Error(`Несбалансированная проводка для документа ${doc.id}: Дт=${totalDebit.toString()} Кт=${totalCredit.toString()}`);
  }

  const payloadInn = typeof payload.counterpartyInn === "string" ? payload.counterpartyInn.trim() : payload.counterpartyInn;
  const payloadHint = typeof payload.counterpartyHint === "string" ? payload.counterpartyHint.trim() : undefined;
  const needsItemAmount = openingAccountCode || (closingAccountCode && (explicitCounterpartyId || payloadInn || payloadHint));
  const itemAmount = needsItemAmount ? evaluate("amount", evalPayload) : null;
  if (itemAmount && (!itemAmount.isFinite() || itemAmount.lte(0) ||
      itemAmount.decimalPlaces() > 2 || itemAmount.gte("1000000000000000000"))) {
    throw new Error("Сумма задолженности должна быть положительной и представимой в Decimal(20,2) без округления или переполнения");
  }

  let counterpartyId: string | null = null;
  if ((template.requiresCounterparty || isLongTermLoan) && !explicitCounterpartyId && !payloadInn && !payloadHint) {
    throw new Error("Для проведения документа обязателен контрагент");
  }

  if (explicitCounterpartyId) {
    const counterparty = await tx.counterparty.findFirst({
      where: { id: explicitCounterpartyId, orgId: doc.orgId },
    });
    if (!counterparty) throw new Error("Контрагент не найден в организации документа");
    if (payloadInn && counterparty.inn?.trim() !== payloadInn) {
      throw new Error("ИНН не совпадает с выбранным контрагентом");
    }
    counterpartyId = counterparty.id;
  } else if (payloadInn || payloadHint) {
    let counterparty = null;
    if (payloadInn) {
      counterparty = await tx.counterparty.findFirst({
        where: { orgId: doc.orgId, inn: String(payloadInn) }
      });
    } else if (payloadHint) {
      counterparty = await tx.counterparty.findFirst({
        where: { orgId: doc.orgId, name: { equals: String(payloadHint), mode: "insensitive" } }
      });
    }

    if (!counterparty) {
      counterparty = await tx.counterparty.create({
        data: {
          orgId: doc.orgId,
          name: payloadHint || `Контрагент ИНН ${payloadInn}`,
          inn: payloadInn ? String(payloadInn) : null
        }
      });
    }
    counterpartyId = counterparty.id;
  }

  if (selectedOpenItemId && !counterpartyId) throw new Error("Для выбранной задолженности требуется контрагент");
  let itemToClose: { id: string } | null = null;
  if (closingAccountCode && counterpartyId) {
    const closeAccount = await tx.account.findUnique({ where: { code: closingAccountCode } });
    if (!closeAccount) throw new Error("Счёт погашения задолженности не найден");
    await tx.$queryRaw`SELECT "id" FROM "OpenItem"
      WHERE "orgId" = ${doc.orgId} AND "accountId" = ${closeAccount.id}
        AND "counterpartyId" = ${counterpartyId} AND "status" IN ('OPEN', 'RISK')
        AND "dateOpened" <= ${doc.date}
        AND (${selectedOpenItemId ?? null}::text IS NULL OR "id" = ${selectedOpenItemId ?? null})
      ORDER BY "dateOpened", "id" FOR UPDATE`;
    const candidates = await tx.openItem.findMany({
      where: { orgId: doc.orgId, accountId: closeAccount.id, counterpartyId,
        ...(selectedOpenItemId ? { id: selectedOpenItemId } : {}),
        status: { in: ["OPEN", "RISK"] }, dateOpened: { lte: doc.date } },
      orderBy: [{ dateOpened: "asc" }, { id: "asc" }]
    });
    itemToClose = candidates.find((item: any) =>
      (!selectedOpenItemId || item.id === selectedOpenItemId) && new Decimal(item.amount.toString()).equals(itemAmount!)) ?? null;
    if (selectedOpenItemId && !itemToClose) {
      throw new Error("Выбранная задолженность недоступна или не соответствует сумме и реквизитам платежа");
    }
    if (!itemToClose && candidates.length > 0) {
      throw new Error("Частичное погашение или переплата требуют регистра распределений; автоматическое закрытие задолженности остановлено");
    }
    if (!itemToClose && (template.requireCloseMatch || isLongTermLoan)) {
      throw new Error(`У контрагента нет открытого долга на счёте ${closingAccountCode}`);
    }
  }

  const entries = preparedEntries.map(({ line, accountId, amount }) => ({
    documentId: doc.id,
    accountId,
    debit: line.side === "debit" ? amount : new Decimal(0),
    credit: line.side === "credit" ? amount : new Decimal(0),
    date: doc.date,
    counterpartyId: line.subcontoType === "counterparty" ? counterpartyId : null,
    contractId: null
  }));

  // 8. Write entries to database
  const createdEntries: any[] = [];
  for (const entry of entries) {
    const dbEntry = await tx.journalEntry.create({
      data: entry
    });
    createdEntries.push(dbEntry);
  }

  // 9. OpenItem creation
  let openItem: any = null;
  if (openingAccountCode) {
    const bufferAccount = await tx.account.findUnique({
      where: { code: openingAccountCode }
    });
    if (!bufferAccount) {
      throw new Error(`Буферный счёт ${openingAccountCode} не найден в плане счетов`);
    }

    const riskDeadline = getRiskDeadline(openingAccountCode, doc.date, org.settings);

    openItem = await tx.openItem.create({
      data: {
        orgId: doc.orgId,
        accountId: bufferAccount.id,
        counterpartyId: counterpartyId,
        openingDocumentId: doc.id,
        amount: itemAmount,
        dateOpened: doc.date,
        riskDeadline: riskDeadline,
        status: "OPEN",
        affectedPeriodId: doc.periodId
      }
    });
  }

  if (itemToClose) {
    const closed = await tx.openItem.updateMany({
      where: { id: itemToClose.id, orgId: doc.orgId, status: { in: ["OPEN", "RISK"] } },
      data: { status: "CLOSED", dateClosed: doc.date, closingDocumentId: doc.id }
    });
    if (closed.count !== 1) throw new Error("Задолженность уже изменена; проведение отменено");
  }

  // 10. Audit Log
  const userId = passedUserId || "system";

  await appendPostingRevision(tx, doc, "POST", userId, {
    ...evalPayload, engineVersion: "posting-v1",
  });

  await tx.auditLog.create({
    data: {
      orgId: doc.orgId,
      userId,
      action: "POST_DOCUMENT",
      entityType: "Document",
      entityId: doc.id,
      newValue: {
        journalEntryCount: createdEntries.length,
        totalAmount: totalDebit.toString()
      } as any
    }
  });

  const { upsertTaxCalendarEventsForPeriod } = await import("../closing");
  await upsertTaxCalendarEventsForPeriod(doc.periodId, doc.orgId, tx);
  await tx.document.update({
    where: { id: doc.id },
    data: { taxCalendarSyncStatus: "OK", taxCalendarSyncError: null }
  });

  return { journalEntries: createdEntries, openItem };
}

/**
 * Voids a document by marking status=VOIDED, removing its journal entries,
 * closing buffer open items, and auditing.
 */
export async function voidDocument(
  documentId: string,
  tx: any = prisma,
  passedUserId?: string
) {
  if (typeof tx.$transaction === "function") {
    return tx.$transaction(
      (transaction: any) => voidDocumentInTransaction(documentId, transaction, passedUserId),
      { maxWait: 5000, timeout: 30000 }
    );
  }
  return voidDocumentInTransaction(documentId, tx, passedUserId);
}

async function voidDocumentInTransaction(documentId: string, tx: any, passedUserId?: string) {
  await tx.$queryRaw`SELECT "id" FROM "Document" WHERE "id" = ${documentId} FOR UPDATE`;
  // 1. Fetch document
  const doc = await tx.document.findUnique({
    where: { id: documentId },
    include: { type: true }
  });

  if (!doc) throw new Error("Документ не найден");

  assertNotOpeningBalance(doc.type.code);
  await assertPostingRevisionState(tx, doc, "VOID");
  if (doc.status === "VOIDED") return;

  // 2. Check period lock
  await tx.$queryRaw`SELECT "id" FROM "Period" WHERE "id" = ${doc.periodId} FOR NO KEY UPDATE`;
  const period = await tx.period.findUnique({
    where: { id: doc.periodId }
  });
  if (!period) throw new Error("Период не найден");
  if (period.orgId !== doc.orgId) {
    throw new Error("Период не принадлежит организации документа");
  }
  if (period.status === "CLOSED" || period.lockDate !== null) {
    throw new Error("Период закрыт для редактирования");
  }

  await tx.$queryRaw`SELECT "id" FROM "OpenItem"
    WHERE "orgId" = ${doc.orgId}
      AND ("openingDocumentId" = ${documentId} OR "closingDocumentId" = ${documentId})
    ORDER BY "dateOpened", "id" FOR UPDATE`;
  const settledDebt = await tx.openItem.findFirst({
    where: { orgId: doc.orgId, openingDocumentId: documentId, closingDocumentId: { not: null } },
    select: { id: true },
  });
  if (settledDebt) {
    throw new Error("Задолженность документа уже погашена; сначала отмените документ расчёта");
  }

  await appendPostingRevision(tx, doc, "VOID", passedUserId || "system", null);

  // 3. Mark document status as VOIDED. Clear sourceTransactionId too — it has a
  // unique DB constraint, so leaving it set on a voided document would permanently
  // block the underlying bank transaction from ever being reclassified and reposted.
  await tx.document.update({
    where: { id: documentId },
    data: { status: "VOIDED", sourceTransactionId: null }
  });

  // 4. Delete related journal entries
  await tx.journalEntry.deleteMany({
    where: { documentId }
  });

  // 5. Close related OpenItems opened by this document
  await tx.openItem.updateMany({
    where: { orgId: doc.orgId, openingDocumentId: documentId, status: { in: ["OPEN", "RISK"] } },
    data: {
      status: "CLOSED",
      dateClosed: new Date()
    }
  });

  // 5b-revert. Re-open any items that were auto-closed by this document (closesOpenItemByAccount).
  // After void, those items are no longer settled and must go back to OPEN status.
  await tx.openItem.updateMany({
    where: { orgId: doc.orgId, closingDocumentId: documentId },
    data: { status: "OPEN", dateClosed: null, closingDocumentId: null }
  });

  // 5b. Return the bank transaction to the clarification queue if this document
  //     was created from a staged transaction (AUTO_MATCHED or CONFIRMED by user).
  await tx.stagedTransaction.updateMany({
    where: { orgId: doc.orgId, documentId },
    data: { status: "NEEDS_CLARIFICATION", documentId: null }
  });

  // 6. Audit Log
  const userId = passedUserId || "system";

  await tx.auditLog.create({
    data: {
      orgId: doc.orgId,
      userId,
      action: "VOID_DOCUMENT",
      entityType: "Document",
      entityId: doc.id
    }
  });

  const { upsertTaxCalendarEventsForPeriod } = await import("../closing");
  await upsertTaxCalendarEventsForPeriod(doc.periodId, doc.orgId, tx);
  await tx.document.update({
    where: { id: doc.id },
    data: { taxCalendarSyncStatus: "OK", taxCalendarSyncError: null }
  });
}

/**
 * Reposts a document by voiding existing journal entries, updating its category,
 * and generating new entries.
 * voidDocument sets linked StagedTransactions to NEEDS_CLARIFICATION/null —
 * we restore them to CONFIRMED/documentId after a successful repost.
 */
export async function repostDocument(
  documentId: string,
  newTypeId: string,
  tx: any = prisma,
  passedUserId?: string
): Promise<PostingResult> {
  if (typeof tx.$transaction === "function") {
    return tx.$transaction(
      (transaction: any) => repostDocumentInTransaction(documentId, newTypeId, transaction, passedUserId),
      { maxWait: 5000, timeout: 30000 }
    );
  }
  return repostDocumentInTransaction(documentId, newTypeId, tx, passedUserId);
}

async function repostDocumentInTransaction(documentId: string, newTypeId: string, tx: any, passedUserId?: string) {
  await tx.$queryRaw`SELECT "id" FROM "Document" WHERE "id" = ${documentId} FOR UPDATE`;
  const targetType = await tx.documentType.findUnique({ where: { id: newTypeId } });
  if (!targetType) throw new Error("Тип документа не найден");
  assertNotOpeningBalance(targetType.code);
  // Save linked staged transaction IDs before voiding clears them
  const linkedStagedTxs = await tx.stagedTransaction.findMany({
    where: { documentId },
    select: { id: true }
  });

  // 1. Void document (this detaches StagedTransactions → NEEDS_CLARIFICATION)
  await voidDocument(documentId, tx, passedUserId);

  // 2. Update type and return to POSTED status
  await tx.document.update({
    where: { id: documentId },
    data: { typeId: newTypeId, status: "POSTED" }
  });

  // 3. Repost document entries
  const result = await postDocument(documentId, tx, passedUserId);

  // 4. Restore staged transaction links cleared by voidDocument
  if (linkedStagedTxs.length > 0) {
    await tx.stagedTransaction.updateMany({
      where: { id: { in: linkedStagedTxs.map((t: any) => t.id) } },
      data: { status: "CONFIRMED", documentId }
    });
  }

  return result;
}

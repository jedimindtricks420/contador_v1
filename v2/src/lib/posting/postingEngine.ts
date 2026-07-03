import prisma from "../prisma";
import { evaluate } from "./expressionEval";
import Decimal from "decimal.js";
import { getRiskDeadline } from "../openItems";
import { TAX_RATES } from "../constants";

/**
 * Posts a document by resolving its templates, evaluating mathematical expressions,
 * validating balance debit=credit, inserting journal entries, creating open items, and logging.
 */
export async function postDocument(
  documentId: string,
  tx: any = prisma,
  passedUserId?: string
) {
  // 1. Fetch Document and type
  const doc = await tx.document.findUnique({
    where: { id: documentId },
    include: { type: true }
  });

  if (!doc) throw new Error("Документ не найден");
  if (doc.status === "VOIDED") {
    return { journalEntries: [] };
  }

  // 2. Check period lock
  const period = await tx.period.findUnique({
    where: { id: doc.periodId }
  });
  if (!period) throw new Error("Период не найден");
  if (period.status === "CLOSED" || period.lockDate !== null) {
    throw new Error("Период закрыт для редактирования");
  }

  // 3. Fetch Organization to verify VAT status
  const org = await tx.organization.findUnique({
    where: { id: doc.orgId }
  });
  if (!org) throw new Error("Организация не найдена");

  // 4. Resolve counterparty
  const payload = (doc.payload || {}) as Record<string, any>;
  let counterpartyId: string | null = null;
  const payloadInn = payload.counterpartyInn;
  const payloadHint = payload.counterpartyHint;

  if (payloadInn || payloadHint) {
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

  const entries: any[] = [];

  // 6. Generate entries
  for (const line of template.lines) {
    if (line.condition) {
      const condResult = evaluate(line.condition, evalPayload);
      if (condResult.isZero()) continue;
    }

    // Find account — supports "$fieldName" for payload-driven dynamic account codes
    let resolvedAccountCode: string = line.accountCode;
    if (resolvedAccountCode.startsWith("$")) {
      const fieldName = resolvedAccountCode.slice(1);
      resolvedAccountCode = (payload[fieldName] as string) || "";
      if (!resolvedAccountCode) {
        throw new Error(`Обязательное поле "${fieldName}" не указано в данных документа (нужен код счёта)`);
      }
    }

    const account = await tx.account.findUnique({
      where: { code: resolvedAccountCode }
    });
    if (!account) {
      throw new Error(`Счёт с кодом ${resolvedAccountCode} не найден в плане счетов`);
    }

    // Calculate amount
    const amt = evaluate(line.expression, evalPayload);
    if (amt.isZero()) continue; // Skip zero amount entries

    entries.push({
      documentId: doc.id,
      accountId: account.id,
      debit: line.side === "debit" ? amt : new Decimal(0),
      credit: line.side === "credit" ? amt : new Decimal(0),
      date: doc.date,
      counterpartyId: line.subcontoType === "counterparty" ? counterpartyId : null,
      contractId: line.subcontoType === "contract" ? (payload.contractId as string) || null : null
    });
  }

  // 7. Verify balance (Σ Debit = Σ Credit)
  let totalDebit = new Decimal(0);
  let totalCredit = new Decimal(0);
  for (const entry of entries) {
    totalDebit = totalDebit.plus(entry.debit);
    totalCredit = totalCredit.plus(entry.credit);
  }

  if (!totalDebit.equals(totalCredit)) {
    throw new Error(`Несбалансированная проводка для документа ${doc.id}: Дт=${totalDebit.toString()} Кт=${totalCredit.toString()}`);
  }

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
  if (template.opensItem && template.itemAccountCode) {
    const bufferAccount = await tx.account.findUnique({
      where: { code: template.itemAccountCode }
    });
    if (!bufferAccount) {
      throw new Error(`Буферный счёт ${template.itemAccountCode} не найден в плане счетов`);
    }

    const itemAmount = evaluate("amount", evalPayload);
    if (itemAmount.isZero()) {
      throw new Error(`OpenItem не создан: поле "amount" равно нулю или отсутствует в payload документа ${doc.id}`);
    }
    const riskDeadline = getRiskDeadline(template.itemAccountCode, doc.date, org.settings);

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

  // 9b. Auto-close an existing OpenItem when the template declares closesOpenItemByAccount.
  // Used by SUPPLIER_REFUND (closes 4310 advance) and ADVANCE_RETURN_SENT (closes 6310 advance).
  if (template.closesOpenItemByAccount && counterpartyId) {
    const closeAccount = await tx.account.findUnique({
      where: { code: template.closesOpenItemByAccount }
    });
    if (closeAccount) {
      const docAmount = evaluate("amount", evalPayload);
      // Find the best matching open item: same counterparty + same account + closest amount
      const candidates = await tx.openItem.findMany({
        where: {
          orgId: doc.orgId,
          accountId: closeAccount.id,
          counterpartyId,
          status: "OPEN"
        },
        orderBy: { dateOpened: "asc" }
      });
      // Prefer exact amount match, otherwise take the oldest open item
      const exactMatch = candidates.find((c: any) =>
        new Decimal(c.amount.toString()).minus(docAmount).abs().lessThan("0.01")
      );
      const toClose = exactMatch ?? candidates[0] ?? null;
      if (toClose) {
        await tx.openItem.update({
          where: { id: toClose.id },
          data: { status: "CLOSED", dateClosed: doc.date, closingDocumentId: doc.id }
        });
      }
    }
  }

  // 10. Audit Log
  const userId = passedUserId || "system";

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

  // Update tax calendar events dynamically for the period
  try {
    const { upsertTaxCalendarEventsForPeriod } = await import("../closing");
    await upsertTaxCalendarEventsForPeriod(doc.periodId, doc.orgId, tx);
  } catch (err: any) {
    console.error("Failed to dynamically update tax calendar events in postDocument:", err.message);
  }

  // Auto-close TaxCalendarEvents when a tax payment document is posted.
  // TAX_PAYMENT covers all budget taxes (VAT, НДФЛ, profit tax, turnover tax).
  // SOCIAL_TAX_PAYMENT covers social tax only.
  // We close PENDING events whose due date has already passed (lte payment date),
  // meaning the tax was accrued and is now being paid.
  if (doc.type.code === "TAX_PAYMENT") {
    await tx.taxCalendarEvent.updateMany({
      where: {
        orgId: doc.orgId,
        type: { in: ["VAT", "PERSONAL_INCOME_TAX", "PROFIT_TAX", "TURNOVER_TAX"] as any[] },
        status: "PENDING",
        dueDate: { lte: doc.date }
      },
      data: { status: "DONE" }
    });
  } else if (doc.type.code === "SOCIAL_TAX_PAYMENT") {
    await tx.taxCalendarEvent.updateMany({
      where: {
        orgId: doc.orgId,
        type: "SOCIAL_TAX" as any,
        status: "PENDING",
        dueDate: { lte: doc.date }
      },
      data: { status: "DONE" }
    });
  } else if (doc.type.code === "INPS_PAYMENT") {
    await tx.taxCalendarEvent.updateMany({
      where: {
        orgId: doc.orgId,
        type: "INPS" as any,
        status: "PENDING",
        dueDate: { lte: doc.date }
      },
      data: { status: "DONE" }
    });
  }

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
  // 1. Fetch document
  const doc = await tx.document.findUnique({
    where: { id: documentId }
  });

  if (!doc) throw new Error("Документ не найден");

  // 2. Check period lock
  const period = await tx.period.findUnique({
    where: { id: doc.periodId }
  });
  if (!period) throw new Error("Период не найден");
  if (period.status === "CLOSED" || period.lockDate !== null) {
    throw new Error("Период закрыт для редактирования");
  }

  // 3. Mark document status as VOIDED
  await tx.document.update({
    where: { id: documentId },
    data: { status: "VOIDED" }
  });

  // 4. Delete related journal entries
  await tx.journalEntry.deleteMany({
    where: { documentId }
  });

  // 5. Close related OpenItems opened by this document
  await tx.openItem.updateMany({
    where: { openingDocumentId: documentId, status: "OPEN" },
    data: {
      status: "CLOSED",
      dateClosed: new Date()
    }
  });

  // 5b-revert. Re-open any items that were auto-closed by this document (closesOpenItemByAccount).
  // After void, those items are no longer settled and must go back to OPEN status.
  await tx.openItem.updateMany({
    where: { closingDocumentId: documentId },
    data: { status: "OPEN", dateClosed: null, closingDocumentId: null }
  });

  // 5b. Return the bank transaction to the clarification queue if this document
  //     was created from a staged transaction (AUTO_MATCHED or CONFIRMED by user).
  await tx.stagedTransaction.updateMany({
    where: { documentId },
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

  // Update tax calendar events dynamically for the period
  try {
    const { upsertTaxCalendarEventsForPeriod } = await import("../closing");
    await upsertTaxCalendarEventsForPeriod(doc.periodId, doc.orgId, tx);
  } catch (err: any) {
    console.error("Failed to dynamically update tax calendar events in voidDocument:", err.message);
  }
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
) {
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

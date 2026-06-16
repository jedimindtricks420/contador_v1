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
        where: { orgId: doc.orgId, name: String(payloadHint) }
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

    // Find account
    const account = await tx.account.findUnique({
      where: { code: line.accountCode }
    });
    if (!account) {
      throw new Error(`Счёт с кодом ${line.accountCode} не найден в плане счетов`);
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
    const riskDeadline = getRiskDeadline(template.itemAccountCode, doc.date);

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

  // 5. Close related OpenItems
  await tx.openItem.updateMany({
    where: { openingDocumentId: documentId, status: "OPEN" },
    data: {
      status: "CLOSED",
      dateClosed: new Date()
    }
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
}

/**
 * Reposts a document by voiding existing journal entries, updating its category,
 * and generating new entries.
 */
export async function repostDocument(
  documentId: string,
  newTypeId: string,
  tx: any = prisma,
  passedUserId?: string
) {
  // 1. Void document
  await voidDocument(documentId, tx, passedUserId);

  // 2. Update type and return to POSTED status
  await tx.document.update({
    where: { id: documentId },
    data: {
      typeId: newTypeId,
      status: "POSTED"
    }
  });

  // 3. Repost document entries
  return postDocument(documentId, tx, passedUserId);
}

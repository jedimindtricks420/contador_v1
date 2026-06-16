import prisma from "../prisma";
import Decimal from "decimal.js";

export interface JournalRow {
  date: Date;
  documentId: string;
  documentNumber: string;
  documentType: string;
  documentTypeName: string;
  counterpartyId: string | null;
  counterpartyName: string;
  debitAccountId: string;
  debitAccountCode: string;
  debitAccountName: string;
  creditAccountId: string;
  creditAccountCode: string;
  creditAccountName: string;
  amount: number;
}

export async function calculateJournal(
  orgId: string,
  from: Date,
  to: Date,
  filters: {
    accountId?: string;
    counterpartyId?: string;
    documentTypeId?: string;
  } = {}
) {
  const docWhere: any = {
    orgId,
    status: "POSTED",
    date: { gte: from, lte: to }
  };

  if (filters.documentTypeId && filters.documentTypeId !== "ALL") {
    docWhere.typeId = filters.documentTypeId;
  }

  if (filters.accountId && filters.accountId !== "ALL") {
    docWhere.journalEntries = {
      some: { accountId: filters.accountId }
    };
  }

  if (filters.counterpartyId && filters.counterpartyId !== "ALL") {
    if (docWhere.journalEntries) {
      docWhere.journalEntries.some = {
        ...docWhere.journalEntries.some,
        counterpartyId: filters.counterpartyId
      };
    } else {
      docWhere.journalEntries = {
        some: { counterpartyId: filters.counterpartyId }
      };
    }
  }

  const documents = await prisma.document.findMany({
    where: docWhere,
    include: {
      type: true,
      journalEntries: {
        include: {
          account: true,
          counterparty: true
        }
      }
    },
    orderBy: [
      { date: "asc" },
      { id: "asc" }
    ]
  });

  const allRows: JournalRow[] = [];

  for (const doc of documents) {
    const debits = doc.journalEntries.filter(e => new Decimal(e.debit.toString()).gt(0));
    const credits = doc.journalEntries.filter(e => new Decimal(e.credit.toString()).gt(0));

    if (debits.length === 0 || credits.length === 0) continue;

    let dIdx = 0;
    let cIdx = 0;
    let remDebit = new Decimal(debits[dIdx].debit.toString());
    let remCredit = new Decimal(credits[cIdx].credit.toString());

    while (dIdx < debits.length && cIdx < credits.length) {
      const pairAmount = Decimal.min(remDebit, remCredit);

      if (pairAmount.gt(0)) {
        const payload = (doc.payload || {}) as any;
        const documentNumber = payload.number || payload.documentNumber || doc.id.slice(0, 8);
        const counterpartyId = debits[dIdx].counterpartyId || credits[cIdx].counterpartyId || null;
        const counterpartyName = debits[dIdx].counterparty?.name || credits[cIdx].counterparty?.name || payload.counterpartyHint || "—";

        const row: JournalRow = {
          date: doc.date,
          documentId: doc.id,
          documentNumber: String(documentNumber),
          documentType: doc.type.code,
          documentTypeName: doc.type.name,
          counterpartyId,
          counterpartyName,
          debitAccountId: debits[dIdx].accountId,
          debitAccountCode: debits[dIdx].account.code,
          debitAccountName: debits[dIdx].account.name,
          creditAccountId: credits[cIdx].accountId,
          creditAccountCode: credits[cIdx].account.code,
          creditAccountName: credits[cIdx].account.name,
          amount: pairAmount.toNumber()
        };

        let match = true;
        if (filters.accountId && filters.accountId !== "ALL") {
          if (row.debitAccountId !== filters.accountId && row.creditAccountId !== filters.accountId) {
            match = false;
          }
        }
        if (filters.counterpartyId && filters.counterpartyId !== "ALL") {
          if (row.counterpartyId !== filters.counterpartyId) {
            match = false;
          }
        }

        if (match) {
          allRows.push(row);
        }
      }

      remDebit = remDebit.minus(pairAmount);
      remCredit = remCredit.minus(pairAmount);

      if (remDebit.isZero() || remDebit.lt(0.001)) {
        dIdx++;
        if (dIdx < debits.length) {
          remDebit = new Decimal(debits[dIdx].debit.toString());
        }
      }
      if (remCredit.isZero() || remCredit.lt(0.001)) {
        cIdx++;
        if (cIdx < credits.length) {
          remCredit = new Decimal(credits[cIdx].credit.toString());
        }
      }
    }
  }

  const totalAmount = allRows.reduce((sum, r) => sum.plus(new Decimal(r.amount)), new Decimal(0));

  return {
    rows: allRows,
    total: allRows.length,
    totals: {
      totalDebit: totalAmount.toNumber(),
      totalCredit: totalAmount.toNumber()
    }
  };
}

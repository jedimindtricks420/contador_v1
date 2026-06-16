import prisma from "../prisma";
import Decimal from "decimal.js";

export interface AccountCardRow {
  id: string;
  date: Date;
  documentId: string;
  documentType: string;
  documentTypeName: string;
  documentNumber: string;
  counterpartyName: string;
  debit: number;
  credit: number;
  runningBalance: number;
}

export async function calculateAccountCard(
  orgId: string,
  accountId: string,
  from: Date,
  to: Date
) {
  const account = await prisma.account.findUnique({
    where: { id: accountId }
  });

  if (!account) {
    throw new Error("Счёт не найден");
  }

  const isAssetOrExpense = ["ASSET", "EXPENSE"].includes(account.type);

  // 1. Calculate opening balance (date < from)
  const openingEntries = await prisma.journalEntry.findMany({
    where: {
      document: { orgId, status: "POSTED", date: { lt: from } },
      accountId: account.id
    }
  });

  const totalOpDb = openingEntries.reduce((sum, e) => sum.plus(new Decimal(e.debit.toString())), new Decimal(0));
  const totalOpCr = openingEntries.reduce((sum, e) => sum.plus(new Decimal(e.credit.toString())), new Decimal(0));

  let openingBalance = new Decimal(0);
  if (isAssetOrExpense) {
    openingBalance = totalOpDb.minus(totalOpCr);
  } else {
    openingBalance = totalOpCr.minus(totalOpDb);
  }

  // 2. Fetch journal entries in the date range
  const entries = await prisma.journalEntry.findMany({
    where: {
      document: { orgId, status: "POSTED", date: { gte: from, lte: to } },
      accountId: account.id
    },
    include: {
      document: {
        include: {
          type: true
        }
      },
      counterparty: true
    },
    orderBy: [
      { date: "asc" },
      { id: "asc" }
    ]
  });

  const rows: AccountCardRow[] = [];
  let currentBalance = new Decimal(openingBalance);

  for (const entry of entries) {
    const dbVal = new Decimal(entry.debit.toString());
    const crVal = new Decimal(entry.credit.toString());

    if (isAssetOrExpense) {
      currentBalance = currentBalance.plus(dbVal).minus(crVal);
    } else {
      currentBalance = currentBalance.plus(crVal).minus(dbVal);
    }

    const payload = (entry.document.payload || {}) as any;
    const documentNumber = payload.number || payload.documentNumber || payload.id?.slice(0, 8) || "";
    const counterpartyName = entry.counterparty?.name || payload.counterpartyHint || "—";

    rows.push({
      id: entry.id,
      date: entry.date,
      documentId: entry.documentId,
      documentType: entry.document.type.code,
      documentTypeName: entry.document.type.name,
      documentNumber: String(documentNumber),
      counterpartyName,
      debit: dbVal.toNumber(),
      credit: crVal.toNumber(),
      runningBalance: currentBalance.toNumber()
    });
  }

  return {
    account: {
      id: account.id,
      code: account.code,
      name: account.name,
      type: account.type
    },
    openingBalance: openingBalance.toNumber(),
    rows,
    closingBalance: currentBalance.toNumber()
  };
}

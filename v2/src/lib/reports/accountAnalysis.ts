import { calculateJournal } from "./journal";
import prisma from "../prisma";
import Decimal from "decimal.js";

export interface CorrespondentRow {
  code: string;
  name: string;
  amount: number;
}

export async function calculateAccountAnalysis(
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

  const { rows } = await calculateJournal(orgId, from, to, { accountId });

  const debitCorrespondents: Record<string, { code: string; name: string; amount: Decimal }> = {};
  const creditCorrespondents: Record<string, { code: string; name: string; amount: Decimal }> = {};

  let totalDebit = new Decimal(0);
  let totalCredit = new Decimal(0);

  for (const r of rows) {
    const amt = new Decimal(r.amount);
    if (r.debitAccountId === accountId) {
      const corrCode = r.creditAccountCode;
      const corrName = r.creditAccountName;
      totalDebit = totalDebit.plus(amt);
      if (!debitCorrespondents[corrCode]) {
        debitCorrespondents[corrCode] = { code: corrCode, name: corrName, amount: new Decimal(0) };
      }
      debitCorrespondents[corrCode].amount = debitCorrespondents[corrCode].amount.plus(amt);
    }
    if (r.creditAccountId === accountId) {
      const corrCode = r.debitAccountCode;
      const corrName = r.debitAccountName;
      totalCredit = totalCredit.plus(amt);
      if (!creditCorrespondents[corrCode]) {
        creditCorrespondents[corrCode] = { code: corrCode, name: corrName, amount: new Decimal(0) };
      }
      creditCorrespondents[corrCode].amount = creditCorrespondents[corrCode].amount.plus(amt);
    }
  }

  return {
    account: {
      id: account.id,
      code: account.code,
      name: account.name,
      type: account.type
    },
    debitCorrespondents: Object.values(debitCorrespondents).map(x => ({ ...x, amount: x.amount.toNumber() })),
    creditCorrespondents: Object.values(creditCorrespondents).map(x => ({ ...x, amount: x.amount.toNumber() })),
    totalDebit: totalDebit.toNumber(),
    totalCredit: totalCredit.toNumber()
  };
}

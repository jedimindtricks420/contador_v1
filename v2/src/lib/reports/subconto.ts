import prisma from "../prisma";
import Decimal from "decimal.js";

export interface SubcontoRow {
  counterpartyId: string;
  counterpartyName: string;
  counterpartyInn: string | null;
  accountId: string;
  accountCode: string;
  accountName: string;
  openingDebit: number;
  openingCredit: number;
  debitTurnover: number;
  creditTurnover: number;
  closingDebit: number;
  closingCredit: number;
}

type AggRow = {
  counterpartyId: string;
  counterpartyName: string;
  counterpartyInn: string | null;
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: string;
  sumDebit: string;
  sumCredit: string;
};

export async function calculateSubconto(
  orgId: string,
  from: Date,
  to: Date,
  accountId?: string
) {
  const accountFilter = accountId && accountId !== "ALL"
    ? `AND a.id = ${JSON.stringify(accountId)}`
    : "";

  const [openingAgg, turnoverAgg] = await Promise.all([
    prisma.$queryRaw<AggRow[]>`
      SELECT
        cp.id AS "counterpartyId", cp.name AS "counterpartyName", cp.inn AS "counterpartyInn",
        a.id AS "accountId", a.code AS "accountCode", a.name AS "accountName", a.type AS "accountType",
        SUM(je.debit)::text AS "sumDebit", SUM(je.credit)::text AS "sumCredit"
      FROM "JournalEntry" je
      JOIN "Document" d ON d.id = je."documentId"
      JOIN "Counterparty" cp ON cp.id = je."counterpartyId"
      JOIN "Account" a ON a.id = je."accountId"
      WHERE d."orgId" = ${orgId} AND d.status = 'POSTED' AND d.date < ${from}
        AND je."counterpartyId" IS NOT NULL
        AND cp."orgId" = ${orgId}
      GROUP BY cp.id, cp.name, cp.inn, a.id, a.code, a.name, a.type
    `,
    prisma.$queryRaw<AggRow[]>`
      SELECT
        cp.id AS "counterpartyId", cp.name AS "counterpartyName", cp.inn AS "counterpartyInn",
        a.id AS "accountId", a.code AS "accountCode", a.name AS "accountName", a.type AS "accountType",
        SUM(je.debit)::text AS "sumDebit", SUM(je.credit)::text AS "sumCredit"
      FROM "JournalEntry" je
      JOIN "Document" d ON d.id = je."documentId"
      JOIN "Counterparty" cp ON cp.id = je."counterpartyId"
      JOIN "Account" a ON a.id = je."accountId"
      WHERE d."orgId" = ${orgId} AND d.status = 'POSTED' AND d.date >= ${from} AND d.date <= ${to}
        AND je."counterpartyId" IS NOT NULL
        AND cp."orgId" = ${orgId}
      GROUP BY cp.id, cp.name, cp.inn, a.id, a.code, a.name, a.type
    `
  ]);

  // Apply account filter in memory (avoids SQL injection in dynamic filter)
  const filterAcc = (rows: AggRow[]) =>
    accountId && accountId !== "ALL" ? rows.filter(r => r.accountId === accountId) : rows;

  const filteredOpen = filterAcc(openingAgg);
  const filteredTurn = filterAcc(turnoverAgg);

  // Build a map keyed by "counterpartyId:accountId"
  const openMap = new Map(filteredOpen.map(r => [`${r.counterpartyId}:${r.accountId}`, r]));
  const turnMap = new Map(filteredTurn.map(r => [`${r.counterpartyId}:${r.accountId}`, r]));

  const allKeys = new Set([...openMap.keys(), ...turnMap.keys()]);
  const rows: SubcontoRow[] = [];

  for (const key of allKeys) {
    const op = openMap.get(key);
    const turn = turnMap.get(key);
    const meta = op || turn!;
    const isAssetOrExpense = ["ASSET", "EXPENSE"].includes(meta.accountType);

    const opDb = new Decimal(op?.sumDebit || 0);
    const opCr = new Decimal(op?.sumCredit || 0);
    const dbTurnover = new Decimal(turn?.sumDebit || 0);
    const crTurnover = new Decimal(turn?.sumCredit || 0);

    let openingDebit = new Decimal(0);
    let openingCredit = new Decimal(0);

    if (isAssetOrExpense) {
      const netDr = opDb.minus(opCr);
      if (netDr.gt(0)) openingDebit = netDr;
      else if (netDr.lt(0)) openingCredit = netDr.abs();
    } else {
      const netCr = opCr.minus(opDb);
      if (netCr.gt(0)) openingCredit = netCr;
      else if (netCr.lt(0)) openingDebit = netCr.abs();
    }

    let closingDebit = new Decimal(0);
    let closingCredit = new Decimal(0);

    if (isAssetOrExpense) {
      const netDr = openingDebit.minus(openingCredit).plus(dbTurnover).minus(crTurnover);
      if (netDr.gt(0)) closingDebit = netDr;
      else if (netDr.lt(0)) closingCredit = netDr.abs();
    } else {
      const netCr = openingCredit.minus(openingDebit).plus(crTurnover).minus(dbTurnover);
      if (netCr.gt(0)) closingCredit = netCr;
      else if (netCr.lt(0)) closingDebit = netCr.abs();
    }

    if (
      openingDebit.isZero() && openingCredit.isZero() &&
      dbTurnover.isZero() && crTurnover.isZero() &&
      closingDebit.isZero() && closingCredit.isZero()
    ) {
      continue;
    }

    rows.push({
      counterpartyId: meta.counterpartyId,
      counterpartyName: meta.counterpartyName,
      counterpartyInn: meta.counterpartyInn,
      accountId: meta.accountId,
      accountCode: meta.accountCode,
      accountName: meta.accountName,
      openingDebit: openingDebit.toNumber(),
      openingCredit: openingCredit.toNumber(),
      debitTurnover: dbTurnover.toNumber(),
      creditTurnover: crTurnover.toNumber(),
      closingDebit: closingDebit.toNumber(),
      closingCredit: closingCredit.toNumber()
    });
  }

  rows.sort((a, b) => a.counterpartyName.localeCompare(b.counterpartyName) || a.accountCode.localeCompare(b.accountCode));

  const totals = {
    openingDebit: rows.reduce((sum, r) => sum + r.openingDebit, 0),
    openingCredit: rows.reduce((sum, r) => sum + r.openingCredit, 0),
    debitTurnover: rows.reduce((sum, r) => sum + r.debitTurnover, 0),
    creditTurnover: rows.reduce((sum, r) => sum + r.creditTurnover, 0),
    closingDebit: rows.reduce((sum, r) => sum + r.closingDebit, 0),
    closingCredit: rows.reduce((sum, r) => sum + r.closingCredit, 0)
  };

  return { rows, totals };
}

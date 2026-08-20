import prisma from "../prisma";
import Decimal from "decimal.js";

export interface OSVRow {
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: string;
  openingDebit: number;
  openingCredit: number;
  debitTurnover: number;
  creditTurnover: number;
  closingDebit: number;
  closingCredit: number;
  subconto?: OSVSubcontoRow[];
}

export interface OSVSubcontoRow {
  counterpartyId: string;
  counterpartyName: string;
  openingDebit: number;
  openingCredit: number;
  debitTurnover: number;
  creditTurnover: number;
  closingDebit: number;
  closingCredit: number;
}

type AggRow = { accountId: string; sumDebit: string; sumCredit: string };
type SubcontoAggRow = { accountId: string; counterpartyId: string; counterpartyName: string; sumDebit: string; sumCredit: string };

// Returns closing balance columns based on account type and cumulative raw totals.
// ASSET/CONTRA_LIABILITY: debit-normal (net = Дт - Кт)
// LIABILITY/CONTRA_ASSET: credit-normal (net = Кт - Дт)
// ACTIVE_PASSIVE/TRANSIT: dual-sided (net = Дт - Кт, shown in whichever column fits)
// OFF_BALANCE: raw debit only (забалансовый — only debit column is meaningful)
function calcBalance(type: string, rawDebit: Decimal, rawCredit: Decimal): { d: Decimal; c: Decimal } {
  const zero = new Decimal(0);
  switch (type) {
    case "ASSET":
    case "CONTRA_LIABILITY":
    case "ACTIVE_PASSIVE":
    case "TRANSIT": {
      const net = rawDebit.minus(rawCredit);
      return net.gte(0) ? { d: net, c: zero } : { d: zero, c: net.abs() };
    }
    case "LIABILITY":
    case "CONTRA_ASSET": {
      const net = rawCredit.minus(rawDebit);
      return net.gte(0) ? { d: zero, c: net } : { d: net.abs(), c: zero };
    }
    case "OFF_BALANCE": {
      return { d: rawDebit, c: zero };
    }
    default: {
      const net = rawDebit.minus(rawCredit);
      return net.gte(0) ? { d: net, c: zero } : { d: zero, c: net.abs() };
    }
  }
}

export async function calculateOSV(
  orgId: string,
  from: Date,
  to: Date,
  expandSubconto: boolean = false
) {
  const accounts = await prisma.account.findMany({ orderBy: { code: "asc" } });

  const [openingAgg, turnoverAgg] = await Promise.all([
    prisma.$queryRaw<AggRow[]>`
      SELECT je."accountId", SUM(je.debit)::text AS "sumDebit", SUM(je.credit)::text AS "sumCredit"
      FROM "JournalEntry" je
      JOIN "Document" d ON d.id = je."documentId"
      WHERE d."orgId" = ${orgId} AND d.status = 'POSTED' AND d.date < ${from}
      GROUP BY je."accountId"
    `,
    prisma.$queryRaw<AggRow[]>`
      SELECT je."accountId", SUM(je.debit)::text AS "sumDebit", SUM(je.credit)::text AS "sumCredit"
      FROM "JournalEntry" je
      JOIN "Document" d ON d.id = je."documentId"
      WHERE d."orgId" = ${orgId} AND d.status = 'POSTED' AND d.date >= ${from} AND d.date <= ${to}
      GROUP BY je."accountId"
    `
  ]);

  const openingMap = new Map(openingAgg.map(r => [r.accountId, r]));
  const turnoverMap = new Map(turnoverAgg.map(r => [r.accountId, r]));

  const subcontoOpenMap = new Map<string, SubcontoAggRow[]>();
  const subcontoTurnMap = new Map<string, SubcontoAggRow[]>();

  if (expandSubconto) {
    const [subOpen, subTurn] = await Promise.all([
      prisma.$queryRaw<SubcontoAggRow[]>`
        SELECT je."accountId", je."counterpartyId", cp.name AS "counterpartyName",
               SUM(je.debit)::text AS "sumDebit", SUM(je.credit)::text AS "sumCredit"
        FROM "JournalEntry" je
        JOIN "Document" d ON d.id = je."documentId"
        JOIN "Counterparty" cp ON cp.id = je."counterpartyId"
        WHERE d."orgId" = ${orgId} AND d.status = 'POSTED' AND d.date < ${from}
          AND je."counterpartyId" IS NOT NULL
        GROUP BY je."accountId", je."counterpartyId", cp.name
      `,
      prisma.$queryRaw<SubcontoAggRow[]>`
        SELECT je."accountId", je."counterpartyId", cp.name AS "counterpartyName",
               SUM(je.debit)::text AS "sumDebit", SUM(je.credit)::text AS "sumCredit"
        FROM "JournalEntry" je
        JOIN "Document" d ON d.id = je."documentId"
        JOIN "Counterparty" cp ON cp.id = je."counterpartyId"
        WHERE d."orgId" = ${orgId} AND d.status = 'POSTED' AND d.date >= ${from} AND d.date <= ${to}
          AND je."counterpartyId" IS NOT NULL
        GROUP BY je."accountId", je."counterpartyId", cp.name
      `
    ]);

    for (const r of subOpen) {
      const list = subcontoOpenMap.get(r.accountId) || [];
      list.push(r);
      subcontoOpenMap.set(r.accountId, list);
    }
    for (const r of subTurn) {
      const list = subcontoTurnMap.get(r.accountId) || [];
      list.push(r);
      subcontoTurnMap.set(r.accountId, list);
    }
  }

  const rows: OSVRow[] = [];
  const totals = {
    openingDebit: new Decimal(0),
    openingCredit: new Decimal(0),
    debitTurnover: new Decimal(0),
    creditTurnover: new Decimal(0),
    closingDebit: new Decimal(0),
    closingCredit: new Decimal(0)
  };

  for (const acc of accounts) {
    const op = openingMap.get(acc.id);
    const turn = turnoverMap.get(acc.id);

    const opDb = new Decimal(op?.sumDebit || 0);
    const opCr = new Decimal(op?.sumCredit || 0);
    const dbTurnover = new Decimal(turn?.sumDebit || 0);
    const crTurnover = new Decimal(turn?.sumCredit || 0);

    const { d: openingDebit, c: openingCredit } = calcBalance(acc.type, opDb, opCr);
    const { d: closingDebit, c: closingCredit } = calcBalance(
      acc.type,
      opDb.plus(dbTurnover),
      opCr.plus(crTurnover)
    );

    if (
      openingDebit.isZero() && openingCredit.isZero() &&
      dbTurnover.isZero() && crTurnover.isZero() &&
      closingDebit.isZero() && closingCredit.isZero()
    ) {
      continue;
    }

    totals.openingDebit = totals.openingDebit.plus(openingDebit);
    totals.openingCredit = totals.openingCredit.plus(openingCredit);
    totals.debitTurnover = totals.debitTurnover.plus(dbTurnover);
    totals.creditTurnover = totals.creditTurnover.plus(crTurnover);
    totals.closingDebit = totals.closingDebit.plus(closingDebit);
    totals.closingCredit = totals.closingCredit.plus(closingCredit);

    const row: OSVRow = {
      accountId: acc.id,
      accountCode: acc.code,
      accountName: acc.name,
      accountType: acc.type,
      openingDebit: openingDebit.toNumber(),
      openingCredit: openingCredit.toNumber(),
      debitTurnover: dbTurnover.toNumber(),
      creditTurnover: crTurnover.toNumber(),
      closingDebit: closingDebit.toNumber(),
      closingCredit: closingCredit.toNumber()
    };

    if (expandSubconto) {
      const openRows = subcontoOpenMap.get(acc.id) || [];
      const turnRows = subcontoTurnMap.get(acc.id) || [];

      const cpIds = new Set([...openRows.map(r => r.counterpartyId), ...turnRows.map(r => r.counterpartyId)]);
      const subcontoRows: OSVSubcontoRow[] = [];

      for (const cpId of cpIds) {
        const opEntry = openRows.find(r => r.counterpartyId === cpId);
        const turnEntry = turnRows.find(r => r.counterpartyId === cpId);
        const cpName = opEntry?.counterpartyName || turnEntry?.counterpartyName || cpId;

        const cpOpDb = new Decimal(opEntry?.sumDebit || 0);
        const cpOpCr = new Decimal(opEntry?.sumCredit || 0);
        const cpDbTurn = new Decimal(turnEntry?.sumDebit || 0);
        const cpCrTurn = new Decimal(turnEntry?.sumCredit || 0);

        const { d: cpOpDebit, c: cpOpCredit } = calcBalance(acc.type, cpOpDb, cpOpCr);
        const { d: cpClDebit, c: cpClCredit } = calcBalance(
          acc.type,
          cpOpDb.plus(cpDbTurn),
          cpOpCr.plus(cpCrTurn)
        );

        if (
          !cpOpDebit.isZero() || !cpOpCredit.isZero() ||
          !cpDbTurn.isZero() || !cpCrTurn.isZero() ||
          !cpClDebit.isZero() || !cpClCredit.isZero()
        ) {
          subcontoRows.push({
            counterpartyId: cpId,
            counterpartyName: cpName,
            openingDebit: cpOpDebit.toNumber(),
            openingCredit: cpOpCredit.toNumber(),
            debitTurnover: cpDbTurn.toNumber(),
            creditTurnover: cpCrTurn.toNumber(),
            closingDebit: cpClDebit.toNumber(),
            closingCredit: cpClCredit.toNumber()
          });
        }
      }

      if (subcontoRows.length > 0) {
        row.subconto = subcontoRows;
      }
    }

    rows.push(row);
  }

  return {
    rows,
    totals: {
      openingDebit: totals.openingDebit.toNumber(),
      openingCredit: totals.openingCredit.toNumber(),
      debitTurnover: totals.debitTurnover.toNumber(),
      creditTurnover: totals.creditTurnover.toNumber(),
      closingDebit: totals.closingDebit.toNumber(),
      closingCredit: totals.closingCredit.toNumber()
    }
  };
}

import { NextRequest, NextResponse } from "next/server";
import { getActiveMembership } from "@/lib/context";
import prisma from "@/lib/prisma";
import { ACCOUNTS } from "@/lib/constants";

interface BalanceLine {
  accountCode: string;
  debit: number;
  credit: number;
}

export async function GET() {
  try {
    const membership = await getActiveMembership();
    const orgId = membership.orgId;

    // Return existing opening balance entries
    const existingDoc = await prisma.document.findFirst({
      where: { orgId, type: { code: "OPENING_BALANCE" }, status: "POSTED" },
      include: {
        journalEntries: { include: { account: { select: { code: true, name: true } } } }
      },
      orderBy: { date: "asc" }
    });

    if (!existingDoc) return NextResponse.json({ lines: [] });

    const lines = existingDoc.journalEntries
      .filter(je => je.account.code !== ACCOUNTS.OPENING_BALANCE_EQUITY)
      .map(je => ({
        accountCode: je.account.code,
        accountName: je.account.name,
        debit: Number(je.debit),
        credit: Number(je.credit)
      }));

    return NextResponse.json({ lines, documentId: existingDoc.id });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED") return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const membership = await getActiveMembership();
    const orgId = membership.orgId;
    const { lines, date }: { lines: BalanceLine[]; date: string } = await req.json();

    if (!lines || lines.length === 0) {
      return NextResponse.json({ error: "Нужна хотя бы одна строка" }, { status: 400 });
    }

    // Find earliest open period or create one
    let period = await prisma.period.findFirst({
      where: { orgId, status: "OPEN" },
      orderBy: [{ year: "asc" }, { month: "asc" }]
    });
    if (!period) {
      const now = new Date();
      period = await prisma.period.create({
        data: { orgId, year: now.getFullYear(), month: now.getMonth() + 1, status: "OPEN", mode: "ACTIVE" }
      });
    }

    const balanceDate = date ? new Date(date) : new Date(period.year, period.month - 1, 1);

    // Ensure OPENING_BALANCE document type exists
    let obType = await prisma.documentType.findUnique({ where: { code: "OPENING_BALANCE" } });
    if (!obType) {
      obType = await prisma.documentType.create({
        data: {
          code: "OPENING_BALANCE",
          name: "Ввод начальных остатков",
          mode: "MANUAL_ONLY",
          postingTemplate: { lines: [], opensItem: false }
        }
      });
    }

    // Ensure equity "counterpart" account 8890 exists
    let eq8890 = await prisma.account.findUnique({ where: { code: ACCOUNTS.OPENING_BALANCE_EQUITY } });
    if (!eq8890) {
      const parent88 = await prisma.account.findFirst({ where: { code: { startsWith: "88" } } });
      eq8890 = await prisma.account.create({
        data: {
          code: ACCOUNTS.OPENING_BALANCE_EQUITY,
          name: "Нераспределённая прибыль (начальный остаток)",
          type: "LIABILITY",
          isSystem: false,
          parentId: parent88?.id ?? null
        }
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      // Void/delete existing opening balance doc
      const existing = await tx.document.findFirst({
        where: { orgId, type: { code: "OPENING_BALANCE" }, status: "POSTED" }
      });
      if (existing) {
        await tx.journalEntry.deleteMany({ where: { documentId: existing.id } });
        await tx.document.update({ where: { id: existing.id }, data: { status: "VOIDED" } });
      }

      // Create new document
      const doc = await tx.document.create({
        data: {
          orgId,
          periodId: period!.id,
          typeId: obType!.id,
          date: balanceDate,
          status: "POSTED",
          payload: { note: "Ввод начальных остатков" } as any
        }
      });

      // Build journal entries
      let totalDebit = 0;
      let totalCredit = 0;
      const entries: any[] = [];

      for (const line of lines) {
        if (line.debit === 0 && line.credit === 0) continue;
        const account = await tx.account.findUnique({ where: { code: line.accountCode } });
        if (!account) throw new Error(`Счёт ${line.accountCode} не найден`);

        entries.push({
          documentId: doc.id,
          accountId: account.id,
          debit: line.debit,
          credit: line.credit,
          date: balanceDate
        });
        totalDebit += line.debit;
        totalCredit += line.credit;
      }

      // Balance using 8890
      const diff = totalDebit - totalCredit;
      if (diff > 0) {
        entries.push({ documentId: doc.id, accountId: eq8890!.id, debit: 0, credit: diff, date: balanceDate });
      } else if (diff < 0) {
        entries.push({ documentId: doc.id, accountId: eq8890!.id, debit: -diff, credit: 0, date: balanceDate });
      }

      await tx.journalEntry.createMany({ data: entries });

      return doc;
    });

    return NextResponse.json({ id: result.id }, { status: 201 });
  } catch (err: any) {
    console.error("OPENING BALANCE POST ERROR:", err);
    if (err.message === "UNAUTHORIZED") return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

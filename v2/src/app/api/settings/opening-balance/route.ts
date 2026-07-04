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
    if (err.message === "UNAUTHORIZED" || err.message === "NO_ACTIVE_ORG") return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    return NextResponse.json({ error: "Внутренняя ошибка сервера" }, { status: 500 });
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

    // Reject unbalanced input up front — no more silent parking of the difference
    // on 8890. The caller must add the missing line themselves (see 8890's real
    // purpose: "Прочие целевые поступления", not a balancing plug).
    let totalDebitCheck = 0;
    let totalCreditCheck = 0;
    for (const line of lines) {
      totalDebitCheck += line.debit;
      totalCreditCheck += line.credit;
    }
    const diffCheck = Math.round((totalDebitCheck - totalCreditCheck) * 100) / 100;
    if (diffCheck !== 0) {
      return NextResponse.json(
        { error: `Строки не сбалансированы. Разница: ${diffCheck}. Добавьте недостающую проводку (например, по уставному капиталу или нераспределённой прибыли).` },
        { status: 400 }
      );
    }

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

      // Build journal entries — balance already verified above (diffCheck === 0),
      // so no plug entry into 8890 is needed here.
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
      }

      await tx.journalEntry.createMany({ data: entries });

      return doc;
    });

    return NextResponse.json({ id: result.id }, { status: 201 });
  } catch (err: any) {
    console.error("OPENING BALANCE POST ERROR:", err);
    if (err.message === "UNAUTHORIZED" || err.message === "NO_ACTIVE_ORG") return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    return NextResponse.json({ error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}

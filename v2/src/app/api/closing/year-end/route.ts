import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getActiveOrgId } from "@/lib/context";
import { ACCOUNTS } from "@/lib/constants";
import Decimal from "decimal.js";

class YearEndAlreadyDoneError extends Error {
  constructor() {
    super("Годовое закрытие уже выполнено для этого периода");
    this.name = "YearEndAlreadyDoneError";
  }
}

// Перенос финансового результата (9910) в нераспределённую прибыль (8710) в конце года.
// Дт 9910 — Кт 8710 (прибыль) / Дт 8710 — Кт 9910 (убыток)
export async function POST(req: NextRequest) {
  try {
    const orgId = await getActiveOrgId();
    const { periodId } = await req.json();

    const period = await prisma.period.findFirst({ where: { id: periodId, orgId } });
    if (!period) return NextResponse.json({ error: "Период не найден" }, { status: 404 });
    if (period.month !== 12) return NextResponse.json({ error: "Годовое закрытие только в декабре" }, { status: 400 });
    if (period.status !== "CLOSED") return NextResponse.json({ error: "Период должен быть сначала закрыт" }, { status: 400 });

    // Fast, non-authoritative check for early user feedback — the real guarantee
    // against double-transfer is the advisory lock + re-check inside the
    // transaction below (this one alone would be a TOCTOU race).
    const existing = await prisma.document.findFirst({
      where: { orgId, periodId, type: { code: "YEAR_END_CLOSE" } }
    });
    if (existing) {
      return NextResponse.json({ error: "Годовое закрытие уже выполнено для этого периода" }, { status: 409 });
    }

    const year = period.year;

    // Суммарное сальдо 9910 за весь год.
    // Знак: net9910 = Σ(credit − debit) → ПРИБЫЛЬ при net9910 > 0 (интуитивная конвенция,
    // согласована с src/lib/closing.ts — там же исторически был обратный знак, что уже
    // приводило к ошибке в реализации).
    const result = await prisma.$queryRaw<{ net: string }[]>`
      SELECT COALESCE(SUM(je.credit - je.debit), 0)::text AS net
      FROM "JournalEntry" je
      JOIN "Document" d ON d.id = je."documentId"
      JOIN "Account" a ON a.id = je."accountId"
      WHERE d."orgId" = ${orgId} AND d.status = 'POSTED'
        AND EXTRACT(YEAR FROM d.date) = ${year}
        AND a.code = '9910'
    `;

    const net9910 = new Decimal(result[0]?.net || "0");
    if (net9910.isZero()) {
      return NextResponse.json({ message: "Сальдо 9910 = 0, перенос не требуется", transferred: 0 });
    }

    const [acc9910, acc8710] = await Promise.all([
      prisma.account.findUnique({ where: { code: ACCOUNTS.FINAL_RESULT } }),
      prisma.account.findUnique({ where: { code: ACCOUNTS.RETAINED_EARNINGS } })
    ]);
    if (!acc9910 || !acc8710) {
      return NextResponse.json({ error: "Счета 9910 или 8710 не найдены в плане счетов" }, { status: 500 });
    }

    let yearEndType = await prisma.documentType.findUnique({ where: { code: "YEAR_END_CLOSE" } });
    if (!yearEndType) {
      yearEndType = await prisma.documentType.create({
        data: {
          code: "YEAR_END_CLOSE",
          name: "Перенос финансового результата в нераспределённую прибыль",
          postingTemplate: { lines: [], opensItem: false }
        }
      });
    }

    const docDate = new Date(year, 11, 31); // 31 декабря
    const amt = net9910.abs();

    await prisma.$transaction(async (tx) => {
      // Advisory lock scoped to this period, auto-released on commit/rollback —
      // serialises concurrent year-end-close submissions for the SAME period so
      // the existence re-check right below can't race (see the analogous fix in
      // closing/[periodId]/step/[stepNumber]/complete/route.ts for SOLIQ_IMPORT).
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('YEAR_END_CLOSE'), hashtext(${periodId}))`;

      const alreadyDone = await tx.document.findFirst({
        where: { orgId, periodId, type: { code: "YEAR_END_CLOSE" } }
      });
      if (alreadyDone) {
        throw new YearEndAlreadyDoneError();
      }

      const doc = await tx.document.create({
        data: {
          orgId, periodId, typeId: yearEndType!.id,
          date: docDate, status: "POSTED",
          payload: { type: "year_end_close", year, net9910: net9910.toNumber() } as any
        }
      });

      // net9910 < 0 → дебетовый остаток у 9910 (убыток): Дт 8710 — Кт 9910
      // net9910 > 0 → кредитовый остаток у 9910 (прибыль): Дт 9910 — Кт 8710
      const entries = net9910.lt(0)
        ? [
            { documentId: doc.id, accountId: acc8710!.id, debit: amt, credit: new Decimal(0), date: docDate },
            { documentId: doc.id, accountId: acc9910!.id, debit: new Decimal(0), credit: amt, date: docDate }
          ]
        : [
            { documentId: doc.id, accountId: acc9910!.id, debit: amt, credit: new Decimal(0), date: docDate },
            { documentId: doc.id, accountId: acc8710!.id, debit: new Decimal(0), credit: amt, date: docDate }
          ];

      await tx.journalEntry.createMany({ data: entries });

      await tx.auditLog.create({
        data: {
          orgId,
          userId: "system",
          action: "YEAR_END_CLOSE",
          entityType: "Document",
          entityId: doc.id,
          newValue: { year, net9910: net9910.toNumber() } as any
        }
      });
    });

    return NextResponse.json({
      message: net9910.gt(0) ? "Прибыль перенесена в нераспределённую прибыль (8710)" : "Убыток перенесён в нераспределённую прибыль (8710)",
      transferred: amt.toNumber(),
      isProfit: net9910.gt(0)
    });
  } catch (err: any) {
    if (err instanceof YearEndAlreadyDoneError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    console.error("YEAR END CLOSE ERROR:", err);
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getActiveMembership } from "@/lib/context";
import { ACCOUNTS } from "@/lib/constants";
import Decimal from "decimal.js";
import { z } from "zod";
import { assertAccountingWriteRole } from "@/lib/posting/documentPolicy";
import { tashkentDate } from "@/lib/accountingDate";

// Перенос финансового результата (9910) в нераспределённую прибыль (8710) в конце года.
// Дт 9910 — Кт 8710 (прибыль) / Дт 8710 — Кт 9910 (убыток)
export async function POST(req: NextRequest) {
  try {
    const membership = await getActiveMembership();
    assertAccountingWriteRole(membership.role);
    const orgId = membership.orgId;
    const body = z.object({ periodId: z.string().min(1) }).strict().safeParse(await req.json().catch(() => null));
    if (!body.success) return NextResponse.json({ error: "Некорректный период" }, { status: 400 });
    const { periodId } = body.data;

    return await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Period" WHERE "id" = ${periodId} AND "orgId" = ${orgId} FOR NO KEY UPDATE`;
    const period = await tx.period.findFirst({ where: { id: periodId, orgId } });
    if (!period) return NextResponse.json({ error: "Период не найден" }, { status: 404 });
    if (period.month !== 12) return NextResponse.json({ error: "Годовое закрытие только в декабре" }, { status: 400 });
    if (period.status !== "CLOSED") return NextResponse.json({ error: "Период должен быть сначала закрыт" }, { status: 400 });

    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('YEAR_END_CLOSE'), hashtext(${periodId}))`;
    const existing = await tx.document.findFirst({
      where: { orgId, periodId, type: { code: "YEAR_END_CLOSE" } }
    });
    if (existing) {
      if (existing.status !== "POSTED") {
        return NextResponse.json({
          error: "Найден непроведённый документ годового закрытия. Требуется сверка перед повторным переносом.",
          code: "YEAR_END_REQUIRES_REVIEW",
        }, { status: 409 });
      }
      return NextResponse.json({ error: "Годовое закрытие уже выполнено для этого периода" }, { status: 409 });
    }

    const year = period.year;
    const yearStart = tashkentDate(year, 0, 1);
    const nextYearStart = tashkentDate(year + 1, 0, 1);

    // Суммарное сальдо 9910 за весь год.
    // Знак: net9910 = Σ(credit − debit) → ПРИБЫЛЬ при net9910 > 0 (интуитивная конвенция,
    // согласована с src/lib/closing.ts — там же исторически был обратный знак, что уже
    // приводило к ошибке в реализации).
    const result = await tx.$queryRaw<{ net: string }[]>`
      SELECT COALESCE(SUM(je.credit - je.debit), 0)::text AS net
      FROM "JournalEntry" je
      JOIN "Document" d ON d.id = je."documentId"
      JOIN "Account" a ON a.id = je."accountId"
      WHERE d."orgId" = ${orgId} AND d.status = 'POSTED'
        AND d.date >= ${yearStart} AND d.date < ${nextYearStart}
        AND a.code = '9910'
    `;

    const net9910 = new Decimal(result[0]?.net || "0");
    if (net9910.isZero()) {
      return NextResponse.json({ message: "Сальдо 9910 = 0, перенос не требуется", transferred: 0 });
    }

    const [acc9910, acc8710] = await Promise.all([
      tx.account.findUnique({ where: { code: ACCOUNTS.FINAL_RESULT } }),
      tx.account.findUnique({ where: { code: ACCOUNTS.RETAINED_EARNINGS } })
    ]);
    if (!acc9910 || !acc8710) {
      return NextResponse.json({ error: "Счета 9910 или 8710 не найдены в плане счетов" }, { status: 500 });
    }

    let yearEndType = await tx.documentType.findUnique({ where: { code: "YEAR_END_CLOSE" } });
    if (!yearEndType) {
      yearEndType = await tx.documentType.create({
        data: {
          code: "YEAR_END_CLOSE",
          name: "Перенос финансового результата в нераспределённую прибыль",
          postingTemplate: { lines: [], opensItem: false }
        }
      });
    }

    const docDate = new Date(nextYearStart.getTime() - 1);
    const amt = net9910.abs();

      const doc = await tx.document.create({
        data: {
          orgId, periodId, typeId: yearEndType!.id,
          date: docDate, status: "POSTED",
          payload: { type: "year_end_close", year, net9910: net9910.toFixed(2) } as any
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
          userId: membership.userId,
          action: "YEAR_END_CLOSE",
          entityType: "Document",
          entityId: doc.id,
          newValue: { year, net9910: net9910.toFixed(2) } as any
        }
      });
    return NextResponse.json({
      message: net9910.gt(0) ? "Прибыль перенесена в нераспределённую прибыль (8710)" : "Убыток перенесён в нераспределённую прибыль (8710)",
      transferred: amt.toNumber(),
      isProfit: net9910.gt(0)
    });
    }, { maxWait: 5000, timeout: 30000 });
  } catch (err: any) {
    console.error("YEAR END CLOSE ERROR:", err);
    return NextResponse.json({ error: err.message || "Internal error" }, {
      status: ["FORBIDDEN", "NO_ACTIVE_ORG"].includes(err.message) ? 403 : 500,
    });
  }
}

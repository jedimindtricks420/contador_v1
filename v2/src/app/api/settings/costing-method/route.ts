import { NextRequest, NextResponse } from "next/server";
import { getActiveOrgId, getActiveMembership } from "@/lib/context";
import prisma from "@/lib/prisma";
import { getCostingMethodForYear } from "@/lib/taxReport/engine";

// Метод себестоимости (ТЗ, раздел 0.3): выбирается один раз, фиксируется на
// весь налоговый год, смена — только после полного закрытия предыдущего года.
// Тумблера нет; история в OrgCostingMethodHistory, чтобы отчёты за прошлые
// годы всегда считались по методу, действовавшему в ТОМ году.

// GET /api/settings/costing-method?year=2026
export async function GET(req: NextRequest) {
  try {
    const orgId = await getActiveOrgId();
    const { searchParams } = new URL(req.url);
    const year = Number(searchParams.get("year") ?? new Date().getFullYear());

    const [history, effective] = await Promise.all([
      prisma.orgCostingMethodHistory.findMany({
        where: { orgId },
        orderBy: { fiscalYear: "asc" },
        select: { fiscalYear: true, costingMethod: true, setAt: true },
      }),
      getCostingMethodForYear(orgId, year),
    ]);

    return NextResponse.json({ year, effectiveMethod: effective, history });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED" || err.message === "NO_ACTIVE_ORG") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("GET /api/settings/costing-method error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// POST { fiscalYear, costingMethod: 'PROPORTIONAL' | 'DIRECT' }
export async function POST(req: NextRequest) {
  try {
    const orgId = await getActiveOrgId();
    const membership = await getActiveMembership();
    if (membership.role !== "OWNER" && membership.role !== "ADMIN") {
      return NextResponse.json({ error: "Метод себестоимости может фиксировать только владелец или администратор" }, { status: 403 });
    }

    const body = await req.json();
    const fiscalYear = Number(body.fiscalYear);
    const costingMethod = body.costingMethod;

    if (!Number.isInteger(fiscalYear) || fiscalYear < 2000 || fiscalYear > 2100) {
      return NextResponse.json({ error: "Некорректный налоговый год" }, { status: 400 });
    }
    if (costingMethod !== "PROPORTIONAL" && costingMethod !== "DIRECT") {
      return NextResponse.json({ error: "costingMethod должен быть PROPORTIONAL или DIRECT" }, { status: 400 });
    }

    // Запись на этот год уже есть — менять нельзя, пока год не закрыт полностью;
    // а после закрытия года метод меняют записью на СЛЕДУЮЩИЙ год, не задним
    // числом (история должна отражать метод, по которому год реально вёлся).
    const existingForYear = await prisma.orgCostingMethodHistory.findUnique({
      where: { orgId_fiscalYear: { orgId, fiscalYear } },
    });
    if (existingForYear) {
      return NextResponse.json(
        { error: `Метод себестоимости на ${fiscalYear} год уже зафиксирован (${existingForYear.costingMethod}). ` +
                 `Метод фиксируется на весь год; изменить его можно только с нового налогового года после полного закрытия текущего.` },
        { status: 409 }
      );
    }

    const anyRecord = await prisma.orgCostingMethodHistory.findFirst({ where: { orgId } });
    const inherited = await getCostingMethodForYear(orgId, fiscalYear);

    // Первый выбор — свободно в любой момент года; фиксация того же метода,
    // что уже действует (унаследован с прошлого года), — тоже не смена.
    const isChange = anyRecord !== null && inherited !== null && inherited !== costingMethod;

    if (isChange) {
      // Смена метода на год N разрешена только при полностью закрытом годе N-1:
      // ни одного открытого периода до года N и закрытый декабрь года N-1
      // (реформация года выполнена — годовая отчётность подтверждена).
      const prevYear = fiscalYear - 1;
      const openBefore = await prisma.period.count({
        where: { orgId, year: { lt: fiscalYear }, status: "OPEN" },
      });
      const decemberClosed = await prisma.period.findFirst({
        where: { orgId, year: prevYear, month: 12, status: "CLOSED" },
      });
      if (openBefore > 0 || !decemberClosed) {
        return NextResponse.json(
          { error: `Смена метода себестоимости на ${fiscalYear} год возможна только после полного закрытия ${prevYear} года ` +
                   `(все периоды закрыты, включая декабрь). Метод фиксируется на весь год.` },
          { status: 409 }
        );
      }
    }

    const record = await prisma.orgCostingMethodHistory.create({
      data: { orgId, fiscalYear, costingMethod, setById: membership.userId ?? null },
    });

    return NextResponse.json({
      fiscalYear: record.fiscalYear,
      costingMethod: record.costingMethod,
      setAt: record.setAt,
    }, { status: 201 });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED" || err.message === "NO_ACTIVE_ORG") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("POST /api/settings/costing-method error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

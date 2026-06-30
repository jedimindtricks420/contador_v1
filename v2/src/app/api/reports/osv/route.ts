import { NextRequest, NextResponse } from "next/server";
import { getActiveMembership, badRequest } from "@/lib/context";
import { calculateOSV } from "@/lib/reports/osv";

export async function GET(req: NextRequest) {
  try {
    const membership = await getActiveMembership();

    const { searchParams } = new URL(req.url);
    const fromStr = searchParams.get("from");
    const toStr = searchParams.get("to");
    const expandSubconto = searchParams.get("expandSubconto") === "true";

    if (!fromStr || !toStr) {
      return badRequest("Параметры 'from' и 'to' обязательны");
    }

    const fromDate = new Date(fromStr);
    const toDate = new Date(toStr);

    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      return badRequest("Некорректный формат дат");
    }

    const data = await calculateOSV(membership.orgId, fromDate, toDate, expandSubconto);
    return NextResponse.json(data);
  } catch (err: any) {
    console.error("OSV API ERROR:", err);
    if (err.message === "UNAUTHORIZED") {
      return Response.json({ error: "Не авторизован" }, { status: 401 });
    }
    if (err.message === "FORBIDDEN" || err.message === "NO_ACTIVE_ORG") {
      return Response.json({ error: "Нет доступа" }, { status: 403 });
    }
    return NextResponse.json({ error: err.message || "Внутренняя ошибка сервера" }, { status: 500 });
  }
}

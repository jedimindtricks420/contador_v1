import { NextRequest, NextResponse } from "next/server";
import { getActiveMembership, forbidden, badRequest } from "@/lib/context";
import { calculateAccountAnalysis } from "@/lib/reports/accountAnalysis";

export async function GET(req: NextRequest) {
  try {
    const membership = await getActiveMembership();

    const { searchParams } = new URL(req.url);
    const accountId = searchParams.get("accountId");
    const fromStr = searchParams.get("from");
    const toStr = searchParams.get("to");

    if (!accountId) {
      return badRequest("Параметр 'accountId' обязателен");
    }
    if (!fromStr || !toStr) {
      return badRequest("Параметры 'from' и 'to' обязательны");
    }

    const fromDate = new Date(fromStr);
    const toDate = new Date(toStr);

    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      return badRequest("Некорректный формат дат");
    }

    const data = await calculateAccountAnalysis(membership.orgId, accountId, fromDate, toDate);
    return NextResponse.json(data);
  } catch (err: any) {
    console.error("ACCOUNT ANALYSIS API ERROR:", err);
    if (err.message === "UNAUTHORIZED") {
      return Response.json({ error: "Не авторизован" }, { status: 401 });
    }
    if (err.message === "FORBIDDEN" || err.message === "NO_ACTIVE_ORG") {
      return Response.json({ error: "Нет доступа" }, { status: 403 });
    }
    return NextResponse.json({ error: err.message || "Внутренняя ошибка сервера" }, { status: 500 });
  }
}

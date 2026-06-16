import { NextRequest, NextResponse } from "next/server";
import { getActiveMembership, forbidden, badRequest } from "@/lib/context";
import { calculateJournal } from "@/lib/reports/journal";

export async function GET(req: NextRequest) {
  try {
    const membership = await getActiveMembership();

    const { searchParams } = new URL(req.url);
    const fromStr = searchParams.get("from");
    const toStr = searchParams.get("to");
    const accountId = searchParams.get("accountId") || undefined;
    const documentTypeId = searchParams.get("documentTypeId") || undefined;
    const counterpartyId = searchParams.get("counterpartyId") || undefined;

    if (!fromStr || !toStr) {
      return badRequest("Параметры 'from' и 'to' обязательны");
    }

    const fromDate = new Date(fromStr);
    const toDate = new Date(toStr);

    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      return badRequest("Некорректный формат дат");
    }

    const data = await calculateJournal(membership.orgId, fromDate, toDate, {
      accountId,
      documentTypeId,
      counterpartyId
    });

    return NextResponse.json(data);
  } catch (err: any) {
    console.error("JOURNAL API ERROR:", err);
    if (err.message === "UNAUTHORIZED") {
      return Response.json({ error: "Не авторизован" }, { status: 401 });
    }
    if (err.message === "FORBIDDEN" || err.message === "NO_ACTIVE_ORG") {
      return Response.json({ error: "Нет доступа" }, { status: 403 });
    }
    return NextResponse.json({ error: err.message || "Внутренняя ошибка сервера" }, { status: 500 });
  }
}

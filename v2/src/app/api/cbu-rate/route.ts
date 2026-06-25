import { NextRequest, NextResponse } from "next/server";
import { getActiveOrgId } from "@/lib/context";

export async function GET(req: NextRequest) {
  try {
    await getActiveOrgId();

    const res = await fetch("https://cbu.uz/uz/arkhiv-kursov-valyut/json/USD/", {
      next: { revalidate: 3600 }
    });
    if (!res.ok) {
      return NextResponse.json({ error: "CBU API недоступен" }, { status: 502 });
    }
    const data = await res.json();
    const entry = Array.isArray(data) ? data[0] : null;
    if (!entry?.Rate) {
      return NextResponse.json({ error: "Неверный формат ответа CBU" }, { status: 502 });
    }
    return NextResponse.json({
      rate: parseFloat(entry.Rate),
      date: entry.Date,
      currency: entry.Ccy
    });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED" || err.message === "NO_ACTIVE_ORG") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Ошибка получения курса" }, { status: 500 });
  }
}

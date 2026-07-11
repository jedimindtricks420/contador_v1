import { NextRequest, NextResponse } from "next/server";
import { getActiveOrgId } from "@/lib/context";
import { generateProfitTaxReport } from "@/lib/taxReport/engine";

// GET /api/reports/profit-tax?year=2026&quarter=2
// «Зеркало» формы my.soliq.uz: основная форма 010–150 + Приложения №1/№2 +
// статусы остальных приложений. Read-only, считается на лету из проводок
// нарастающим итогом с начала года (ТЗ, разделы 2–5).
export async function GET(req: NextRequest) {
  try {
    const orgId = await getActiveOrgId();
    const { searchParams } = new URL(req.url);

    const now = new Date();
    const year = Number(searchParams.get("year") ?? now.getFullYear());
    const quarter = Number(searchParams.get("quarter") ?? Math.floor(now.getMonth() / 3) + 1);

    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      return NextResponse.json({ error: "Некорректный год" }, { status: 400 });
    }
    if (!Number.isInteger(quarter) || quarter < 1 || quarter > 4) {
      return NextResponse.json({ error: "Квартал должен быть от 1 до 4" }, { status: 400 });
    }

    const report = await generateProfitTaxReport(orgId, year, quarter);
    return NextResponse.json(report);
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED" || err.message === "NO_ACTIVE_ORG") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("GET /api/reports/profit-tax error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

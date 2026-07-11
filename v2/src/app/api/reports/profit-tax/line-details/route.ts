import { NextRequest, NextResponse } from "next/server";
import { getActiveOrgId } from "@/lib/context";
import { getProfitTaxLineDetails } from "@/lib/taxReport/engine";

// GET /api/reports/profit-tax/line-details?year=&quarter=&appendix=APPENDIX_2&line=0111
// Расшифровка строки приложения: исходные документы с суммами вклада
// (drill-down среднего блока дашборда, ТЗ раздел 5).
export async function GET(req: NextRequest) {
  try {
    const orgId = await getActiveOrgId();
    const { searchParams } = new URL(req.url);

    const now = new Date();
    const year = Number(searchParams.get("year") ?? now.getFullYear());
    const quarter = Number(searchParams.get("quarter") ?? Math.floor(now.getMonth() / 3) + 1);
    const appendix = searchParams.get("appendix");
    const line = searchParams.get("line");

    if (!Number.isInteger(year) || !Number.isInteger(quarter) || quarter < 1 || quarter > 4) {
      return NextResponse.json({ error: "Некорректные year/quarter" }, { status: 400 });
    }
    if (appendix !== "APPENDIX_1" && appendix !== "APPENDIX_2") {
      return NextResponse.json({ error: "appendix должен быть APPENDIX_1 или APPENDIX_2" }, { status: 400 });
    }
    if (!line) {
      return NextResponse.json({ error: "Не указан код строки (line)" }, { status: 400 });
    }

    const details = await getProfitTaxLineDetails(orgId, year, quarter, appendix, line);
    return NextResponse.json({ appendix, line, details });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED" || err.message === "NO_ACTIVE_ORG") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("GET /api/reports/profit-tax/line-details error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

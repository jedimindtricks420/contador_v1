import { NextResponse } from "next/server";
import { getActiveOrgId } from "@/lib/context";

export async function POST(request: Request) {
  try {
    const orgId = await getActiveOrgId();
    const body = await request.json();
    const { code } = body;
    if (!code || typeof code !== "string" || !code.trim()) {
      return NextResponse.json({ error: "Введите код ваучера" }, { status: 400 });
    }
    const adminApiUrl = process.env.ADMIN_API_URL || "http://localhost:3031";
    const adminRes = await fetch(`${adminApiUrl}/admin/api/v2/vouchers/redeem`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orgId, code: code.trim().toUpperCase() }),
    });
    const data = await adminRes.json();
    if (!adminRes.ok) {
      return NextResponse.json({ error: data.error || "Ошибка применения ваучера" }, { status: adminRes.status });
    }
    return NextResponse.json(data);
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED" || err.message === "NO_ACTIVE_ORG") {
      return NextResponse.redirect(new URL("/v2/login", request.url), 307);
    }
    return NextResponse.json({ error: "Внутренняя ошибка" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { getSession } from "@/lib/context";
import { getUserActivePro } from "@/lib/billing";

export async function GET() {
  try {
    const session = await getSession();

    const { isPro, validUntil } = await getUserActivePro(session.userId);

    const now = new Date();
    const daysLeft =
      validUntil
        ? Math.max(0, Math.ceil((validUntil.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
        : null;

    let proPrice = 299000;
    try {
      const adminApiUrl = process.env.ADMIN_API_URL || "http://localhost:3031";
      const priceRes = await fetch(`${adminApiUrl}/admin/api/payment-info`);
      if (priceRes.ok) {
        const priceData = await priceRes.json();
        proPrice = priceData.pro_price_yearly || 299000;
      }
    } catch {
      // fallback to default price
    }

    return NextResponse.json({
      plan: isPro ? "PRO" : "FREE",
      validUntil: validUntil?.toISOString() ?? null,
      daysLeft,
      proPrice,
    });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("GET /api/payments/subscription error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

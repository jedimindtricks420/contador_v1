import { NextResponse } from "next/server";
import { getSession } from "@/lib/context";
import { getUserActivePro } from "@/lib/billing";
import { BILLING } from "@/lib/constants";

export async function GET() {
  try {
    const session = await getSession();

    const { isPro, validUntil } = await getUserActivePro(session.userId);

    const now = new Date();
    const daysLeft =
      validUntil
        ? Math.max(0, Math.ceil((validUntil.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
        : null;

    let proPrice: number = BILLING.DEFAULT_PRO_PRICE_YEARLY;
    const adminApiUrl = process.env.ADMIN_API_URL;
    if (!adminApiUrl) {
      console.error("ADMIN_API_URL не настроен — используется дефолтная цена подписки для отображения");
    } else {
      try {
        const priceRes = await fetch(`${adminApiUrl}/admin/api/payment-info`);
        if (priceRes.ok) {
          const priceData = await priceRes.json();
          proPrice = priceData.pro_price_yearly || BILLING.DEFAULT_PRO_PRICE_YEARLY;
        }
      } catch {
        // fallback to default price — admin service unreachable, this is a
        // display-only page, not a payment action, so degrade gracefully
      }
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

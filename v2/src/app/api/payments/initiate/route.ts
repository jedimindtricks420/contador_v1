import { NextRequest, NextResponse } from "next/server";
import { getActiveOrgId } from "@/lib/context";

export async function POST(req: NextRequest) {
  try {
    const orgId = await getActiveOrgId();

    const body = await req.json();
    const { provider } = body;

    if (!provider || !["PAYME", "CLICK"].includes(provider)) {
      return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
    }

    const adminApiUrl = process.env.ADMIN_API_URL || "http://localhost:3031";
    const adminRes = await fetch(`${adminApiUrl}/admin/api/v2/payments/initiate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orgId, provider }),
    });

    const data = await adminRes.json();

    if (!adminRes.ok || !data.success) {
      return NextResponse.json(
        { error: data.error || "Payment initiation failed" },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: data.url, paymentId: data.paymentId });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED" || err.message === "NO_ACTIVE_ORG") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("POST /api/payments/initiate error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getActiveOrgId } from "@/lib/context";

export async function GET(req: NextRequest) {
  try {
    const orgId = await getActiveOrgId();
    const periodId = req.nextUrl.searchParams.get("periodId");
    if (!periodId) return NextResponse.json({ done: false });

    const existing = await prisma.document.findFirst({
      where: { orgId, periodId, type: { code: "YEAR_END_CLOSE" } }
    });
    return NextResponse.json({ done: !!existing });
  } catch (err: any) {
    return NextResponse.json({ done: false, error: err.message }, { status: 500 });
  }
}

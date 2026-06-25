import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getActiveOrgId } from "@/lib/context";

export async function GET(req: NextRequest) {
  try {
    await getActiveOrgId();

    const bankOnly = req.nextUrl.searchParams.get("bankOnly") === "true";
    const types = await prisma.documentType.findMany({
      where: bankOnly ? { mode: { in: ["BANK_AUTO", "HYBRID"] } } : undefined,
      orderBy: { name: "asc" }
    });
    return NextResponse.json(types);
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED" || err.message === "NO_ACTIVE_ORG") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("GET DOCUMENT TYPES ERROR:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

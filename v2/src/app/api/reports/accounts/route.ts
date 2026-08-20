import { NextResponse } from "next/server";
import { getActiveOrgId } from "@/lib/context";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    await getActiveOrgId();

    const accounts = await prisma.account.findMany({
      orderBy: { code: "asc" }
    });

    return NextResponse.json(accounts);
  } catch (err: any) {
    console.error("GET ACCOUNTS ERROR:", err);
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}

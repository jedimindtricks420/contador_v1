import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { ensureBaseData } from "@/lib/ensureBaseData";

export async function GET() {
  try {
    await ensureBaseData();
    const types = await prisma.documentType.findMany({
      orderBy: { name: "asc" }
    });
    return NextResponse.json(types);
  } catch (err: any) {
    console.error("GET DOCUMENT TYPES ERROR:", err);
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}

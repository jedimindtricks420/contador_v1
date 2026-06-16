import { NextRequest, NextResponse } from "next/server";
import { getActiveOrgId } from "@/lib/context";
import { startClassificationJob } from "@/lib/queue";

export async function POST(req: NextRequest) {
  try {
    const orgId = await getActiveOrgId();
    const { periodId } = await req.json();

    if (!periodId) {
      return NextResponse.json({ error: "periodId обязателен" }, { status: 400 });
    }

    const jobId = startClassificationJob(orgId, periodId);

    return NextResponse.json({ jobId });
  } catch (err: any) {
    console.error("RUN AI ERROR:", err);
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}

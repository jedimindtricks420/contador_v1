import { NextRequest, NextResponse } from "next/server";
import { getClassificationJob } from "@/lib/queue";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ periodId: string }> }
) {
  try {
    const { periodId } = await params;
    const job = getClassificationJob(periodId);

    if (!job) {
      return NextResponse.json({
        status: "idle",
        matched: 0,
        needsClarification: 0
      });
    }

    return NextResponse.json({
      status: job.status,
      matched: job.matched,
      needsClarification: job.needsClarification,
      error: job.error || null
    });
  } catch (err: any) {
    console.error("GET JOB STATUS ERROR:", err);
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}

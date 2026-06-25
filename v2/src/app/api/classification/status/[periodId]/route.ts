import { NextRequest, NextResponse } from "next/server";
import { getClassificationJob } from "@/lib/queue";
import { getActiveOrgId } from "@/lib/context";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ periodId: string }> }
) {
  try {
    const orgId = await getActiveOrgId();
    const { periodId } = await params;
    const job = await getClassificationJob(periodId);

    if (!job) {
      return NextResponse.json({
        status: "idle",
        total: 0,
        processed: 0,
        matched: 0,
        needsClarification: 0
      });
    }

    if (job.orgId !== orgId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({
      status: job.status,
      total: job.total,
      processed: job.processed,
      matched: job.matched,
      needsClarification: job.needsClarification,
      error: job.error || null
    });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED" || err.message === "NO_ACTIVE_ORG") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("GET JOB STATUS ERROR:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

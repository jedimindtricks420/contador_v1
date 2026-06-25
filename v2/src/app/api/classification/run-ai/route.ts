import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/context";
import { startClassificationJob } from "@/lib/queue";
import { getUserActivePro } from "@/lib/billing";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session.activeOrgId) {
      return NextResponse.json({ error: "Нет активной организации" }, { status: 400 });
    }

    const { isPro } = await getUserActivePro(session.userId);
    if (!isPro) {
      return NextResponse.json(
        { error: "ИИ-классификация доступна только на тарифе PRO" },
        { status: 403 }
      );
    }

    const { periodId } = await req.json();
    const jobId = await startClassificationJob(session.activeOrgId, periodId || "ALL");

    return NextResponse.json({ jobId });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }
    console.error("RUN AI ERROR:", err);
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}

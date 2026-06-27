import { applyRules } from "./classification/rulesEngine";
import { classifyAllWithAI } from "./classification/aiClassifier";
import prisma from "./prisma";

export async function getClassificationJob(periodId: string) {
  return await prisma.classificationJob.findUnique({
    where: { id: periodId }
  });
}

export async function startClassificationJob(orgId: string, periodId: string): Promise<string> {
  const jobId = periodId;

  // Prevent double-run: if a job is already running return its ID so UI polls it
  const existingJob = await prisma.classificationJob.findUnique({ where: { id: jobId } });
  if (existingJob?.status === "running") {
    return jobId;
  }

  // Upsert job entry
  await prisma.classificationJob.upsert({
    where: { id: jobId },
    update: {
      status: "running",
      total: 0,
      processed: 0,
      matched: 0,
      needsClarification: 0,
      error: null
    },
    create: {
      id: jobId,
      orgId,
      status: "running",
      total: 0,
      processed: 0,
      matched: 0,
      needsClarification: 0
    }
  });

  // Start background process asynchronously without blocking
  (async () => {
    try {
      // 1. Fetch all IMPORTED and NEEDS_CLARIFICATION transactions
      const whereClause: any = {
        orgId,
        status: { in: ["IMPORTED", "NEEDS_CLARIFICATION"] }
      };
      if (periodId !== "ALL") {
        whereClause.periodId = periodId;
      }

      const txs = await prisma.stagedTransaction.findMany({ where: whereClause });

      if (txs.length === 0) {
        await prisma.classificationJob.update({
          where: { id: jobId },
          data: { status: "done", total: 0, processed: 0, matched: 0, needsClarification: 0 }
        });
        return;
      }

      // Record total upfront so the UI can show X/Y progress
      await prisma.classificationJob.update({
        where: { id: jobId },
        data: { total: txs.length }
      });

      // 2. Run deterministic Rules Engine first
      const ruleMatchedCount = await applyRules(orgId, txs);

      // Update progress after rules phase so UI shows intermediate state
      await prisma.classificationJob.update({
        where: { id: jobId },
        data: { processed: ruleMatchedCount, matched: ruleMatchedCount }
      });

      // 3. Refresh list for AI — only unresolved transactions remain
      const remainingTxs = await prisma.stagedTransaction.findMany({
        where: { ...whereClause, status: { in: ["IMPORTED", "NEEDS_CLARIFICATION"] } }
      });

      // classifyAllWithAI handles chunking internally and builds full business context
      const { matched: aiMatchedCount, needsClarification: aiNeedsClarificationCount } =
        await classifyAllWithAI(orgId, remainingTxs);

      // 4. Mark job as completed
      const totalProcessed = ruleMatchedCount + aiMatchedCount + aiNeedsClarificationCount;
      await prisma.classificationJob.update({
        where: { id: jobId },
        data: {
          status: "done",
          processed: totalProcessed,
          matched: ruleMatchedCount + aiMatchedCount,
          needsClarification: aiNeedsClarificationCount
        }
      });
    } catch (err: any) {
      console.error("Background classification job failed:", err);
      await prisma.classificationJob.update({
        where: { id: jobId },
        data: { status: "failed", error: err.message || "Unknown classification failure" }
      }).catch(console.error);
    }
  })();

  return jobId;
}

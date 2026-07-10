import { applyRules } from "./classification/rulesEngine";
import { classifyAllWithAI } from "./classification/aiClassifier";
import prisma from "./prisma";

export async function getClassificationJob(periodId: string) {
  return await prisma.classificationJob.findUnique({
    where: { id: periodId }
  });
}

export async function startClassificationJob(orgId: string, periodId: string): Promise<string> {
  // "ALL" is not a real period ID — make it org-scoped to prevent cross-tenant collision
  const jobId = periodId === "ALL" ? `${orgId}_ALL` : periodId;

  // Prevent double-run: the previous check-then-upsert (findUnique, then decide,
  // then upsert) was a TOCTOU race — two near-simultaneous calls could both see
  // "not running" before either wrote, and both start a duplicate background job
  // over the same transactions. This single atomic INSERT ... ON CONFLICT ... WHERE
  // either creates the row or claims it (resets to running) ONLY if it wasn't
  // already running; if another call already claimed it, this affects zero rows
  // and we just return the existing jobId for the UI to poll.
  // "updatedAt" must be set explicitly: @updatedAt is filled in by Prisma Client,
  // not by a database default, and $queryRaw bypasses the client (NOT NULL otherwise).
  const claimed = await prisma.$queryRaw<{ id: string }[]>`
    INSERT INTO "ClassificationJob" (id, "orgId", status, total, processed, matched, "needsClarification", "updatedAt")
    VALUES (${jobId}, ${orgId}, 'running', 0, 0, 0, 0, NOW())
    ON CONFLICT (id) DO UPDATE SET
      status = 'running', total = 0, processed = 0, matched = 0, "needsClarification" = 0, error = NULL, "updatedAt" = NOW()
    WHERE "ClassificationJob".status != 'running'
    RETURNING id
  `;
  if (claimed.length === 0) {
    // Already running (claimed by a concurrent call, or a genuinely still-running job)
    return jobId;
  }

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

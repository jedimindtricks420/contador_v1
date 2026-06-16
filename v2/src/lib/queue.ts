import { applyRules } from "./classification/rulesEngine";
import { classifyBatchWithAI } from "./classification/aiClassifier";
import prisma from "./prisma";
import { AI } from "./constants";

export type JobStatus = "running" | "done" | "failed";

export interface ClassificationJob {
  id: string; // matches periodId for simple lookup
  status: JobStatus;
  matched: number;
  needsClarification: number;
  error?: string;
}

// Global registry to prevent Next.js hot-reloads from wiping state in development
const globalForQueue = globalThis as unknown as {
  classificationJobs: Map<string, ClassificationJob>;
};

if (!globalForQueue.classificationJobs) {
  globalForQueue.classificationJobs = new Map();
}

export const classificationJobs = globalForQueue.classificationJobs;

export function getClassificationJob(periodId: string): ClassificationJob | undefined {
  return classificationJobs.get(periodId);
}

export function startClassificationJob(orgId: string, periodId: string): string {
  // Use periodId as the unique Job ID to keep things simple
  const jobId = periodId;

  // Initialize job entry
  classificationJobs.set(jobId, {
    id: jobId,
    status: "running",
    matched: 0,
    needsClarification: 0
  });

  // Start background process asynchronously without blocking
  (async () => {
    try {
      // 1. Fetch all IMPORTED transactions for this period
      const txs = await prisma.stagedTransaction.findMany({
        where: {
          orgId,
          periodId,
          status: "IMPORTED"
        }
      });

      if (txs.length === 0) {
        classificationJobs.set(jobId, {
          id: jobId,
          status: "done",
          matched: 0,
          needsClarification: 0
        });
        return;
      }

      // 2. Run deterministic Rules Engine first
      const ruleMatchedCount = await applyRules(orgId, txs);

      // Refresh transaction list to get remaining IMPORTED transactions
      const remainingTxs = await prisma.stagedTransaction.findMany({
        where: {
          orgId,
          periodId,
          status: "IMPORTED"
        }
      });

      let aiMatchedCount = 0;
      let aiNeedsClarificationCount = 0;

      for (let i = 0; i < remainingTxs.length; i += AI.BATCH_SIZE) {
        const batch = remainingTxs.slice(i, i + AI.BATCH_SIZE);
        const res = await classifyBatchWithAI(orgId, batch);

        aiMatchedCount += res.matched;
        aiNeedsClarificationCount += res.needsClarification;

        // Update progress in-between batches
        classificationJobs.set(jobId, {
          id: jobId,
          status: "running",
          matched: ruleMatchedCount + aiMatchedCount,
          needsClarification: aiNeedsClarificationCount
        });
      }

      // Mark job as completed
      classificationJobs.set(jobId, {
        id: jobId,
        status: "done",
        matched: ruleMatchedCount + aiMatchedCount,
        needsClarification: aiNeedsClarificationCount
      });
    } catch (err: any) {
      console.error("Background classification job failed:", err);
      classificationJobs.set(jobId, {
        id: jobId,
        status: "failed",
        matched: 0,
        needsClarification: 0,
        error: err.message || "Unknown classification failure"
      });
    }
  })();

  return jobId;
}

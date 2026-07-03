-- Migration: Add ClosingJob table for BUG-08
-- Replaces globalThis.closingStates with persistent DB storage

CREATE TABLE "ClosingJob" (
    "id" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "step" INTEGER NOT NULL DEFAULT 1,
    "data" JSONB NOT NULL DEFAULT '{}',
    "error" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClosingJob_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ClosingJob_periodId_orgId_key" UNIQUE ("periodId", "orgId"),
    CONSTRAINT "ClosingJob_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "Period"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ClosingJob_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "ClosingJob_orgId_idx" ON "ClosingJob"("orgId");
CREATE INDEX "ClosingJob_status_idx" ON "ClosingJob"("status");
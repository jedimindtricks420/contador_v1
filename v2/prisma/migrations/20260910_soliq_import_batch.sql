BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS "Period_id_orgId_key" ON "Period" ("id", "orgId");

CREATE TABLE IF NOT EXISTS "SoliqImportBatch" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "orgId" TEXT NOT NULL,
  "periodId" TEXT NOT NULL,
  "sourceName" TEXT NOT NULL,
  "sourceHash" TEXT NOT NULL,
  "sourceData" BYTEA NOT NULL,
  "parserVersion" TEXT NOT NULL,
  "rows" JSONB NOT NULL,
  "totals" JSONB NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'READY',
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "postedBy" TEXT,
  "postedAt" TIMESTAMP(3),
  "result" JSONB,
  CONSTRAINT "SoliqImportBatch_orgId_fkey" FOREIGN KEY ("orgId")
    REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SoliqImportBatch_periodId_orgId_fkey" FOREIGN KEY ("periodId", "orgId")
    REFERENCES "Period" ("id", "orgId") ON DELETE CASCADE ON UPDATE CASCADE
);

ALTER TABLE "SoliqImportBatch" DROP CONSTRAINT IF EXISTS "SoliqImportBatch_status_check";
ALTER TABLE "SoliqImportBatch" DROP CONSTRAINT IF EXISTS "SoliqImportBatch_posted_check";
ALTER TABLE "SoliqImportBatch" ADD CONSTRAINT "SoliqImportBatch_status_check"
  CHECK ("status" IN ('READY', 'POSTED', 'CANCELLED'));
ALTER TABLE "SoliqImportBatch" ADD CONSTRAINT "SoliqImportBatch_posted_check" CHECK (
  ("status" = 'READY' AND "postedAt" IS NULL AND "postedBy" IS NULL AND "result" IS NULL)
  OR ("status" = 'POSTED' AND "postedAt" IS NOT NULL AND "postedBy" IS NOT NULL AND "result" IS NOT NULL)
  OR ("status" = 'CANCELLED' AND "postedAt" IS NULL AND "postedBy" IS NULL AND "result" IS NOT NULL
    AND jsonb_typeof("result"->'reason') = 'string' AND length(btrim("result"->>'reason')) > 0
    AND jsonb_typeof("result"->'userId') = 'string' AND length(btrim("result"->>'userId')) > 0
    AND jsonb_typeof("result"->'cancelledAt') = 'string'
    AND "result" ?& ARRAY['reason', 'userId', 'cancelledAt'])
);

CREATE UNIQUE INDEX IF NOT EXISTS "SoliqImportBatch_orgId_periodId_sourceHash_key"
  ON "SoliqImportBatch" ("orgId", "periodId", "sourceHash");
CREATE INDEX IF NOT EXISTS "SoliqImportBatch_orgId_periodId_status_idx"
  ON "SoliqImportBatch" ("orgId", "periodId", "status");

CREATE OR REPLACE FUNCTION protect_soliq_import_batch() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."status" <> 'READY' OR
     ROW(NEW."id", NEW."orgId", NEW."periodId", NEW."sourceName", NEW."sourceHash",
         NEW."sourceData", NEW."parserVersion", NEW."rows", NEW."totals", NEW."createdBy", NEW."createdAt")
       IS DISTINCT FROM
     ROW(OLD."id", OLD."orgId", OLD."periodId", OLD."sourceName", OLD."sourceHash",
         OLD."sourceData", OLD."parserVersion", OLD."rows", OLD."totals", OLD."createdBy", OLD."createdAt") THEN
    RAISE EXCEPTION 'Soliq import source and posted protocol are immutable';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER "SoliqImportBatch_immutable" BEFORE UPDATE ON "SoliqImportBatch"
  FOR EACH ROW EXECUTE FUNCTION protect_soliq_import_batch();

COMMIT;
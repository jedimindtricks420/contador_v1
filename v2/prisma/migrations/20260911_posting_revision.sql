BEGIN;
SET LOCAL lock_timeout = '1s';
SET LOCAL statement_timeout = '10s';

CREATE TABLE IF NOT EXISTS "PostingRevision" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "orgId" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "periodId" TEXT NOT NULL,
  "revision" INTEGER NOT NULL,
  "previousId" TEXT,
  "action" TEXT NOT NULL,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "snapshot" JSONB NOT NULL,
  "snapshotHash" TEXT NOT NULL,
  CONSTRAINT "PostingRevision_documentId_revision_key" UNIQUE ("documentId", "revision"),
  CONSTRAINT "PostingRevision_previousId_key" UNIQUE ("previousId")
);

ALTER TABLE "PostingRevision"
  DROP CONSTRAINT IF EXISTS "PostingRevision_header_check",
  DROP CONSTRAINT IF EXISTS "PostingRevision_snapshot_check",
  ADD CONSTRAINT "PostingRevision_header_check" CHECK (
    "revision" > 0 AND "action" IN ('POST', 'VOID') AND length("createdBy") > 0
    AND (("revision" = 1 AND "previousId" IS NULL) OR ("revision" > 1 AND "previousId" IS NOT NULL))
  ),
  ADD CONSTRAINT "PostingRevision_snapshot_check" CHECK (
    jsonb_typeof("snapshot") = 'object'
    AND "snapshot" ?& ARRAY['formatVersion', 'document', 'observedType', 'calculationContext', 'ruleProvenance', 'journalEntries', 'openItems']
    AND ("snapshot"->>'formatVersion') IS NOT DISTINCT FROM '1'
    AND ("snapshot"#>>'{document,id}') IS NOT DISTINCT FROM "documentId"
    AND ("snapshot"#>>'{document,orgId}') IS NOT DISTINCT FROM "orgId"
    AND ("snapshot"#>>'{document,periodId}') IS NOT DISTINCT FROM "periodId"
    AND jsonb_typeof("snapshot"->'journalEntries') IS NOT DISTINCT FROM 'array'
    AND jsonb_typeof("snapshot"->'openItems') IS NOT DISTINCT FROM 'array'
    AND ("snapshot"->>'ruleProvenance') IS NOT DISTINCT FROM
      CASE WHEN "action" = 'POST' THEN 'USED_FOR_POSTING' ELSE 'OBSERVED_AT_VOID' END
    AND "snapshotHash" = encode(sha256(convert_to("snapshot"::text, 'UTF8')), 'hex')
  );

CREATE INDEX IF NOT EXISTS "PostingRevision_orgId_documentId_revision_idx"
  ON "PostingRevision" ("orgId", "documentId", "revision");

CREATE OR REPLACE FUNCTION guard_posting_revision_insert() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  source_org TEXT;
  source_period TEXT;
  previous_id TEXT;
  previous_number INTEGER;
  previous_org TEXT;
BEGIN
  SELECT "orgId", "periodId" INTO source_org, source_period FROM "Document"
    WHERE "id" = NEW."documentId" FOR UPDATE;
  IF NOT FOUND OR source_org IS DISTINCT FROM NEW."orgId" OR source_period IS DISTINCT FROM NEW."periodId" THEN
    RAISE EXCEPTION 'Posting revision requires its own live document and period';
  END IF;
  SELECT "id", "revision", "orgId" INTO previous_id, previous_number, previous_org FROM "PostingRevision"
    WHERE "documentId" = NEW."documentId" ORDER BY "revision" DESC LIMIT 1;
  IF NEW."revision" <> COALESCE(previous_number, 0) + 1 OR NEW."previousId" IS DISTINCT FROM previous_id
    OR (previous_org IS NOT NULL AND previous_org <> NEW."orgId") THEN
    RAISE EXCEPTION 'Posting revision chain must be consecutive and tenant-owned';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION protect_posting_revision() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Posting revisions are append-only';
END;
$$;

CREATE OR REPLACE TRIGGER "PostingRevision_insert" BEFORE INSERT ON "PostingRevision"
  FOR EACH ROW EXECUTE FUNCTION guard_posting_revision_insert();
CREATE OR REPLACE TRIGGER "PostingRevision_immutable" BEFORE UPDATE OR DELETE ON "PostingRevision"
  FOR EACH ROW EXECUTE FUNCTION protect_posting_revision();
CREATE OR REPLACE TRIGGER "PostingRevision_no_truncate" BEFORE TRUNCATE ON "PostingRevision"
  FOR EACH STATEMENT EXECUTE FUNCTION protect_posting_revision();

COMMIT;
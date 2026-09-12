BEGIN;
SET LOCAL lock_timeout = '1s';
SET LOCAL statement_timeout = '10s';

CREATE UNIQUE INDEX IF NOT EXISTS "BankAccount_id_orgId_key" ON "BankAccount" ("id", "orgId");

CREATE TABLE IF NOT EXISTS "BankImportBatch" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "orgId" TEXT NOT NULL,
  "bankAccountId" TEXT NOT NULL,
  "bankCurrency" TEXT NOT NULL,
  "sourceName" TEXT NOT NULL,
  "sourceHash" TEXT NOT NULL,
  "sourceData" BYTEA NOT NULL,
  "parserVersion" TEXT NOT NULL,
  "rows" JSONB NOT NULL,
  "statement" JSONB NOT NULL,
  "result" JSONB NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'IMPORTED',
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "rolledBackBy" TEXT,
  "rolledBackAt" TIMESTAMP(3),
  "rollbackAuditId" TEXT,
  CONSTRAINT "BankImportBatch_orgId_fkey" FOREIGN KEY ("orgId")
    REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "BankImportBatch_bankAccountId_orgId_fkey" FOREIGN KEY ("bankAccountId", "orgId")
    REFERENCES "BankAccount" ("id", "orgId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "BankImportBatch_source_check" CHECK (
    octet_length("sourceData") BETWEEN 1 AND 5242880
    AND "sourceHash" = encode(sha256("sourceData"), 'hex')
    AND length("sourceName") BETWEEN 1 AND 255 AND length("parserVersion") > 0
    AND length("createdBy") > 0 AND length("bankCurrency") > 0
  ),
  CONSTRAINT "BankImportBatch_protocol_check" CHECK (
    jsonb_typeof("rows") = 'array' AND jsonb_array_length("rows") BETWEEN 1 AND 1000
    AND jsonb_typeof("statement") = 'object' AND jsonb_typeof("result") = 'object'
    AND "statement" ?& ARRAY['accountNumber', 'periodStart', 'periodEnd', 'openingBalance', 'closingBalance', 'credits', 'debits', 'rowCount']
    AND "result" ?& ARRAY['oldValue', 'newValue']
  ),
  CONSTRAINT "BankImportBatch_status_check" CHECK (
    ("status" = 'IMPORTED' AND "rolledBackBy" IS NULL AND "rolledBackAt" IS NULL AND "rollbackAuditId" IS NULL)
    OR ("status" = 'ROLLED_BACK' AND "rolledBackBy" IS NOT NULL AND length("rolledBackBy") > 0
      AND "rolledBackAt" IS NOT NULL AND "rollbackAuditId" IS NOT NULL AND length("rollbackAuditId") > 0)
  )
);

CREATE INDEX IF NOT EXISTS "BankImportBatch_orgId_bankAccountId_createdAt_idx"
  ON "BankImportBatch" ("orgId", "bankAccountId", "createdAt");
CREATE INDEX IF NOT EXISTS "BankImportBatch_orgId_bankAccountId_sourceHash_idx"
  ON "BankImportBatch" ("orgId", "bankAccountId", "sourceHash");

CREATE OR REPLACE FUNCTION protect_bank_import_batch() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."status" <> 'IMPORTED' OR NEW."status" <> 'ROLLED_BACK' OR
     ROW(NEW."id", NEW."orgId", NEW."bankAccountId", NEW."bankCurrency", NEW."sourceName", NEW."sourceHash",
         NEW."sourceData", NEW."parserVersion", NEW."rows", NEW."statement", NEW."result", NEW."createdBy", NEW."createdAt")
       IS DISTINCT FROM
     ROW(OLD."id", OLD."orgId", OLD."bankAccountId", OLD."bankCurrency", OLD."sourceName", OLD."sourceHash",
         OLD."sourceData", OLD."parserVersion", OLD."rows", OLD."statement", OLD."result", OLD."createdBy", OLD."createdAt") THEN
    RAISE EXCEPTION 'Bank import source and result cannot be rewritten';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER "BankImportBatch_immutable" BEFORE UPDATE ON "BankImportBatch"
  FOR EACH ROW EXECUTE FUNCTION protect_bank_import_batch();

COMMIT;
BEGIN;

SET LOCAL lock_timeout = '1s';
SET LOCAL statement_timeout = '5s';
LOCK TABLE "BankAccount" IN ACCESS EXCLUSIVE MODE;

DO $$
DECLARE
  invalid_count BIGINT;
  duplicate_groups BIGINT;
BEGIN
  WITH normalized AS (
    SELECT "orgId", translate("accountNumber",
      U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF', '') COLLATE "C" AS number
    FROM "BankAccount"
  )
  SELECT
    (SELECT COUNT(*) FROM normalized WHERE number IS NULL OR number !~ '^[0-9]{20}$'),
    (SELECT COUNT(*) FROM (
      SELECT "orgId", number FROM normalized WHERE number ~ '^[0-9]{20}$'
      GROUP BY "orgId", number HAVING COUNT(*) > 1
    ) duplicates)
  INTO invalid_count, duplicate_groups;
  IF invalid_count > 0 OR duplicate_groups > 0 THEN
    RAISE EXCEPTION 'Bank account number preflight failed: invalid=%, duplicate_groups=%',
      invalid_count, duplicate_groups;
  END IF;
END;
$$;

ALTER TABLE "BankAccount" ALTER COLUMN "accountNumber" SET NOT NULL;
ALTER TABLE "BankAccount" DROP CONSTRAINT IF EXISTS "BankAccount_accountNumber_check";
ALTER TABLE "BankAccount" ADD CONSTRAINT "BankAccount_accountNumber_check" CHECK (
  translate("accountNumber",
    U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF', '') COLLATE "C" ~ '^[0-9]{20}$'
);
DROP INDEX IF EXISTS "BankAccount_orgId_normalizedAccountNumber_key";
CREATE UNIQUE INDEX "BankAccount_orgId_normalizedAccountNumber_key" ON "BankAccount" (
  "orgId", (translate("accountNumber",
    U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF', '') COLLATE "C")
);

COMMIT;
import { PrismaClient } from "@prisma/client";
import { auditAccounting } from "../src/lib/posting/accountingAudit";

async function main() {
  const orgId = process.argv[2];
  if (orgId === "--help") {
    console.log("Usage: ACC_AUDIT_DATABASE_URL=<read-only database URL> npm run audit:accounting -- <orgId>");
    return;
  }
  const databaseUrl = process.env.ACC_AUDIT_DATABASE_URL;
  if (!orgId || !databaseUrl) {
    throw new Error("Usage: ACC_AUDIT_DATABASE_URL=<read-only database URL> npm run audit:accounting -- <orgId>");
  }
  const client = new PrismaClient({ datasourceUrl: databaseUrl });
  try {
    console.log(JSON.stringify(await auditAccounting(client, orgId), null, 2));
  } finally {
    await client.$disconnect();
  }
}

main().catch(() => {
  console.error("Accounting audit failed or timed out. No report was completed; do not treat this as a clean audit. Check the explicit URL, organization ID and database permissions locally.");
  process.exitCode = 1;
});
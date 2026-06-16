import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export default prisma;

const tablesWithOrgId = [
  "StagedTransaction",
  "Rule",
  "Document",
  "BankAccount",
  "Period",
  "Counterparty",
  "OpenItem",
  "TaxCalendarEvent",
  "AuditLog",
  "Subscription",
];

export function prismaWithOrg(orgId: string) {
  return prisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (tablesWithOrgId.includes(model)) {
            if (
              operation === "findMany" ||
              operation === "findFirst" ||
              operation === "count" ||
              operation === "updateMany" ||
              operation === "deleteMany"
            ) {
              (args as any).where = { ...(args as any).where, orgId };
            } else if (
              operation === "update" ||
              operation === "delete" ||
              operation === "findUnique" ||
              operation === "findUniqueOrThrow" ||
              operation === "findFirstOrThrow"
            ) {
              if (operation === "findUnique" || operation === "findUniqueOrThrow") {
                const result = await query(args);
                if (result && (result as any).orgId !== orgId) {
                  if (operation === "findUniqueOrThrow") throw new Error("Not Found");
                  return null;
                }
                return result;
              }
              if (operation === "update" || operation === "delete") {
                const recordId = (args as any).where?.id;
                if (recordId) {
                  const modelKey = model.charAt(0).toLowerCase() + model.slice(1) as any;
                  const existing = await (prisma as any)[modelKey].findFirst({
                    where: { id: recordId, orgId },
                    select: { id: true }
                  });
                  if (!existing) throw new Error("FORBIDDEN");
                }
              }
            } else if (operation === "create" || operation === "createMany") {
              if (operation === "create") {
                (args as any).data = { ...(args as any).data, orgId };
              } else if (operation === "createMany") {
                if (Array.isArray((args as any).data)) {
                  (args as any).data = (args as any).data.map((d: any) => ({ ...d, orgId }));
                } else {
                  (args as any).data = { ...(args as any).data, orgId };
                }
              }
            }
          }
          return query(args);
        },
      },
    },
  });
}

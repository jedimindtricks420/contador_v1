import type { Prisma } from "@prisma/client";
import { BankStatementValidationError } from "@/lib/bankStatementValidation";

export async function lockBankStatementPeriods(database: Prisma.TransactionClient, orgId: string, start: Date, end: Date) {
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start > end) {
    throw new BankStatementValidationError("Некорректный период банковского архива");
  }
  const monthIndex = (date: Date) => {
    const parts = new Intl.DateTimeFormat("en", { timeZone: "Asia/Tashkent", year: "numeric", month: "numeric" }).formatToParts(date);
    return Number(parts.find(part => part.type === "year")?.value) * 12 + Number(parts.find(part => part.type === "month")?.value);
  };
  return database.$queryRaw<{ id: string; status: string; lockDate: Date | null }[]>`
    SELECT "id", "status", "lockDate" FROM "Period" WHERE "orgId" = ${orgId}
      AND "year" * 12 + "month" BETWEEN ${monthIndex(start)} AND ${monthIndex(end)}
    ORDER BY "year", "month", "id" FOR NO KEY UPDATE
  `;
}
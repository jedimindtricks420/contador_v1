import prisma from "./prisma";
import { ACCOUNTS, RISK_DAYS } from "./constants";

/**
 * Calculates the deadline for a buffer account open position.
 * - 4220 (Accountable): 10 days
 * - 4310, 6310, 6990 (Advances / Unidentified): 30 days
 * - 5830, 6820 (Deposits / Founder loans): 365 days
 */
export function getRiskDeadline(accountCode: string, dateOpened: Date): Date {
  const date = new Date(dateOpened);
  let days: number = RISK_DAYS.DEFAULT;

  if (accountCode === ACCOUNTS.ADVANCE_PAID_TRAVEL) {
    days = RISK_DAYS.ACCOUNTABLE;
  } else if (accountCode === ACCOUNTS.DEPOSIT || accountCode === ACCOUNTS.FOUNDER_LOAN) {
    days = RISK_DAYS.LONG_TERM;
  }

  date.setDate(date.getDate() + days);
  return date;
}

/**
 * Scans open items in status=OPEN that have passed their risk deadlines,
 * and updates their status to RISK.
 */
export async function markRiskyItems(orgId: string): Promise<void> {
  const now = new Date();
  try {
    await prisma.openItem.updateMany({
      where: {
        orgId,
        status: "OPEN",
        riskDeadline: { lt: now }
      },
      data: {
        status: "RISK"
      }
    });
  } catch (err) {
    console.error("Failed to mark risky open items:", err);
  }
}

/**
 * Closes an open item by associating it with a closing document and date.
 */
export async function closeOpenItem(
  openItemId: string,
  closingDocumentId: string,
  dateClosed: Date,
  tx: any = prisma
): Promise<void> {
  await tx.openItem.update({
    where: { id: openItemId },
    data: {
      status: "CLOSED",
      closingDocumentId,
      dateClosed
    }
  });
}

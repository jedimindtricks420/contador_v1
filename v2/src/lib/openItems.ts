import prisma from "./prisma";
import { RISK_DAYS_BY_ACCOUNT, RISK_DAYS_DEFAULT } from "./constants";

interface OpenItemDeadlineOverrides {
  openItemDeadlines?: Record<string, number>;
}

/**
 * Calculates the deadline for a buffer account open position.
 * Precedence: org.settings.openItemDeadlines[accountCode] (per-org override, configured on
 * the "Сроки риска" settings page) → RISK_DAYS_BY_ACCOUNT[accountCode] (built-in default for
 * that account) → RISK_DAYS_DEFAULT (generic fallback for any other buffer account).
 */
export function getRiskDeadline(accountCode: string, dateOpened: Date, orgSettings?: unknown): Date {
  const date = new Date(dateOpened);
  const overrides = (orgSettings as OpenItemDeadlineOverrides | null | undefined)?.openItemDeadlines;
  const overrideDays = overrides?.[accountCode];

  const days = typeof overrideDays === "number" && overrideDays > 0
    ? overrideDays
    : RISK_DAYS_BY_ACCOUNT[accountCode] ?? RISK_DAYS_DEFAULT;

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

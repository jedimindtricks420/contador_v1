/**
 * postDocument's VAT_OFFSET guard — must never post when the period has no
 * POSTED SOLIQ_IMPORT document, and never for more than the input VAT confirmed
 * by that document's payload.taxSummary.inputVat, minus whatever was already
 * offset earlier in the same period.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import Decimal from "decimal.js";

// No charterCapital import needed for VAT_OFFSET, but postingEngine imports it
// dynamically for CAPITAL_CONTRIBUTION — keep the module mockable/harmless here.
vi.mock("@/lib/charterCapital", () => ({ getCharterCapitalDebt: vi.fn().mockResolvedValue(new Decimal(0)) }));

describe("postDocument — VAT_OFFSET Soliq-backed guard", () => {
  const mockTx: any = {
    document: { findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
    period: { findUnique: vi.fn() },
    organization: { findUnique: vi.fn() },
    counterparty: { findFirst: vi.fn(), create: vi.fn() },
    account: { findUnique: vi.fn() },
    journalEntry: { create: vi.fn(), createMany: vi.fn(), aggregate: vi.fn() },
    openItem: { findMany: vi.fn().mockResolvedValue([]), update: vi.fn() },
    auditLog: { create: vi.fn() },
  };

  const baseDoc = {
    id: "doc-1",
    orgId: "org-1",
    periodId: "period-1",
    status: "POSTED",
    payload: { vatAmount: 1_000_000 },
    type: {
      code: "VAT_OFFSET",
      postingTemplate: {
        lines: [
          { accountCode: "6410", side: "debit", expression: "vatAmount" },
          { accountCode: "4410", side: "credit", expression: "vatAmount" },
        ],
        closesOpenItemByAccount: "4410",
      },
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockTx.document.findUnique.mockResolvedValue(baseDoc);
    mockTx.period.findUnique.mockResolvedValue({ id: "period-1", status: "OPEN", lockDate: null });
    mockTx.organization.findUnique.mockResolvedValue({ id: "org-1", isVatPayer: true, charterCapitalDeclaredAt: null });
    mockTx.account.findUnique.mockResolvedValue({ id: "acc-1", code: "6410" });
    mockTx.journalEntry.aggregate.mockResolvedValue({ _sum: { credit: null } });
  });

  it("throws when no SOLIQ_IMPORT document exists for the period", async () => {
    mockTx.document.findFirst.mockResolvedValue(null);

    const { postDocument } = await import("@/lib/posting/postingEngine");
    await expect(postDocument("doc-1", mockTx)).rejects.toThrow(/отчёт Soliq/);
    expect(mockTx.journalEntry.create).not.toHaveBeenCalled();
  });

  it("throws when the offset amount exceeds remaining input VAT", async () => {
    mockTx.document.findFirst.mockResolvedValue({
      id: "soliq-doc", payload: { taxSummary: { inputVat: 800_000 } },
    });
    mockTx.journalEntry.aggregate.mockResolvedValue({ _sum: { credit: null } });

    const { postDocument } = await import("@/lib/posting/postingEngine");
    // baseDoc.payload.vatAmount = 1_000_000 > inputVat 800_000
    await expect(postDocument("doc-1", mockTx)).rejects.toThrow(/превышает входящий НДС/);
  });

  it("throws when the offset would exceed input VAT once already-offset amounts are counted", async () => {
    mockTx.document.findFirst.mockResolvedValue({
      id: "soliq-doc", payload: { taxSummary: { inputVat: 1_500_000 } },
    });
    // 700,000 already offset earlier this period + 1,000,000 now > 1,500,000 available
    mockTx.journalEntry.aggregate.mockResolvedValue({ _sum: { credit: new Decimal(700_000) } });

    const { postDocument } = await import("@/lib/posting/postingEngine");
    await expect(postDocument("doc-1", mockTx)).rejects.toThrow(/превышает входящий НДС/);
  });

  it("posts normally when within the remaining input VAT", async () => {
    mockTx.document.findFirst.mockResolvedValue({
      id: "soliq-doc", payload: { taxSummary: { inputVat: 5_000_000 } },
    });
    mockTx.journalEntry.aggregate.mockResolvedValue({ _sum: { credit: new Decimal(1_000_000) } });
    mockTx.journalEntry.create.mockResolvedValue({ id: "je-1" });

    const { postDocument } = await import("@/lib/posting/postingEngine");
    const result = await postDocument("doc-1", mockTx);
    expect(result.journalEntries.length).toBe(2);
  });
});

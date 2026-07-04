/**
 * postDocument's CAPITAL_CONTRIBUTION guard — must never post when the charter
 * capital isn't declared, or when the 4610 debt is already fully settled.
 * Kept in its own file so postingEngine itself is NOT mocked (unlike
 * charter-capital.test.ts, which tests the settings route and mocks it).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import Decimal from "decimal.js";

const mockGetCharterCapitalDebt = vi.fn();
vi.mock("@/lib/charterCapital", () => ({ getCharterCapitalDebt: mockGetCharterCapitalDebt }));

describe("postDocument — CAPITAL_CONTRIBUTION charter-capital guard", () => {
  const mockTx: any = {
    document: { findUnique: vi.fn(), update: vi.fn() },
    period: { findUnique: vi.fn() },
    organization: { findUnique: vi.fn() },
    counterparty: { findFirst: vi.fn(), create: vi.fn() },
    account: { findUnique: vi.fn() },
    journalEntry: { create: vi.fn(), createMany: vi.fn() },
    openItem: { findMany: vi.fn().mockResolvedValue([]), update: vi.fn() },
    auditLog: { create: vi.fn() },
  };

  const baseDoc = {
    id: "doc-1",
    orgId: "org-1",
    periodId: "period-1",
    status: "POSTED",
    payload: { amount: 1_000_000, counterpartyInn: "123456789" },
    type: {
      code: "CAPITAL_CONTRIBUTION",
      postingTemplate: {
        lines: [
          { accountCode: "5110", side: "debit", expression: "amount" },
          { accountCode: "4610", side: "credit", expression: "amount" },
        ],
        closesOpenItemByAccount: "4610",
      },
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockTx.document.findUnique.mockResolvedValue(baseDoc);
    mockTx.period.findUnique.mockResolvedValue({ id: "period-1", status: "OPEN", lockDate: null });
    mockTx.counterparty.findFirst.mockResolvedValue({ id: "cp-1" });
    mockTx.account.findUnique.mockResolvedValue({ id: "acc-1", code: "5110" });
  });

  it("throws when the org never declared a charter capital", async () => {
    mockTx.organization.findUnique.mockResolvedValue({ id: "org-1", isVatPayer: false, charterCapitalDeclaredAt: null });
    mockGetCharterCapitalDebt.mockResolvedValue(new Decimal(0));

    const { postDocument } = await import("@/lib/posting/postingEngine");
    await expect(postDocument("doc-1", mockTx)).rejects.toThrow(/не задекларирован/);
    expect(mockTx.journalEntry.create).not.toHaveBeenCalled();
  });

  it("throws when the 4610 debt is already fully settled", async () => {
    mockTx.organization.findUnique.mockResolvedValue({ id: "org-1", isVatPayer: false, charterCapitalDeclaredAt: new Date() });
    mockGetCharterCapitalDebt.mockResolvedValue(new Decimal(0));

    const { postDocument } = await import("@/lib/posting/postingEngine");
    await expect(postDocument("doc-1", mockTx)).rejects.toThrow(/погашен/);
  });

  it("posts normally when there is outstanding 4610 debt", async () => {
    mockTx.organization.findUnique.mockResolvedValue({ id: "org-1", isVatPayer: false, charterCapitalDeclaredAt: new Date() });
    mockGetCharterCapitalDebt.mockResolvedValue(new Decimal(5_000_000));
    mockTx.journalEntry.create.mockResolvedValue({ id: "je-1" });

    const { postDocument } = await import("@/lib/posting/postingEngine");
    const result = await postDocument("doc-1", mockTx);
    expect(result.journalEntries.length).toBe(2);
  });
});

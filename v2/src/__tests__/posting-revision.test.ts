import type { Document, DocumentType } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { appendPostingRevision, assertPostingRevisionState } from "@/lib/posting/postingRevision";

const document: Document & { type: DocumentType } = {
  id: "document", orgId: "org", periodId: "period", typeId: "type", status: "POSTED",
  date: new Date("2026-09-11T00:00:00Z"), payload: { amount: "9007199254740993.27" },
  sourceTransactionId: null, correctionForPeriodId: null, taxDeductibleOverride: null,
  taxCalendarSyncStatus: null, taxCalendarSyncError: null,
  type: { id: "type", code: "TEST", name: "Synthetic type", mode: "BANK_AUTO", postingTemplate: { lines: [{ expression: "amount" }] } },
};

describe("posting revision persistence contract", () => {
  it.each(["POST", "VOID"] as const)("records %s provenance without fabricating historical rules", async action => {
    const tx = { $executeRaw: vi.fn().mockResolvedValue(1) };
    const context = action === "POST" ? { isVatPayer: false, vatRate: 0 } : null;
    await appendPostingRevision(tx, document, action, "actor", context);
    const [parts, ...values] = tx.$executeRaw.mock.calls[0];
    const metadata = JSON.parse(values.find(value => typeof value === "string" && value.startsWith('{"formatVersion"')));
    expect(metadata.document.payload.amount).toBe("9007199254740993.27");
    expect(metadata.document.date).toBe("2026-09-11T00:00:00.000Z");
    expect(metadata.observedType).toEqual(document.type);
    expect(metadata.calculationContext).toEqual(context);
    expect(metadata.ruleProvenance).toBe(action === "POST" ? "USED_FOR_POSTING" : "OBSERVED_AT_VOID");
    expect(values).toContain("actor");
    expect(values).toContain(action);
    expect(parts.join("?")).toContain('entry."debit"::text');
    expect(parts.join("?")).toContain('item."amount"::text');
  });

  it("propagates archive failure to the owning transaction", async () => {
    const tx = { $executeRaw: vi.fn().mockRejectedValue(new Error("archive unavailable")) };
    await expect(appendPostingRevision(tx, document, "POST", "actor", {})).rejects.toThrow("archive unavailable");
  });
});

describe("active posting revision guard", () => {
  const active = {
    orgId: "org", periodId: "period", action: "POST",
    hashValid: true, ledgerMatches: true, hasEntries: true,
  };
  const transaction = (revision: unknown) => ({
    $queryRaw: vi.fn().mockResolvedValueOnce([]).mockResolvedValueOnce(revision ? [revision] : []),
  });

  it.each(["POST", "VOID"] as const)("keeps the legacy %s path without invented history", async action => {
    await expect(assertPostingRevisionState(transaction(null), document, action)).resolves.toBeUndefined();
  });

  it("locks journal rows before comparing exact SQL snapshot values", async () => {
    const tx = transaction(active);
    await assertPostingRevisionState(tx, document, "VOID");
    const [lock, comparison] = tx.$queryRaw.mock.calls;
    expect(lock[0].join("?")).toContain('ORDER BY "id" FOR UPDATE');
    expect(comparison[0].join("?")).toContain('entry."debit"::text');
    expect(comparison[0].join("?")).toContain('ORDER BY history."revision" DESC LIMIT 1');
    expect(comparison.slice(1)).toEqual([document.id, document.id, document.id]);
  });

  it.each([true, false])("rejects another POST after an active revision, hasEntries=%s", async hasEntries => {
    await expect(assertPostingRevisionState(transaction({ ...active, hasEntries }), document, "POST"))
      .rejects.toThrow(/accounting review/);
  });

  it.each([
    { orgId: "foreign" }, { periodId: "foreign" }, { hashValid: false },
    { ledgerMatches: false }, { hasEntries: false }, { action: "UNKNOWN" },
  ])("rejects inconsistent active evidence %j", async change => {
    await expect(assertPostingRevisionState(transaction({ ...active, ...change }), document, "VOID"))
      .rejects.toThrow(/accounting review/);
  });

  it("rejects a live VOIDED status hiding an active archived POST", async () => {
    await expect(assertPostingRevisionState(transaction(active), { ...document, status: "VOIDED" }, "VOID"))
      .rejects.toThrow(/accounting review/);
  });

  it.each(["POST", "VOID"] as const)("allows consistent inactive state for %s", async action => {
    await expect(assertPostingRevisionState(transaction({ ...active, action: "VOID", hasEntries: false }),
      { ...document, status: action === "POST" ? "POSTED" : "VOIDED" }, action)).resolves.toBeUndefined();
  });

  it.each(["POST", "VOID"] as const)("rejects leftover rows after VOID before %s", async action => {
    await expect(assertPostingRevisionState(transaction({ ...active, action: "VOID" }), document, action))
      .rejects.toThrow(/accounting review/);
  });

  it("rejects an inactive revision with a live POSTED status on void", async () => {
    await expect(assertPostingRevisionState(transaction({ ...active, action: "VOID", hasEntries: false }), document, "VOID"))
      .rejects.toThrow(/accounting review/);
  });

  it("does not continue when the archive read fails", async () => {
    const tx = { $queryRaw: vi.fn().mockResolvedValueOnce([]).mockRejectedValueOnce(new Error("archive unavailable")) };
    await expect(assertPostingRevisionState(tx, document, "POST")).rejects.toThrow("archive unavailable");
  });
});
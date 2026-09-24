import { beforeEach, describe, expect, it, vi } from "vitest";
import { postDocument, voidDocument, repostDocument } from "@/lib/posting/postingEngine";
import { isSystemDocumentType } from "@/lib/posting/documentPolicy";

const { syncCalendar } = vi.hoisted(() => ({ syncCalendar: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ default: {} }));
vi.mock("@/lib/closing", () => ({ upsertTaxCalendarEventsForPeriod: syncCalendar }));

describe("posting transaction safety", () => {
  const transaction = {
    $queryRaw: vi.fn(),
    $executeRaw: vi.fn(),
    document: { findUnique: vi.fn(), update: vi.fn() },
    documentType: { findUnique: vi.fn() },
    period: { findUnique: vi.fn() },
    organization: { findUnique: vi.fn() },
    account: { findUnique: vi.fn() },
    journalEntry: { findFirst: vi.fn(), create: vi.fn(), deleteMany: vi.fn() },
    openItem: { findFirst: vi.fn(), updateMany: vi.fn() },
    stagedTransaction: { findMany: vi.fn(), updateMany: vi.fn() },
    auditLog: { create: vi.fn() },
  };
  let committed: unknown[];
  let pending: unknown[];
  const client = {
    $transaction: vi.fn(async (operation) => {
      pending = [];
      const result = await operation(transaction);
      committed.push(...pending);
      return result;
    }),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    committed = [];
    pending = [];
    syncCalendar.mockResolvedValue(undefined);
    transaction.$queryRaw.mockResolvedValue([]);
    transaction.$executeRaw.mockResolvedValue(1);
    transaction.documentType.findUnique.mockResolvedValue({ code: "TEST" });
    transaction.document.findUnique.mockResolvedValue({
      id: "doc-safe", orgId: "org-safe", periodId: "period-safe", status: "POSTED",
      date: new Date("2026-09-10T00:00:00Z"), payload: { amount: "100" },
      type: { code: "TEST", postingTemplate: { lines: [
        { accountCode: "5110", side: "debit", expression: "amount" },
        { accountCode: "4010", side: "credit", expression: "amount" },
      ] } },
    });
    transaction.period.findUnique.mockResolvedValue({
      id: "period-safe", orgId: "org-safe", year: 2026, month: 9, status: "OPEN", lockDate: null,
    });
    transaction.organization.findUnique.mockResolvedValue({ isVatPayer: false });
    transaction.account.findUnique.mockImplementation(async ({ where }) => ({ id: where.code }));
    transaction.journalEntry.findFirst.mockResolvedValue(null);
    transaction.openItem.findFirst.mockResolvedValue(null);
    transaction.stagedTransaction.findMany.mockResolvedValue([]);
    transaction.journalEntry.create.mockImplementation(async ({ data }) => { pending.push(data); return data; });
  });

  it("opens a bounded transaction for a root client and locks before checking existing entries", async () => {
    const result = await postDocument("doc-safe", client, "user-safe");
    expect(client.$transaction).toHaveBeenCalledOnce();
    expect(client.$transaction).toHaveBeenCalledWith(expect.any(Function), expect.objectContaining({ maxWait: 5000, timeout: 30000 }));
    expect(transaction.$queryRaw).toHaveBeenCalled();
    expect(transaction.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(transaction.journalEntry.findFirst.mock.invocationCallOrder[0]);
    expect(result.journalEntries).toHaveLength(2);
    expect(committed).toHaveLength(2);
  });

  it("uses an existing transaction without nesting", async () => {
    await postDocument("doc-safe", transaction, "user-safe");
    expect(client.$transaction).not.toHaveBeenCalled();
    expect(transaction.$queryRaw).toHaveBeenCalled();
  });

  it("treats opening balances as system documents", () => {
    expect(isSystemDocumentType("OPENING_BALANCE")).toBe(true);
  });

  it.each(["post", "void", "repost"])("blocks shared %s of opening balances before writes", async operation => {
    const document = await transaction.document.findUnique();
    transaction.document.findUnique.mockResolvedValue({ ...document, type: { code: "OPENING_BALANCE" } });
    const result = operation === "post" ? postDocument("doc-safe", client)
      : operation === "void" ? voidDocument("doc-safe", client)
        : repostDocument("doc-safe", "new-type", client);
    await expect(result).rejects.toThrow(/Начальные остатки/);
    expect(transaction.document.update).not.toHaveBeenCalled();
    expect(transaction.journalEntry.create).not.toHaveBeenCalled();
    expect(transaction.journalEntry.deleteMany).not.toHaveBeenCalled();
    expect(transaction.$executeRaw).not.toHaveBeenCalled();
  });

  it("blocks conversion into an opening balance before voiding", async () => {
    transaction.documentType.findUnique.mockResolvedValue({ code: "OPENING_BALANCE" });
    await expect(repostDocument("doc-safe", "opening-type", client)).rejects.toThrow(/Начальные остатки/);
    expect(transaction.document.update).not.toHaveBeenCalled();
    expect(transaction.journalEntry.deleteMany).not.toHaveBeenCalled();
    expect(transaction.$executeRaw).not.toHaveBeenCalled();
  });

  it("writes the POST archive after journal entries in the same transaction", async () => {
    await postDocument("doc-safe", client, "user-safe");
    expect(transaction.$executeRaw).toHaveBeenCalledOnce();
    const [parts, ...values] = transaction.$executeRaw.mock.calls[0];
    expect(parts.join("")).toContain('INSERT INTO "PostingRevision"');
    expect(values).toContain("POST");
    expect(values).toContain("user-safe");
    expect(transaction.$executeRaw.mock.invocationCallOrder[0])
      .toBeGreaterThan(transaction.journalEntry.create.mock.invocationCallOrder[1]);
  });

  it.each(["post", "void", "repost"])("rolls back %s when archive persistence fails", async operation => {
    transaction.$executeRaw.mockRejectedValue(new Error("archive unavailable"));
    const result = operation === "post" ? postDocument("doc-safe", client)
      : operation === "void" ? voidDocument("doc-safe", client)
        : repostDocument("doc-safe", "new-type", client);
    await expect(result).rejects.toThrow("archive unavailable");
    expect(committed).toEqual([]);
    expect(transaction.document.update).not.toHaveBeenCalled();
    expect(transaction.journalEntry.deleteMany).not.toHaveBeenCalled();
  });

  it("archives VOID before deleting or changing the live document", async () => {
    await voidDocument("doc-safe", client);
    expect(transaction.$executeRaw.mock.calls[0]).toContain("VOID");
    expect(transaction.$executeRaw.mock.invocationCallOrder[0])
      .toBeLessThan(transaction.document.update.mock.invocationCallOrder[0]);
    expect(transaction.$executeRaw.mock.invocationCallOrder[0])
      .toBeLessThan(transaction.journalEntry.deleteMany.mock.invocationCallOrder[0]);
  });

  it.each(["POSTED", "VOIDED"])("checks ledger drift before voiding a %s document", async status => {
    const document = await transaction.document.findUnique();
    transaction.document.findUnique.mockResolvedValue({ ...document, status });
    transaction.$queryRaw.mockImplementation(async (parts) => parts.join("").includes('FROM "PostingRevision"')
      ? [{ orgId: "org-safe", periodId: "period-safe", action: "POST", hashValid: true, ledgerMatches: false, hasEntries: true }]
      : []);
    await expect(voidDocument("doc-safe", client)).rejects.toThrow(/accounting review/);
    expect(transaction.document.update).not.toHaveBeenCalled();
    expect(transaction.$executeRaw).not.toHaveBeenCalled();
  });

  it("rejects a duplicate before writes", async () => {
    transaction.journalEntry.findFirst.mockResolvedValue({ id: "existing-entry" });
    await expect(postDocument("doc-safe", client)).rejects.toThrow(/уже провед/);
    expect(transaction.journalEntry.create).not.toHaveBeenCalled();
    expect(transaction.auditLog.create).not.toHaveBeenCalled();
  });

  it("propagates calendar failure and does not commit journal entries", async () => {
    syncCalendar.mockRejectedValue(new Error("calendar unavailable"));
    await expect(postDocument("doc-safe", client)).rejects.toThrow("calendar unavailable");
    expect(pending).toHaveLength(2);
    expect(committed).toEqual([]);
    expect(transaction.document.update).not.toHaveBeenCalled();
  });

  it("propagates a late journal failure and does not commit the first entry", async () => {
    transaction.journalEntry.create
      .mockImplementationOnce(async ({ data }) => { pending.push(data); return data; })
      .mockRejectedValueOnce(new Error("journal unavailable"));
    await expect(postDocument("doc-safe", client)).rejects.toThrow("journal unavailable");
    expect(committed).toEqual([]);
    expect(pending).toHaveLength(1);
  });

  it.each([
    { orgId: "another-org", year: 2026, month: 9 },
    { orgId: "org-safe", year: 2026, month: 8 },
    { orgId: "org-safe", year: 2025, month: 9 },
  ])("rejects an incompatible period %j", async (period) => {
    transaction.period.findUnique.mockResolvedValue({ ...period, status: "OPEN", lockDate: null });
    await expect(postDocument("doc-safe", client)).rejects.toThrow(/Период не принадлежит|Дата документа/);
    expect(transaction.journalEntry.create).not.toHaveBeenCalled();
  });

  it("uses the accounting month in Asia/Tashkent", async () => {
    const document = await transaction.document.findUnique();
    transaction.document.findUnique.mockResolvedValue({ ...document, date: new Date("2026-08-31T19:30:00Z") });
    await postDocument("doc-safe", client);
    expect(committed).toHaveLength(2);
  });

  it("rolls back void when calendar synchronization fails", async () => {
    syncCalendar.mockRejectedValue(new Error("calendar unavailable"));
    await expect(voidDocument("doc-safe", client)).rejects.toThrow("calendar unavailable");
    expect(client.$transaction).toHaveBeenCalledOnce();
    expect(transaction.journalEntry.deleteMany).toHaveBeenCalledOnce();
    expect(committed).toEqual([]);
  });

  it("wraps the whole repost in one transaction", async () => {
    await repostDocument("doc-safe", "new-type", client);
    expect(client.$transaction).toHaveBeenCalledOnce();
    expect(transaction.journalEntry.deleteMany).toHaveBeenCalledOnce();
    expect(transaction.journalEntry.create).toHaveBeenCalledTimes(2);
  });

  it.each(["void", "repost"])("rejects %s of a settled debt source before writes", async (operation) => {
    transaction.openItem.findFirst.mockResolvedValue({ id: "settled-debt" });
    const result = operation === "void"
      ? voidDocument("doc-safe", client)
      : repostDocument("doc-safe", "new-type", client);
    await expect(result).rejects.toThrow(/сначала отмените документ расчёта/);
    expect(transaction.openItem.findFirst).toHaveBeenCalledWith({
      where: { orgId: "org-safe", openingDocumentId: "doc-safe", closingDocumentId: { not: null } },
      select: { id: true },
    });
    const itemLock = transaction.$queryRaw.mock.calls.findIndex(([parts]) => parts.join("").includes('FROM "OpenItem"'));
    expect(itemLock).toBeGreaterThanOrEqual(0);
    expect(transaction.$queryRaw.mock.invocationCallOrder[itemLock]).toBeLessThan(transaction.openItem.findFirst.mock.invocationCallOrder[0]);
    expect(transaction.document.update).not.toHaveBeenCalled();
    expect(transaction.journalEntry.deleteMany).not.toHaveBeenCalled();
    expect(transaction.openItem.updateMany).not.toHaveBeenCalled();
    expect(transaction.auditLog.create).not.toHaveBeenCalled();
  });
});
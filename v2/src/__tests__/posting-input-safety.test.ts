import { beforeEach, describe, expect, it, vi } from "vitest";
import Decimal from "decimal.js";
import { evaluate } from "@/lib/posting/expressionEval";
import { postDocument } from "@/lib/posting/postingEngine";

vi.mock("@/lib/closing", () => ({
  upsertTaxCalendarEventsForPeriod: vi.fn().mockResolvedValue(undefined),
}));

describe("expression input safety (ACC-050)", () => {
  it.each([
    ["amount", {}],
    ["ammount", { amount: "100" }],
    ["missing == 'monthly'", {}],
    ["amount", { amount: null }],
    ["amount", { amount: {} }],
    ["constructor", {}],
    ["amount > 0", { amount: Infinity }],
    ["amount == 0", { amount: NaN }],
    ["amount", { amount: new Decimal(Infinity) }],
    ["amount * amount == 0", { amount: new Decimal("1e9000000000000000") }],
    ["1 || amount * amount", { amount: new Decimal("1e9000000000000000") }],
    ["Infinity == 0", {}],
    ["amount / 0", { amount: "100" }],
  ])("rejects invalid input for %s", (expression, payload) => {
    expect(() => evaluate(expression, payload)).toThrow();
  });

  it("preserves decimal arithmetic and explicit optional zero values", () => {
    expect(evaluate("amount - vatAmount", { amount: "100.25", vatAmount: "0" }).toString()).toBe("100.25");
    expect(evaluate("kind == 'monthly'", { kind: "monthly" }).toString()).toBe("1");
  });

  it.each([
    ["code == '0010'", { code: "0010" }, "1"],
    ["code == '10'", { code: "0010" }, "0"],
    ["code != '10'", { code: "0010" }, "1"],
    ["first == second", { first: "0010", second: "10" }, "0"],
    ["amount == 100.25", { amount: "100.25" }, "1"],
    ["amount + fee", { amount: "100.25", fee: "0.01" }, "100.26"],
    ["amount > 0 && code == '0010'", { amount: "100.25", code: "0010" }, "1"],
  ])("preserves string identity and numeric context: %s", (expression, payload, expected) => {
    expect(evaluate(expression, payload).toString()).toBe(expected);
  });

  it.each(["0x10", "0b10", " ", "NaN", "Infinity", "1_000"])("rejects non-decimal monetary text %s", (amount) => {
    expect(() => evaluate("amount + 1", { amount })).toThrow();
  });
});

describe("posting input safety (ACC-004, ACC-050, ACC-054)", () => {
  const mockTx = {
    $queryRaw: vi.fn(),
    document: { findUnique: vi.fn(), update: vi.fn() },
    period: { findUnique: vi.fn() },
    organization: { findUnique: vi.fn() },
    account: { findUnique: vi.fn() },
    counterparty: { findFirst: vi.fn(), create: vi.fn() },
    journalEntry: { findFirst: vi.fn(), create: vi.fn() },
    openItem: { create: vi.fn(), findMany: vi.fn(), updateMany: vi.fn() },
    taxCalendarEvent: { updateMany: vi.fn() },
    auditLog: { create: vi.fn() },
  };

  function documentWith(amount: unknown, condition?: string, side = "debit") {
    return {
      id: "doc-safety",
      orgId: "org-safety",
      periodId: "period-safety",
      status: "POSTED",
      date: new Date("2026-09-10T00:00:00.000Z"),
      payload: { amount, counterpartyInn: "test-counterparty", counterpartyHint: "Test counterparty" },
      type: {
        code: "TEST_DOCUMENT",
        postingTemplate: {
          lines: [
            { accountCode: "5110", side, expression: "amount", condition, subcontoType: "counterparty" },
            { accountCode: "4010", side: "credit", expression: "amount", condition },
          ],
        },
      },
    };
  }

  beforeEach(() => {
    vi.resetAllMocks();
    mockTx.document.findUnique.mockResolvedValue(documentWith("100.25"));
    mockTx.period.findUnique.mockResolvedValue({ orgId: "org-safety", year: 2026, month: 9, status: "OPEN", lockDate: null });
    mockTx.organization.findUnique.mockResolvedValue({ isVatPayer: false });
    mockTx.account.findUnique.mockImplementation(async ({ where }) => ({ id: where.code }));
    mockTx.counterparty.findFirst.mockResolvedValue(null);
    mockTx.counterparty.create.mockResolvedValue({ id: "counterparty-safety" });
    mockTx.journalEntry.create.mockImplementation(async ({ data }) => data);
  });

  function expectNoWrites() {
    expect(mockTx.counterparty.create).not.toHaveBeenCalled();
    expect(mockTx.journalEntry.create).not.toHaveBeenCalled();
    expect(mockTx.openItem.create).not.toHaveBeenCalled();
    expect(mockTx.document.update).not.toHaveBeenCalled();
    expect(mockTx.auditLog.create).not.toHaveBeenCalled();
  }

  it.each([
    { accountCode: "4410", side: "debit" },
    { accountCode: "4410", side: "credit" },
    { accountCode: "$vatAccountCode", side: "debit" },
    { accountCode: "$vatAccountCode", side: "credit" },
  ])("blocks non-payer VAT through $accountCode/$side before writes", async ({ accountCode, side }) => {
    const doc = documentWith("12.01");
    Object.assign(doc.payload, { vatAccountCode: "4410", isVatPayer: true });
    doc.type.postingTemplate.lines[0].accountCode = accountCode;
    doc.type.postingTemplate.lines[0].side = side;
    doc.type.postingTemplate.lines[1].side = side === "debit" ? "credit" : "debit";
    mockTx.document.findUnique.mockResolvedValue(doc);
    await expect(postDocument(doc.id, mockTx)).rejects.toThrow(/4410.*статуса плательщика НДС/);
    expectNoWrites();
  });

  it("permits VAT-account entries for a declared payer", async () => {
    const doc = documentWith("12.01");
    doc.type.postingTemplate.lines[0].accountCode = "4410";
    mockTx.organization.findUnique.mockResolvedValue({ isVatPayer: true });
    mockTx.document.findUnique.mockResolvedValue(doc);
    expect((await postDocument(doc.id, mockTx)).journalEntries).toHaveLength(2);
  });

  it("permits a non-payer receipt with zero VAT and nonzero expense", async () => {
    const doc = documentWith("100.00");
    doc.type.postingTemplate.lines.push({ accountCode: "4410", side: "debit", expression: "0", condition: undefined, subcontoType: "counterparty" });
    mockTx.document.findUnique.mockResolvedValue(doc);
    expect((await postDocument(doc.id, mockTx)).journalEntries).toHaveLength(2);
  });

  it.each([true, false])("honors an explicitly selected debt (available: %s)", async (available) => {
    const document = documentWith("100.25");
    Object.assign(document.payload, { openItemId: "selected-item" });
    Object.assign(document.type.postingTemplate, { closesOpenItemByAccount: "4010" });
    mockTx.document.findUnique.mockResolvedValue(document);
    mockTx.counterparty.findFirst.mockResolvedValue({ id: "counterparty-safety" });
    mockTx.openItem.findMany.mockResolvedValue([
      { id: "older-equal-item", amount: "100.25" },
      ...(available ? [{ id: "selected-item", amount: "100.25" }] : []),
    ]);
    mockTx.openItem.updateMany.mockResolvedValue({ count: 1 });
    if (available) {
      await postDocument("doc-safety", mockTx);
      expect(mockTx.openItem.updateMany).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: "selected-item", orgId: "org-safety", status: { in: ["OPEN", "RISK"] } },
      }));
    } else {
      await expect(postDocument("doc-safety", mockTx)).rejects.toThrow(/Выбранная задолженность недоступна/);
      expectNoWrites();
      expect(mockTx.openItem.updateMany).not.toHaveBeenCalled();
    }
  });

  it.each([undefined, "0", "-100", "0.005", "1000000000000000000", Infinity, NaN])(
    "rejects unsafe amount %s before writes",
    async (amount) => {
      mockTx.document.findUnique.mockResolvedValue(documentWith(amount));
      await expect(postDocument("doc-safety", mockTx)).rejects.toThrow();
      expectNoWrites();
    },
  );

  it("rejects a template without active lines before writes", async () => {
    mockTx.document.findUnique.mockResolvedValue(documentWith("100", "amount < 0"));
    await expect(postDocument("doc-safety", mockTx)).rejects.toThrow();
    expectNoWrites();
  });

  describe.each(["opening", "settlement"])("%s debt amount validation", (operation) => {
    it.each([undefined, "0", "-100", "0.005", "1000000000000000000", Infinity, NaN])(
      "rejects unsafe debt %s even when journal formulas are valid", async (amount) => {
        const document = documentWith(amount);
        mockTx.document.findUnique.mockResolvedValue({ ...document,
          type: { ...document.type, postingTemplate: {
            lines: document.type.postingTemplate.lines.map((line) => ({ ...line, expression: "100" })),
            ...(operation === "opening"
              ? { opensItem: true, itemAccountCode: "4010" }
              : { closesOpenItemByAccount: "4010" }),
          } },
        });
        await expect(postDocument(document.id, mockTx)).rejects.toThrow();
        expectNoWrites();
        expect(mockTx.openItem.findMany).not.toHaveBeenCalled();
        expect(mockTx.openItem.updateMany).not.toHaveBeenCalled();
      },
    );
  });

  it.each(["0.01", "999999999999999999.99"])("preserves valid debt amount %s", async (amount) => {
    const document = documentWith(amount);
    mockTx.document.findUnique.mockResolvedValue({ ...document,
      type: { ...document.type, postingTemplate: { ...document.type.postingTemplate, opensItem: true, itemAccountCode: "4010" } },
    });
    await postDocument(document.id, mockTx);
    expect(mockTx.openItem.create.mock.calls[0][0].data.amount.toString()).toBe(amount);
  });

  it("rejects an invalid posting side before writes", async () => {
    mockTx.document.findUnique.mockResolvedValue(documentWith("100", undefined, "invalid"));
    await expect(postDocument("doc-safety", mockTx)).rejects.toThrow();
    expectNoWrites();
  });

  it("posts a valid balanced document and retains counterparty analytics", async () => {
    const result = await postDocument("doc-safety", mockTx);
    expect(result.journalEntries).toHaveLength(2);
    expect(result.journalEntries[0].debit.toString()).toBe("100.25");
    expect(result.journalEntries[1].credit.toString()).toBe("100.25");
    expect(result.journalEntries[0].counterpartyId).toBe("counterparty-safety");
    expect(mockTx.auditLog.create).toHaveBeenCalledOnce();
  });

  it.each(["missing", "amount - 1", "amount / 0"])("rejects a faulty later line %s before writes", async (expression) => {
    const document = documentWith("100");
    document.type.postingTemplate.lines[1].expression = expression;
    mockTx.document.findUnique.mockResolvedValue(document);
    await expect(postDocument("doc-safety", mockTx)).rejects.toThrow();
    expectNoWrites();
  });

  it.each(["0.01", "999999999999999999.99"])("preserves the representable amount %s", async (amount) => {
    mockTx.document.findUnique.mockResolvedValue(documentWith(amount));
    const result = await postDocument("doc-safety", mockTx);
    expect(result.journalEntries[0].debit.toString()).toBe(amount);
    expect(result.journalEntries[1].credit.toString()).toBe(amount);
  });

  it("rejects missing required counterparty before writes", async () => {
    const document = documentWith("100");
    mockTx.document.findUnique.mockResolvedValue({ ...document, payload: { amount: "100", counterpartyHint: " " },
      type: { ...document.type, postingTemplate: { ...document.type.postingTemplate, requiresCounterparty: true } }
    });
    await expect(postDocument("doc-safety", mockTx)).rejects.toThrow(/обязателен контрагент/);
    expectNoWrites();
  });

  it("does not lose a one-cent imbalance when totals exceed Decimal precision", async () => {
    const document = documentWith("999999999999999999.99");
    const [debit, credit] = document.type.postingTemplate.lines;
    document.type.postingTemplate.lines = [debit, { ...debit, expression: "0.02" }, credit, { ...credit, expression: "0.01" }];
    mockTx.document.findUnique.mockResolvedValue(document);
    await expect(postDocument("doc-safety", mockTx)).rejects.toThrow(/Несбалансированная проводка/);
    expectNoWrites();
  });

  it("retains exact audit totals beyond a single Decimal(20,2) row", async () => {
    const document = documentWith("999999999999999999.99");
    const [debit, credit] = document.type.postingTemplate.lines;
    document.type.postingTemplate.lines = [debit, { ...debit, expression: "0.02" }, credit, { ...credit, expression: "0.02" }];
    mockTx.document.findUnique.mockResolvedValue(document);
    await postDocument("doc-safety", mockTx);
    expect(mockTx.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ newValue: { journalEntryCount: 4, totalAmount: "1000000000000000000.01" } })
    }));
  });

  it.each(["40", "120", "99.99"])("rejects unsafe automatic settlement of 100 with %s", async (amount) => {
    const document = documentWith(amount);
    mockTx.document.findUnique.mockResolvedValue({ ...document,
      type: { ...document.type, postingTemplate: { ...document.type.postingTemplate, closesOpenItemByAccount: "6010" } }
    });
    mockTx.counterparty.findFirst.mockResolvedValue({ id: "counterparty-safety" });
    mockTx.openItem.findMany.mockResolvedValue([{ id: "debt-100", amount: "100" }]);
    await expect(postDocument("doc-safety", mockTx)).rejects.toThrow(/регистра распределений/);
    expectNoWrites();
    expect(mockTx.openItem.updateMany).not.toHaveBeenCalled();
  });

  it("closes only an exact matching debt", async () => {
    const document = documentWith("100");
    mockTx.document.findUnique.mockResolvedValue({ ...document,
      type: { ...document.type, postingTemplate: { ...document.type.postingTemplate, closesOpenItemByAccount: "6010" } }
    });
    mockTx.openItem.findMany.mockResolvedValue([{ id: "debt-200", amount: "200" }, { id: "debt-100", amount: "100" }]);
    mockTx.openItem.updateMany.mockResolvedValue({ count: 1 });
    await postDocument("doc-safety", mockTx);
    expect(mockTx.openItem.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "debt-100", orgId: "org-safety", status: { in: ["OPEN", "RISK"] } }
    }));
  });

  it.each(["TAX_PAYMENT", "SOCIAL_TAX_PAYMENT", "INPS_PAYMENT"])("does not mark unrelated taxes DONE for %s", async (code) => {
    const document = documentWith("100");
    mockTx.document.findUnique.mockResolvedValue({ ...document, type: { ...document.type, code } });
    await postDocument("doc-safety", mockTx);
    expect(mockTx.taxCalendarEvent.updateMany).not.toHaveBeenCalled();
  });

  it.each(["7810", "7820"])("opens a long-term loan on resolved account %s", async (loanAccountCode) => {
    const document = documentWith("100");
    mockTx.document.findUnique.mockResolvedValue({ ...document,
      payload: { ...document.payload, loanAccountCode },
      type: { code: "LONG_TERM_LOAN_RECEIVED", postingTemplate: {
        lines: [document.type.postingTemplate.lines[0], { accountCode: "$loanAccountCode", side: "credit", expression: "amount" }],
        opensItem: true, itemAccountCode: "$loanAccountCode",
      } },
    });
    await postDocument(document.id, mockTx);
    expect(mockTx.openItem.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ accountId: loanAccountCode, counterpartyId: "counterparty-safety" }),
    }));
    expect(mockTx.account.findUnique).not.toHaveBeenCalledWith({ where: { code: "$loanAccountCode" } });
  });

  it.each(["7810", "7820"])("settles a loan on resolved account %s", async (loanAccountCode) => {
    const document = documentWith("100");
    mockTx.document.findUnique.mockResolvedValue({ ...document,
      payload: { ...document.payload, loanAccountCode },
      type: { code: "LONG_TERM_LOAN_REPAYMENT", postingTemplate: {
        lines: [{ accountCode: "$loanAccountCode", side: "debit", expression: "amount" }, { accountCode: "5110", side: "credit", expression: "amount" }],
        closesOpenItemByAccount: "$loanAccountCode",
      } },
    });
    mockTx.openItem.findMany.mockResolvedValue([{ id: "loan", amount: "100" }]);
    mockTx.openItem.updateMany.mockResolvedValue({ count: 1 });
    await postDocument(document.id, mockTx);
    expect(mockTx.openItem.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { orgId: document.orgId, accountId: loanAccountCode, counterpartyId: "counterparty-safety",
        status: { in: ["OPEN", "RISK"] }, dateOpened: { lte: document.date } },
    }));
  });

  it.each([undefined, "5110", "001", "7800", "9030", 7810, {}])("rejects invalid loan account %s before writes", async (loanAccountCode) => {
    const document = documentWith("100");
    mockTx.document.findUnique.mockResolvedValue({ ...document,
      payload: { ...document.payload, loanAccountCode }, type: { ...document.type, code: "LONG_TERM_LOAN_RECEIVED" },
    });
    await expect(postDocument(document.id, mockTx)).rejects.toThrow();
    expectNoWrites();
  });

  it("rejects loan repayment without an eligible debt", async () => {
    const document = documentWith("100");
    mockTx.document.findUnique.mockResolvedValue({ ...document,
      payload: { ...document.payload, loanAccountCode: "7810" },
      type: { code: "LONG_TERM_LOAN_REPAYMENT", postingTemplate: {
        ...document.type.postingTemplate, closesOpenItemByAccount: "$loanAccountCode",
      } },
    });
    mockTx.counterparty.findFirst.mockResolvedValue({ id: "counterparty-safety" });
    mockTx.openItem.findMany.mockResolvedValue([]);
    await expect(postDocument(document.id, mockTx)).rejects.toThrow(/нет открытого долга/);
    expectNoWrites();
  });

  it("requires a counterparty for long-term loans even with a legacy template", async () => {
    const document = documentWith("100");
    mockTx.document.findUnique.mockResolvedValue({ ...document,
      payload: { amount: "100", loanAccountCode: "7810" },
      type: { ...document.type, code: "LONG_TERM_LOAN_RECEIVED" },
    });
    await expect(postDocument(document.id, mockTx)).rejects.toThrow(/обязателен контрагент/);
    expectNoWrites();
  });

  it("uses an explicitly selected tenant counterparty without creating another", async () => {
    const document = documentWith("100");
    mockTx.document.findUnique.mockResolvedValue({ ...document,
      payload: { amount: "100", counterpartyId: "selected-party" },
      type: { ...document.type, postingTemplate: { ...document.type.postingTemplate, requiresCounterparty: true } },
    });
    mockTx.counterparty.findFirst.mockResolvedValue({ id: "selected-party", inn: "123" });
    const result = await postDocument(document.id, mockTx);
    expect(mockTx.counterparty.findFirst).toHaveBeenCalledWith({ where: { id: "selected-party", orgId: document.orgId } });
    expect(result.journalEntries[0].counterpartyId).toBe("selected-party");
    expect(mockTx.counterparty.create).not.toHaveBeenCalled();
  });

  it.each([null, { id: "selected-party", inn: "different-inn" }])("rejects a foreign or mismatched selected counterparty: %j", async (counterparty) => {
    const document = documentWith("100");
    mockTx.document.findUnique.mockResolvedValue({ ...document,
      payload: { ...document.payload, counterpartyId: "selected-party" },
    });
    mockTx.counterparty.findFirst.mockResolvedValue(counterparty);
    await expect(postDocument(document.id, mockTx)).rejects.toThrow(/Контрагент|ИНН/);
    expectNoWrites();
  });

  it.each([
    { counterpartyId: {} }, { counterpartyId: " " }, { counterpartyInn: {} }, { counterpartyHint: 123 },
    { contractId: "unverified-contract" }, { contractId: {} },
  ])("rejects invalid analytic references before writes: %j", async (fields) => {
    const document = documentWith("100");
    mockTx.document.findUnique.mockResolvedValue({ ...document, payload: { ...document.payload, ...fields } });
    await expect(postDocument(document.id, mockTx)).rejects.toThrow();
    expectNoWrites();
  });

  it("rejects templates requiring unsupported contract analytics", async () => {
    const document = documentWith("100");
    document.type.postingTemplate.lines[0].subcontoType = "contract";
    mockTx.document.findUnique.mockResolvedValue(document);
    await expect(postDocument(document.id, mockTx)).rejects.toThrow(/реестра договоров/);
    expectNoWrites();
  });
});
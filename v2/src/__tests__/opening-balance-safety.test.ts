import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/settings/opening-balance/route";
import Decimal from "decimal.js";
import { isOpeningBalanceAccount, openingBalanceSchema, openingBalanceTotals } from "@/lib/openingBalanceInput";

const { membership, database } = vi.hoisted(() => ({
  membership: vi.fn(),
  database: {
    $transaction: vi.fn(), $queryRaw: vi.fn(), period: { findFirst: vi.fn() },
    document: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn() },
    documentType: { upsert: vi.fn() }, account: { findMany: vi.fn() }, auditLog: { create: vi.fn() },
  },
}));
vi.mock("@/lib/context", () => ({ getActiveMembership: membership }));
vi.mock("@/lib/prisma", () => ({ default: database }));

const validBody = {
  date: "2026-09-01",
  lines: [
    { accountCode: "5110", debit: "100.00", credit: "0.00" },
    { accountCode: "8330", debit: "0.00", credit: "100.00" },
  ],
};
const request = (body: unknown) => new NextRequest("http://localhost/api/settings/opening-balance", {
  method: "POST", body: JSON.stringify(body),
});

describe("opening balance input safety", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    membership.mockResolvedValue({ orgId: "org-1", userId: "user-1", role: "ACCOUNTANT" });
      database.$transaction.mockImplementation(async operation => operation(database));
      database.$queryRaw.mockResolvedValue([{ id: "org-1" }]);
      database.period.findFirst.mockImplementation(async ({ where }) => where.year ? { id: "sep-2026", status: "OPEN", lockDate: null } : null);
      database.document.findFirst.mockResolvedValue(null);
      database.document.findMany.mockResolvedValue([]);
      database.document.create.mockResolvedValue({ id: "opening-1" });
      database.documentType.upsert.mockResolvedValue({ id: "type-1" });
      database.account.findMany.mockResolvedValue(validBody.lines.map(line => ({
        id: line.accountCode, code: line.accountCode, type: line.accountCode === "5110" ? "ASSET" : "LIABILITY",
        isDeprecated: false, _count: { children: 0 },
      })));
  });

  it.each(["OWNER", "ADMIN", "ACCOUNTANT"])("stores balanced exact strings as %s with the date-selected period and audit", async role => {
    membership.mockResolvedValue({ orgId: "org-1", userId: "user-1", role });
    const response = await POST(request(validBody));
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ id: "opening-1", totals: { debit: "100.00", credit: "100.00" } });
    expect(database.period.findFirst).toHaveBeenNthCalledWith(1, { where: { orgId: "org-1", year: 2026, month: 9 } });
    expect(database.document.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      orgId: "org-1", periodId: "sep-2026", date: new Date("2026-08-31T19:00:00Z"),
      journalEntries: { create: validBody.lines.map(line => ({
        accountId: line.accountCode, debit: line.debit, credit: line.credit, date: new Date("2026-08-31T19:00:00Z"),
      })) },
    }) });
    expect(database.auditLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      orgId: "org-1", userId: "user-1", action: "CREATE_OPENING_BALANCE", entityId: "opening-1",
      newValue: expect.objectContaining({ date: validBody.date, lines: validBody.lines }),
    }) });
    expect(database.$queryRaw).toHaveBeenCalledTimes(2);
  });

  it.each([null, { status: "CLOSED", lockDate: null }, { status: "OPEN", lockDate: new Date() }])("refuses a missing or locked date-selected period: %j", async period => {
    database.period.findFirst.mockResolvedValueOnce(period);
    expect((await POST(request(validBody))).status).toBe(period ? 409 : 400);
    expect(database.documentType.upsert).not.toHaveBeenCalled();
    expect(database.document.create).not.toHaveBeenCalled();
  });

  it("refuses replacement or late initialization without deleting history", async () => {
    database.document.findFirst.mockResolvedValue({ id: "existing" });
    const response = await POST(request(validBody));
    expect(response.status).toBe(409);
    expect(await response.json()).toHaveProperty("code", "OPENING_BALANCE_REQUIRES_REVIEW");
    expect(database.document.findFirst).toHaveBeenCalledWith({ where: { orgId: "org-1" }, select: { id: true } });
    expect(database.document.create).not.toHaveBeenCalled();
    expect(database.auditLog.create).not.toHaveBeenCalled();
  });

  it("refuses another closed period even when the selected period is open", async () => {
    database.period.findFirst.mockResolvedValueOnce({ id: "sep", status: "OPEN", lockDate: null }).mockResolvedValueOnce({ id: "closed" });
    expect((await POST(request(validBody))).status).toBe(409);
    expect(database.document.create).not.toHaveBeenCalled();
  });

  it.each([
    { accounts: [] },
    { accounts: [{ code: "5110", type: "ASSET", isDeprecated: true, _count: { children: 0 } }] },
    { accounts: [{ code: "5100", type: "ASSET", isDeprecated: false, _count: { children: 1 } }] },
  ])("refuses missing or disallowed accounts before writes", async ({ accounts }) => {
    database.account.findMany.mockResolvedValue(accounts);
    expect((await POST(request(validBody))).status).toBe(400);
    expect(database.document.create).not.toHaveBeenCalled();
  });

  it("returns all legacy lines including 8890 with exact amounts and original date", async () => {
    database.document.findMany.mockResolvedValue([{
      id: "legacy", date: new Date("2026-08-31T19:00:00Z"),
      journalEntries: [
        { account: { code: "5110", name: "Bank" }, debit: new Decimal("9007199254740993.27"), credit: new Decimal(0) },
        { account: { code: "8890", name: "Targeted funds" }, debit: new Decimal(0), credit: new Decimal("9007199254740993.27") },
      ],
    }]);
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      documentId: "legacy", date: "2026-09-01", readOnly: true,
      lines: [expect.objectContaining({ debit: "9007199254740993.27" }), expect.objectContaining({ accountCode: "8890", credit: "9007199254740993.27" })],
      totals: { debit: "9007199254740993.27", credit: "9007199254740993.27" },
    });
    expect(database.document.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { orgId: "org-1", type: { code: "OPENING_BALANCE" }, status: "POSTED" } }));
  });

  it("does not silently choose one of multiple active legacy balances", async () => {
    database.document.findMany.mockResolvedValue([{ id: "one" }, { id: "two" }]);
    expect((await GET()).status).toBe(409);
  });

  it.each(["UNAUTHORIZED", "NO_ACTIVE_ORG", "FORBIDDEN"])("returns an access error for %s", async message => {
    membership.mockRejectedValue(new Error(message));
    expect((await GET()).status).toBe(message === "UNAUTHORIZED" ? 401 : 403);
    expect((await POST(request(validBody))).status).toBe(message === "UNAUTHORIZED" ? 401 : 403);
    expect(database.$transaction).not.toHaveBeenCalled();
  });

  it("rejects read-only roles before reading accounting data", async () => {
    membership.mockResolvedValue({ orgId: "org-1", userId: "user-1", role: "VIEWER" });
    expect((await POST(request(validBody))).status).toBe(403);
    expect(database.period.findFirst).not.toHaveBeenCalled();
    expect(database.$transaction).not.toHaveBeenCalled();
  });

  it.each([
    { ...validBody, date: "2026-02-30" },
    { ...validBody, date: "" },
    { ...validBody, lines: [] },
    { ...validBody, lines: [{ accountCode: "5110", debit: "0", credit: "0" }] },
    { ...validBody, lines: [{ accountCode: "5110", debit: "100", credit: "100" }] },
    { ...validBody, lines: [{ accountCode: "5110", debit: "1", credit: "0" }] },
    { ...validBody, lines: [{ accountCode: "5110", debit: "-1", credit: "0" }] },
    { ...validBody, lines: [{ accountCode: "5110", debit: "1.001", credit: "0" }] },
    { ...validBody, lines: [{ accountCode: "5110", debit: "1e2", credit: "0" }] },
    { ...validBody, lines: [{ accountCode: "5110", debit: 9007199254740992, credit: 0 }] },
  ])("rejects malformed or unbalanced input before opening a transaction: %j", async (body) => {
    expect((await POST(request(body))).status).toBe(400);
    expect(database.period.findFirst).not.toHaveBeenCalled();
    expect(database.$transaction).not.toHaveBeenCalled();
  });
});

describe("opening balance amount and account policy", () => {
  it.each(["bad", "", "NaN", "Infinity", "-1", "1e2", "1.001", "1000000000000000000", " 1 "])("rejects invalid money %s without throwing", value => {
    expect(openingBalanceSchema.safeParse({ ...validBody, lines: [
      { accountCode: "5110", debit: value, credit: "0" },
      { accountCode: "8330", debit: "0", credit: value },
    ] }).success).toBe(false);
  });

  it("preserves maximum decimal precision in reconciliation totals", () => {
    const lines = [
      { debit: "999999999999999999.99", credit: "0.00" },
      { debit: "999999999999999999.99", credit: "0.00" },
    ];
    expect(openingBalanceTotals(lines)).toEqual({ debit: "1999999999999999999.98", credit: "0.00" });
  });

  it.each([
    { code: "9000" }, { code: "001" }, { code: "5100" }, { code: "9410" },
    { isDeprecated: true }, { type: "TRANSIT" }, { type: "OFF_BALANCE" }, { _count: { children: 1 } },
  ])("rejects unsupported account attributes %j", override => {
    expect(isOpeningBalanceAccount({ code: "5110", type: "ASSET", isDeprecated: false, _count: { children: 0 }, ...override })).toBe(false);
  });
});
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/bank-accounts/route";
import { PUT, DELETE } from "@/app/api/bank-accounts/[id]/route";
import { POST as importBank } from "@/app/api/import/bank/route";
import { DELETE as rollbackBank } from "@/app/api/import/bank/rollback/route";

const fixture = vi.hoisted(() => ({
  client: null as PrismaClient | null, orgId: "", failAudit: "",
  afterBankLock: null as null | (() => Promise<void>),
}));
vi.mock("@/lib/context", () => ({ getActiveMembership: async () => ({ orgId: fixture.orgId, userId: "synthetic-user", role: "OWNER" }) }));
vi.mock("@/lib/prisma", () => ({ default: {
  get bankAccount() { return fixture.client!.bankAccount; },
  $transaction: (callback: (database: any) => Promise<any>, options: any) => fixture.client!.$transaction(async database => callback(new Proxy(database, {
    get(target, key) {
      if (key === "$queryRaw") return async (...args: any[]) => {
        const result = await (target.$queryRaw as any)(...args);
        if (String(args[0][0]).includes('FROM "BankAccount"')) await fixture.afterBankLock?.();
        return result;
      };
      if (key === "auditLog") return new Proxy(target.auditLog, { get(model, method) {
        if (method === "create") return (args: any) => {
          if (args.data.action === fixture.failAudit) throw new Error("injected account audit failure");
          return model.create(args);
        };
        return Reflect.get(model, method);
      } });
      return Reflect.get(target, key);
    },
  })), options),
} }));

const databaseUrl = process.env.ACC_TEST_DATABASE_URL;
if (databaseUrl) {
  const parsed = new URL(databaseUrl);
  if (parsed.hostname !== "127.0.0.1" || parsed.pathname !== "/contador_safety_test") {
    throw new Error("ACC_TEST_DATABASE_URL must target the disposable loopback contador_safety_test database");
  }
}

describe.skipIf(!databaseUrl)("bank accounts on disposable PostgreSQL", () => {
  const client = new PrismaClient({ datasourceUrl: databaseUrl });
  const orgIds: string[] = [];
  const ownNumber = "00000000000000000001";
  const otherNumber = "00000000000000000002";
  const thirdNumber = "00000000000000000003";
  const create = (accountNumber = ownNumber, lastBalance = "0.00") => POST(new NextRequest("http://localhost/api/bank-accounts", {
    method: "POST", body: JSON.stringify({ name: "Synthetic", accountNumber, lastBalance }),
  }));
  const update = (id: string, body: Record<string, unknown>) => PUT(new NextRequest(`http://localhost/api/bank-accounts/${id}`, {
    method: "PUT", body: JSON.stringify(body),
  }), { params: Promise.resolve({ id }) });
  const remove = (id: string) => DELETE(new NextRequest(`http://localhost/api/bank-accounts/${id}`, { method: "DELETE" }), { params: Promise.resolve({ id }) });
  const rawAccount = (accountNumber = ownNumber) => client.bankAccount.create({ data: { orgId: fixture.orgId, name: "Synthetic", accountNumber } });
  const upload = (id: string) => {
    const text = ["1CClientBankExchange", `РасчСчет=${ownNumber}`, "СекцияРасчСчет", `РасчСчет=${ownNumber}`,
      "ДатаНачала=01.09.2026", "ДатаКонца=30.09.2026", "НачальныйОстаток=0.00", "КонечныйОстаток=0.10", "КонецРасчСчет",
      "СекцияДокумент=Платежное поручение", "Дата=10.09.2026", "Сумма=0.10", `ПлательщикРасчСчет=${otherNumber}`,
      `ПолучательРасчСчет=${ownNumber}`, "НазначениеПлатежа=Synthetic", "КонецДокумента", "КонецФайла"].join("\n");
    const data = new FormData();
    data.set("bankAccountId", id);
    data.set("file", new File([text], "synthetic.txt"));
    return importBank(new NextRequest("http://localhost/api/import/bank", { method: "POST", body: data }));
  };

  beforeAll(() => { fixture.client = client; });
  beforeEach(async () => {
    fixture.orgId = `bank-account-${randomUUID()}`;
    orgIds.push(fixture.orgId);
    fixture.failAudit = "";
    fixture.afterBankLock = null;
    await client.organization.create({ data: { id: fixture.orgId, name: "Synthetic bank accounts" } });
  });
  afterAll(async () => {
    try {
      await client.stagedTransaction.deleteMany({ where: { orgId: { in: orgIds } } });
      await client.organization.deleteMany({ where: { id: { in: orgIds } } });
    } finally { await client.$disconnect(); }
  });

  it("stores normalized identity and an exact opening balance with audit", async () => {
    const response = await create("00000 00000 00000 00001", "9007199254740993.27");
    expect(response.status).toBe(201);
    const { id } = await response.json();
    const stored = await client.bankAccount.findUniqueOrThrow({ where: { id } });
    expect(stored.accountNumber).toBe(ownNumber);
    expect(stored.lastBalance.toFixed(2)).toBe("9007199254740993.27");
    const audit = await client.auditLog.findFirstOrThrow({ where: { orgId: fixture.orgId } });
    expect(audit).toMatchObject({ userId: "synthetic-user", action: "CREATE_BANK_ACCOUNT", entityId: id,
      newValue: expect.objectContaining({ lastBalance: "9007199254740993.27", accountNumber: ownNumber }) });
  });

  it("serializes concurrent creation of the same account number", async () => {
    const results = await Promise.all([create(), create("00000 00000 00000 00001")]);
    expect(results.map(response => response.status).sort()).toEqual([201, 409]);
    expect(await client.bankAccount.count({ where: { orgId: fixture.orgId } })).toBe(1);
    expect(await client.auditLog.count({ where: { orgId: fixture.orgId } })).toBe(1);
  });

  it("serializes concurrent renames to the same account number", async () => {
    const first = await rawAccount();
    const second = await rawAccount(otherNumber);
    const results = await Promise.all([update(first.id, { accountNumber: thirdNumber }), update(second.id, { accountNumber: thirdNumber })]);
    expect(results.map(response => response.status).sort()).toEqual([200, 409]);
    expect(await client.bankAccount.count({ where: { orgId: fixture.orgId, accountNumber: thirdNumber } })).toBe(1);
    expect(await client.auditLog.count({ where: { orgId: fixture.orgId } })).toBe(1);
  });

  it("serializes a create racing an account-number update", async () => {
    const account = await rawAccount();
    const results = await Promise.all([create(otherNumber), update(account.id, { accountNumber: otherNumber })]);
    const statuses = results.map(response => response.status);
    expect([[201, 409], [409, 200]]).toContainEqual(statuses);
    expect(await client.bankAccount.count({ where: { orgId: fixture.orgId, accountNumber: otherNumber } })).toBe(1);
  });

  it("refuses a legacy spaced duplicate without rewriting it", async () => {
    const account = await rawAccount("00000 00000 00000 00001");
    expect((await create()).status).toBe(409);
    expect(await client.bankAccount.findUnique({ where: { id: account.id } })).toEqual(account);
  });

  it("allows the same number in another organization but denies foreign mutation", async () => {
    const foreign = await rawAccount();
    fixture.orgId = `bank-account-${randomUUID()}`;
    orgIds.push(fixture.orgId);
    await client.organization.create({ data: { id: fixture.orgId, name: "Synthetic other organization" } });
    expect((await create()).status).toBe(201);
    expect((await update(foreign.id, { name: "Forbidden" })).status).toBe(404);
    expect((await remove(foreign.id)).status).toBe(404);
    expect(await client.bankAccount.findUnique({ where: { id: foreign.id } })).toEqual(foreign);
  });

  it.each(["CREATE_BANK_ACCOUNT", "UPDATE_BANK_ACCOUNT", "DELETE_BANK_ACCOUNT"])("rolls back every write on %s audit failure", async action => {
    const account = action === "CREATE_BANK_ACCOUNT" ? null : await rawAccount();
    fixture.failAudit = action;
    const response = action === "CREATE_BANK_ACCOUNT" ? await create()
      : action === "UPDATE_BANK_ACCOUNT" ? await update(account!.id, { name: "Changed", lastBalance: "100.01" }) : await remove(account!.id);
    expect(response.status).toBe(500);
    if (account) expect(await client.bankAccount.findUnique({ where: { id: account.id } })).toEqual(account);
    else expect(await client.bankAccount.count({ where: { orgId: fixture.orgId } })).toBe(0);
    expect(await client.auditLog.count({ where: { orgId: fixture.orgId } })).toBe(0);
  });

  it("preserves used identity and import history after a complete rollback", async () => {
    const account = await rawAccount();
    const imported = await upload(account.id);
    expect(imported.status).toBe(200);
    const { importBatchId } = await imported.json();
    expect((await update(account.id, { currency: "USD" })).status).toBe(409);
    expect((await remove(account.id)).status).toBe(409);
    const rolledBack = await rollbackBank(new NextRequest("http://localhost/api/import/bank/rollback", {
      method: "DELETE", body: JSON.stringify({ batchId: importBatchId }),
    }));
    expect(rolledBack.status).toBe(200);
    expect(await client.bankAccount.findUnique({ where: { id: account.id } })).toEqual(account);
    expect((await update(account.id, { accountNumber: otherNumber })).status).toBe(409);
    expect((await remove(account.id)).status).toBe(409);
    expect(await client.auditLog.count({ where: { orgId: fixture.orgId } })).toBe(2);
  });

  it("permits a descriptive rename of a used account without changing its amount", async () => {
    const account = await rawAccount();
    expect((await upload(account.id)).status).toBe(200);
    expect((await update(account.id, { name: "Renamed" })).status).toBe(200);
    const stored = await client.bankAccount.findUniqueOrThrow({ where: { id: account.id } });
    expect(stored.name).toBe("Renamed");
    expect(stored.lastBalance.toFixed(2)).toBe("0.10");
    expect(stored.accountNumber).toBe(ownNumber);
  });

  it("serializes import against a conflicting account-number update", async () => {
    const account = await rawAccount();
    const results = await Promise.all([upload(account.id), update(account.id, { accountNumber: otherNumber })]);
    expect([[200, 409], [422, 200]]).toContainEqual(results.map(response => response.status));
    const stored = await client.bankAccount.findUniqueOrThrow({ where: { id: account.id } });
    if (results[0].status === 200) {
      expect(stored.accountNumber).toBe(ownNumber);
      expect(stored.lastBalance.toFixed(2)).toBe("0.10");
    } else {
      expect(stored.accountNumber).toBe(otherNumber);
      expect(stored.lastBalance.toFixed(2)).toBe("0.00");
      expect(await client.stagedTransaction.count({ where: { orgId: fixture.orgId } })).toBe(0);
    }
  });

  it("serializes two deletes and retains one deletion audit", async () => {
    const account = await rawAccount();
    const results = await Promise.all([remove(account.id), remove(account.id)]);
    expect(results.map(response => response.status).sort()).toEqual([200, 404]);
    expect(await client.auditLog.count({ where: { orgId: fixture.orgId, action: "DELETE_BANK_ACCOUNT" } })).toBe(1);
  });

  it("prevents a new staged FK reference while deleting an empty account", async () => {
    const account = await rawAccount();
    const period = await client.period.create({ data: { orgId: fixture.orgId, year: 2026, month: 9 } });
    let checked = false;
    fixture.afterBankLock = async () => {
      await expect(client.$transaction(async database => {
        await database.$executeRaw`SET LOCAL lock_timeout = '500ms'`;
        await database.stagedTransaction.create({ data: {
          orgId: fixture.orgId, bankAccountId: account.id, periodId: period.id,
          date: new Date("2026-09-10T00:00:00Z"), amount: "1.00", direction: "CREDIT", description: "Synthetic concurrent", hash: randomUUID(),
        } });
      }, { maxWait: 1000, timeout: 3000 })).rejects.toThrow(/lock timeout/);
      checked = true;
    };
    expect((await remove(account.id)).status).toBe(200);
    expect(checked).toBe(true);
    expect(await client.stagedTransaction.count({ where: { orgId: fixture.orgId } })).toBe(0);
  });
});
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { normalizeBankAccountNumber } from "@/lib/bankStatementValidation";
import { POST } from "@/app/api/bank-accounts/route";
import { PUT } from "@/app/api/bank-accounts/[id]/route";

const fixture = vi.hoisted(() => ({
  client: null as PrismaClient | null,
  afterNumbersRead: null as null | (() => Promise<void>)
}));
vi.mock("@/lib/context", () => ({
  getActiveMembership: async () => ({ orgId: "own", userId: "synthetic", role: "OWNER" }),
  getActiveOrgId: async () => "own"
}));
vi.mock("@/lib/prisma", () => ({ default: {
  $transaction: (callback: (transaction: any) => Promise<unknown>, options: any) =>
    fixture.client!.$transaction(transaction => callback(new Proxy(transaction, {
      get(target, property) {
        if (property === "bankAccount") return new Proxy(target.bankAccount, {
          get(delegate, method) {
            if (method === "findMany") return async (args: any) => {
              const accounts = await delegate.findMany(args);
              const hook = fixture.afterNumbersRead;
              fixture.afterNumbersRead = null;
              if (hook) await hook();
              return accounts;
            };
            return Reflect.get(delegate, method);
          }
        });
        return Reflect.get(target, property);
      }
    })), options)
} }));

const databaseUrl = process.env.ACC_TEST_DATABASE_URL;
if (databaseUrl) {
  const parsed = new URL(databaseUrl);
  if (parsed.hostname !== "127.0.0.1" || parsed.pathname !== "/contador_safety_test") {
    throw new Error("ACC_TEST_DATABASE_URL must target the disposable loopback contador_safety_test database");
  }
}

describe.skipIf(!databaseUrl)("bank identity raw migration on isolated PostgreSQL tables", () => {
  let admin: PrismaClient;
  let client: PrismaClient;
  let schema: string;
  let schemaUrl: string;
  let publicColumns: unknown;
  const accountNumber = "00000000000000000001";
  const spacedNumber = "00000 00000 00000 00001";
  const columnState = () => admin.$queryRaw`
    SELECT attnotnull FROM pg_attribute
    WHERE attrelid = 'public."BankAccount"'::regclass AND attname = 'accountNumber'
  `;
  const migrate = () => execFileSync(process.execPath, [
    resolve("node_modules/prisma/build/index.js"), "db", "execute",
    "--url", schemaUrl, "--file", resolve("prisma/migrations/20260910_bank_account_identity.sql")
  ], {
    timeout: 20000, stdio: "pipe",
    env: { ...process.env, DATABASE_URL: schemaUrl, NODE_OPTIONS: "--max-old-space-size=256" }
  });
  const rows = () => client.bankAccount.findMany({ orderBy: { id: "asc" } });
  const identityObjects = () => client.$queryRaw`
    SELECT attribute.attnotnull,
      EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = attribute.attrelid
        AND conname = 'BankAccount_accountNumber_check') AS checked,
      EXISTS (SELECT 1 FROM pg_index index JOIN pg_class index_name ON index_name.oid = index.indexrelid
        WHERE index.indrelid = attribute.attrelid AND index_name.relname = 'BankAccount_orgId_normalizedAccountNumber_key'
        AND index.indisunique AND index.indisvalid) AS unique_index
    FROM pg_attribute attribute
    WHERE attribute.attrelid = '"BankAccount"'::regclass AND attribute.attname = 'accountNumber'
  `;

  beforeEach(async () => {
    admin = new PrismaClient({ datasourceUrl: databaseUrl });
    schema = `bank_identity_${randomUUID().replaceAll("-", "")}`;
    const url = new URL(databaseUrl!);
    url.searchParams.set("schema", schema);
    schemaUrl = url.toString();
    publicColumns = await columnState();
    await admin.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
    await admin.$executeRawUnsafe(`CREATE TABLE "${schema}"."BankAccount" (LIKE public."BankAccount" INCLUDING ALL)`);
    await admin.$executeRawUnsafe(`CREATE TABLE "${schema}"."StagedTransaction" (LIKE public."StagedTransaction" INCLUDING ALL)`);
    await admin.$executeRawUnsafe(`CREATE TABLE "${schema}"."AuditLog" (LIKE public."AuditLog" INCLUDING ALL)`);
    client = new PrismaClient({ datasourceUrl: schemaUrl });
    fixture.client = client;
    fixture.afterNumbersRead = null;
  });

  afterEach(async () => {
    try {
      expect(await columnState()).toEqual(publicColumns);
    } finally {
      await client?.$disconnect();
      await admin.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await admin.$disconnect();
    }
  });

  it("reapplies without rewriting legacy formatting or balances and enforces subsequent writes", async () => {
    await client.bankAccount.createMany({ data: [
      { orgId: "own", name: "Original", accountNumber: spacedNumber, lastBalance: "9007199254740993.27" },
      { orgId: "foreign", name: "Other organization", accountNumber, lastBalance: "-0.01" }
    ] });
    const before = await rows();
    for (const attempt of [1, 2]) {
      migrate();
      expect(await rows(), `attempt ${attempt}`).toEqual(before);
      expect(await identityObjects()).toEqual([{ attnotnull: true, checked: true, unique_index: true }]);
    }
    await expect(client.bankAccount.create({ data: { orgId: "own", name: "Duplicate", accountNumber } })).rejects.toMatchObject({ code: "P2002" });
    await expect(client.bankAccount.create({ data: { orgId: "own", name: "Missing", accountNumber: null } })).rejects.toThrow();
    await expect(client.bankAccount.updateMany({ where: { orgId: "foreign" }, data: { orgId: "own" } })).rejects.toThrow();
    await expect(client.bankAccount.updateMany({ where: { orgId: "own" }, data: { accountNumber: "invalid" } })).rejects.toThrow();
    await client.bankAccount.updateMany({ where: { orgId: "own" }, data: { name: "Renamed" } });
    expect((await client.bankAccount.findFirstOrThrow({ where: { orgId: "own" } })).accountNumber).toBe(spacedNumber);
  }, 45000);

  it.each([
    { label: "null", numbers: [null] },
    { label: "empty", numbers: [""] },
    { label: "short", numbers: ["123"] },
    { label: "non-ASCII digits", numbers: ["\uff11".repeat(20)] },
    { label: "normalized duplicates", numbers: [accountNumber, spacedNumber] }
  ])("refuses $label without partial DDL or data changes", async ({ numbers }) => {
    await client.bankAccount.createMany({ data: numbers.map(number => ({
      orgId: "own", name: "Legacy", accountNumber: number, lastBalance: "12.34"
    })) });
    const before = await rows();
    expect(migrate).toThrow(/Bank account number preflight failed/);
    expect(await rows()).toEqual(before);
    expect(await identityObjects()).toEqual([{ attnotnull: false, checked: false, unique_index: false }]);
  }, 25000);

  it("matches ECMAScript whitespace normalization without broadening valid digits", async () => {
    migrate();
    const whitespace = [0x9, 0xa, 0xb, 0xc, 0xd, 0x20, 0xa0, 0x1680,
      0x2000, 0x2001, 0x2002, 0x2003, 0x2004, 0x2005, 0x2006, 0x2007,
      0x2008, 0x2009, 0x200a, 0x2028, 0x2029, 0x202f, 0x205f, 0x3000, 0xfeff];
    for (const point of whitespace) {
      const orgId = `whitespace-${point}`;
      const formatted = `${accountNumber.slice(0, 10)}${String.fromCodePoint(point)}${accountNumber.slice(10)}`;
      expect(normalizeBankAccountNumber(formatted)).toBe(accountNumber);
      await client.bankAccount.create({ data: { orgId, name: "Formatted", accountNumber: formatted } });
      await expect(client.bankAccount.create({ data: { orgId, name: "Duplicate", accountNumber } })).rejects.toThrow();
    }
    for (const invalid of ["\u0085", "\u180e", "\u200b", "\uff11", "-", "."]) {
      const formatted = `${accountNumber.slice(0, 10)}${invalid}${accountNumber.slice(10)}`;
      expect(normalizeBankAccountNumber(formatted)).toBeNull();
      await expect(client.bankAccount.create({ data: {
        orgId: "invalid", name: "Invalid", accountNumber: formatted
      } })).rejects.toThrow();
    }
  }, 25000);

  it("serializes conflicting direct inserts without API advisory locks", async () => {
    migrate();
    const results = await Promise.allSettled([accountNumber, spacedNumber].map(number =>
      client.bankAccount.create({ data: { orgId: "own", name: "Concurrent", accountNumber: number } })
    ));
    expect(results.map(result => result.status).sort()).toEqual(["fulfilled", "rejected"]);
    expect(await client.bankAccount.count()).toBe(1);
  }, 25000);

  it("times out on a busy table and leaves its data and constraints unchanged", async () => {
    await client.bankAccount.create({ data: { orgId: "own", name: "Busy", accountNumber } });
    const before = await rows();
    await client.$transaction(async transaction => {
      await transaction.$queryRaw`SELECT id FROM "BankAccount" FOR UPDATE`;
      expect(migrate).toThrow(/lock timeout/);
    }, { maxWait: 5000, timeout: 10000 });
    expect(await rows()).toEqual(before);
    expect(await identityObjects()).toEqual([{ attnotnull: false, checked: false, unique_index: false }]);
  }, 25000);

  it.each(["create", "update"])("returns API conflict on concurrent direct %s collision without changing the original or audit", async operation => {
    migrate();
    const original = await client.bankAccount.create({ data: {
      orgId: "own", name: "Original", accountNumber: "00000000000000000002", lastBalance: "12.34"
    } });
    fixture.afterNumbersRead = async () => {
      await client.bankAccount.create({ data: { orgId: "own", name: "Concurrent writer", accountNumber: spacedNumber } });
    };
    const request = new NextRequest("http://localhost/api/bank-accounts", {
      method: operation === "create" ? "POST" : "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Requested", accountNumber })
    });
    const response = operation === "create" ? await POST(request) : await PUT(request, { params: Promise.resolve({ id: original.id }) });
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: "BANK_ACCOUNT_DUPLICATE" });
    expect(await client.bankAccount.findUniqueOrThrow({ where: { id: original.id } })).toEqual(original);
    expect(await client.bankAccount.count()).toBe(2);
    expect(await client.auditLog.count()).toBe(0);
  }, 25000);
});
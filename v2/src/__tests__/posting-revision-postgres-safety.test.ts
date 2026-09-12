import { randomUUID } from "node:crypto";
import { PrismaClient, type Prisma } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { postDocument, repostDocument, voidDocument } from "@/lib/posting/postingEngine";
import { assertPostingRevisionState } from "@/lib/posting/postingRevision";

const { syncCalendar } = vi.hoisted(() => ({ syncCalendar: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ default: {} }));
vi.mock("@/lib/closing", () => ({ upsertTaxCalendarEventsForPeriod: syncCalendar }));

const databaseUrl = process.env.ACC_TEST_DATABASE_URL;
if (databaseUrl) {
  const parsed = new URL(databaseUrl);
  if (parsed.hostname !== "127.0.0.1" || parsed.pathname !== "/contador_safety_test") {
    throw new Error("ACC_TEST_DATABASE_URL must target the disposable loopback contador_safety_test database");
  }
}

describe.skipIf(!databaseUrl)("posting revision archive on disposable PostgreSQL", () => {
  const client = new PrismaClient({ datasourceUrl: databaseUrl });
  const suffix = randomUUID();
  const orgId = `revision-org-${suffix}`;
  const periodId = `revision-period-${suffix}`;
  const typeId = `revision-type-${suffix}`;
  const debitCode = `revision-debit-${suffix}`;
  const creditCode = `revision-credit-${suffix}`;
  const template = {
    lines: [
      { accountCode: debitCode, side: "debit", expression: "amount" },
      { accountCode: creditCode, side: "credit", expression: "amount" },
    ],
  };
  const makeDocument = (amount = "9007199254740993.27") => client.document.create({ data: {
    orgId, periodId, typeId, date: new Date("2026-09-11T00:00:00Z"), payload: { amount },
  } });
  const revisions = (documentId: string) => client.postingRevision.findMany({
    where: { orgId, documentId }, orderBy: { revision: "asc" },
  });
  const ledger = (documentId: string) => client.journalEntry.findMany({
    where: { documentId }, orderBy: { id: "asc" },
  });

  beforeAll(async () => {
    await client.organization.create({ data: { id: orgId, name: "Synthetic revision archive" } });
    await client.period.create({ data: { id: periodId, orgId, year: 2026, month: 9 } });
    await client.account.createMany({ data: [
      { code: debitCode, name: "Synthetic debit", type: "ASSET" },
      { code: creditCode, name: "Synthetic credit", type: "LIABILITY" },
    ] });
    await client.documentType.create({ data: { id: typeId, code: typeId, name: "Synthetic revision", postingTemplate: template } });
  });

  beforeEach(async () => {
    syncCalendar.mockReset().mockResolvedValue(undefined);
    await client.documentType.update({ where: { id: typeId }, data: { postingTemplate: template } });
  });

  afterAll(async () => {
    try {
      await client.organization.deleteMany({ where: { id: orgId } });
      await client.documentType.deleteMany({ where: { id: typeId } });
      await client.account.deleteMany({ where: { code: { in: [debitCode, creditCode] } } });
    } finally {
      await client.$disconnect();
    }
  });

  it("retains exact rows, payload and the used template after rule changes, void and repost", async () => {
    const document = await makeDocument();
    await postDocument(document.id, client, "posting-actor");
    const original = (await revisions(document.id))[0];
    expect(original.action).toBe("POST");
    expect(original.createdBy).toBe("posting-actor");
    expect(original.snapshot).toMatchObject({
      document: { payload: { amount: "9007199254740993.27" } },
      observedType: { postingTemplate: template },
      ruleProvenance: "USED_FOR_POSTING",
      calculationContext: { engineVersion: "posting-v1", isVatPayer: false },
      journalEntries: expect.arrayContaining([
        expect.objectContaining({ debit: "9007199254740993.27", credit: "0.00", accountCode: debitCode }),
        expect.objectContaining({ credit: "9007199254740993.27", debit: "0.00", accountCode: creditCode }),
      ]),
    });
    const changedTemplate = { lines: template.lines.map(line => ({ ...line, expression: "amount - 0.01" })) };
    await client.documentType.update({ where: { id: typeId }, data: { postingTemplate: changedTemplate } });
    await repostDocument(document.id, typeId, client, "reposting-actor");
    const history = await revisions(document.id);
    expect(history.map(row => [row.revision, row.action, row.previousId])).toEqual([
      [1, "POST", null], [2, "VOID", original.id], [3, "POST", history[1].id],
    ]);
    expect(history[0]).toEqual(original);
    expect(history[1].snapshot).toMatchObject({
      ruleProvenance: "OBSERVED_AT_VOID", calculationContext: null,
      journalEntries: (original.snapshot as Prisma.JsonObject).journalEntries,
    });
    expect(history[2].snapshot).toMatchObject({ observedType: { postingTemplate: changedTemplate } });
    expect((await ledger(document.id)).find(row => row.debit.gt(0))?.debit.toString()).toBe("9007199254740993.26");
    await voidDocument(document.id, client, "void-actor");
    await voidDocument(document.id, client, "void-actor");
    expect(await revisions(document.id)).toHaveLength(4);
    expect(await ledger(document.id)).toEqual([]);
    expect((await revisions(document.id))[0]).toEqual(original);
  });

  it("preserves legacy entries at first void without claiming the original template is known", async () => {
    const document = await makeDocument("12.34");
    const account = await client.account.findUniqueOrThrow({ where: { code: debitCode } });
    await client.journalEntry.create({ data: {
      documentId: document.id, accountId: account.id, debit: "12.34", credit: "0", date: document.date,
    } });
    await voidDocument(document.id, client);
    expect((await revisions(document.id))[0].snapshot).toMatchObject({
      ruleProvenance: "OBSERVED_AT_VOID", calculationContext: null,
      journalEntries: [expect.objectContaining({ debit: "12.34" })],
    });
  });

  it("records a debt and its settlement before cancellation changes their links", async () => {
    const opening = await makeDocument("100.00");
    const payment = await makeDocument("100.00");
    const account = await client.account.findUniqueOrThrow({ where: { code: debitCode } });
    const item = await client.openItem.create({ data: {
      orgId, openingDocumentId: opening.id, closingDocumentId: payment.id, accountId: account.id,
      amount: "100.00", status: "CLOSED", dateOpened: opening.date, dateClosed: payment.date,
    } });
    await voidDocument(payment.id, client);
    expect((await revisions(payment.id))[0].snapshot).toMatchObject({
      openItems: [expect.objectContaining({ id: item.id, amount: "100.00", closingDocumentId: payment.id, status: "CLOSED" })],
    });
    expect((await client.openItem.findUniqueOrThrow({ where: { id: item.id } })).closingDocumentId).toBeNull();
    await voidDocument(opening.id, client);
    expect((await revisions(opening.id))[0].snapshot).toMatchObject({
      openItems: [expect.objectContaining({ id: item.id, status: "OPEN", closingDocumentId: null })],
    });
  });

  it.each(["post", "void", "repost"])("rolls back all %s writes if the archive fails", async operation => {
    const document = await makeDocument("100.00");
    if (operation !== "post") await postDocument(document.id, client);
    const beforeRows = await ledger(document.id);
    const beforeHistory = await revisions(document.id);
    const beforeDocument = await client.document.findUniqueOrThrow({ where: { id: document.id } });
    let archiveWrites = 0;
    const failingClient = {
      $transaction: (callback: (transaction: Prisma.TransactionClient) => Promise<unknown>) => client.$transaction(transaction => callback(new Proxy(transaction, {
        get(target, property) {
          if (property === "$executeRaw") return (...args: Parameters<typeof target.$executeRaw>) => {
            archiveWrites += 1;
            if (operation !== "repost" || archiveWrites === 2) throw new Error("injected archive failure");
            return target.$executeRaw(...args);
          };
          return Reflect.get(target, property);
        },
      }))),
    };
    const result = operation === "post" ? postDocument(document.id, failingClient)
      : operation === "void" ? voidDocument(document.id, failingClient) : repostDocument(document.id, typeId, failingClient);
    await expect(result).rejects.toThrow("injected archive failure");
    expect(await ledger(document.id)).toEqual(beforeRows);
    expect(await revisions(document.id)).toEqual(beforeHistory);
    expect(await client.document.findUniqueOrThrow({ where: { id: document.id } })).toEqual(beforeDocument);
  });

  it("rolls back snapshots as well as entries when calendar fails after an archive insert", async () => {
    const document = await makeDocument("100.00");
    syncCalendar.mockRejectedValueOnce(new Error("calendar failed"));
    await expect(postDocument(document.id, client)).rejects.toThrow("calendar failed");
    expect(await revisions(document.id)).toEqual([]);
    await postDocument(document.id, client);
    const original = await revisions(document.id);
    syncCalendar.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("calendar failed"));
    await expect(repostDocument(document.id, typeId, client)).rejects.toThrow("calendar failed");
    expect(await revisions(document.id)).toEqual(original);
  });

  it("serializes concurrent reposts into a consecutive chain", async () => {
    const document = await makeDocument("100.00");
    await postDocument(document.id, client);
    await Promise.all([repostDocument(document.id, typeId, client), repostDocument(document.id, typeId, client)]);
    const history = await revisions(document.id);
    expect(history.map(row => row.action)).toEqual(["POST", "VOID", "POST", "VOID", "POST"]);
    history.forEach((row, index) => {
      expect(row.revision).toBe(index + 1);
      expect(row.previousId).toBe(index ? history[index - 1].id : null);
    });
    expect(await ledger(document.id)).toHaveLength(2);
  });

  it.each(["UPDATE", "DELETE", "TRUNCATE"])("rejects SQL %s of archived history", async action => {
    const document = await makeDocument("100.00");
    await postDocument(document.id, client);
    const original = await revisions(document.id);
    const mutation = action === "UPDATE"
      ? client.$executeRaw`UPDATE "PostingRevision" SET "createdBy" = 'changed' WHERE "documentId" = ${document.id}`
      : action === "DELETE" ? client.$executeRaw`DELETE FROM "PostingRevision" WHERE "documentId" = ${document.id}`
        : client.$executeRaw`TRUNCATE "PostingRevision"`;
    await expect(mutation).rejects.toThrow(/append-only/);
    expect(await revisions(document.id)).toEqual(original);
  });

  describe.each(["void", "repost"] as const)("active ledger guard before %s", operation => {
    it.each(["amount", "delete-one", "delete-all", "extra", "account", "date", "analytics", "status"])(
      "refuses %s drift without changing existing evidence", async mutation => {
        const document = await makeDocument();
        await postDocument(document.id, client);
        const entries = await ledger(document.id);
        const entry = entries[0];
        if (mutation === "amount") await client.$executeRaw`
          UPDATE "JournalEntry" SET
            "debit" = CASE WHEN "debit" > 0 THEN "debit" + 0.01 ELSE "debit" END,
            "credit" = CASE WHEN "credit" > 0 THEN "credit" + 0.01 ELSE "credit" END
          WHERE "documentId" = ${document.id}`;
        if (mutation === "delete-one") await client.journalEntry.delete({ where: { id: entry.id } });
        if (mutation === "delete-all") await client.journalEntry.deleteMany({ where: { documentId: document.id } });
        if (mutation === "extra") await client.journalEntry.create({ data: { ...entry, id: randomUUID() } });
        if (mutation === "account") await client.journalEntry.update({ where: { id: entry.id }, data: { accountId: entries[1].accountId } });
        if (mutation === "date") await client.journalEntry.update({ where: { id: entry.id }, data: { date: new Date("2026-09-12T00:00:00Z") } });
        if (mutation === "analytics") await client.journalEntry.update({ where: { id: entry.id }, data: { contractId: "unexpected-contract" } });
        if (mutation === "status") await client.document.update({ where: { id: document.id }, data: { status: "VOIDED" } });

        const beforeRows = await ledger(document.id);
        const beforeHistory = await revisions(document.id);
        const beforeDocument = await client.document.findUniqueOrThrow({ where: { id: document.id } });
        const auditWhere = { orgId, entityId: document.id };
        const beforeAudit = await client.auditLog.count({ where: auditWhere });
        syncCalendar.mockClear();
        await expect(operation === "void" ? voidDocument(document.id, client) : repostDocument(document.id, typeId, client))
          .rejects.toThrow(/accounting review/);
        expect(await ledger(document.id)).toEqual(beforeRows);
        expect(await revisions(document.id)).toEqual(beforeHistory);
        expect(await client.document.findUniqueOrThrow({ where: { id: document.id } })).toEqual(beforeDocument);
        expect(await client.auditLog.count({ where: auditWhere })).toBe(beforeAudit);
        expect(syncCalendar).not.toHaveBeenCalled();
      },
    );
  });

  it("does not create another POST when all active journal rows disappeared", async () => {
    const document = await makeDocument();
    await postDocument(document.id, client);
    const original = await revisions(document.id);
    await client.journalEntry.deleteMany({ where: { documentId: document.id } });
    await expect(postDocument(document.id, client)).rejects.toThrow(/accounting review/);
    expect(await ledger(document.id)).toEqual([]);
    expect(await revisions(document.id)).toEqual(original);
  });

  it.each(["status", "entries"])("does not silently repeat VOID with inconsistent %s", async mutation => {
    const document = await makeDocument();
    await postDocument(document.id, client);
    const [entry] = await ledger(document.id);
    await voidDocument(document.id, client);
    if (mutation === "status") await client.document.update({ where: { id: document.id }, data: { status: "POSTED" } });
    else await client.journalEntry.create({ data: entry });
    const original = await revisions(document.id);
    const beforeRows = await ledger(document.id);
    await expect(voidDocument(document.id, client)).rejects.toThrow(/accounting review/);
    await expect(repostDocument(document.id, typeId, client)).rejects.toThrow(/accounting review/);
    expect(await revisions(document.id)).toEqual(original);
    expect(await ledger(document.id)).toEqual(beforeRows);
  });

  it("holds row and parent locks while validating the current version", async () => {
    const document = await makeDocument();
    await postDocument(document.id, client);
    const [entry] = await ledger(document.id);
    await client.$transaction(async transaction => {
      await transaction.$queryRaw`SELECT "id" FROM "Document" WHERE "id" = ${document.id} FOR UPDATE`;
      await assertPostingRevisionState(transaction, document, "VOID");
      for (const mutation of ["update", "delete", "insert"]) {
        await expect(client.$transaction(async competing => {
          await competing.$executeRaw`SET LOCAL lock_timeout = '300ms'`;
          if (mutation === "update") return competing.journalEntry.update({ where: { id: entry.id }, data: { contractId: "racing-change" } });
          if (mutation === "delete") return competing.journalEntry.delete({ where: { id: entry.id } });
          return competing.journalEntry.create({ data: { ...entry, id: randomUUID() } });
        })).rejects.toThrow(/lock timeout/);
      }
    });
    expect(await ledger(document.id)).toHaveLength(2);
    await voidDocument(document.id, client);
  });

  it("allows normal debt settlement changes without treating OpenItem status as ledger drift", async () => {
    await client.documentType.update({ where: { id: typeId }, data: {
      postingTemplate: { ...template, opensItem: true, itemAccountCode: debitCode },
    } });
    const opening = await makeDocument("100.00");
    await postDocument(opening.id, client);
    const item = await client.openItem.findFirstOrThrow({ where: { openingDocumentId: opening.id } });
    const original = (await revisions(opening.id))[0];
    await client.documentType.update({ where: { id: typeId }, data: { postingTemplate: template } });
    const payment = await makeDocument("100.00");
    await client.openItem.update({ where: { id: item.id }, data: {
      status: "CLOSED", closingDocumentId: payment.id, dateClosed: payment.date,
    } });
    await postDocument(payment.id, client);
    await expect(voidDocument(opening.id, client)).rejects.toThrow(/сначала отмените/);
    await voidDocument(payment.id, client);
    await voidDocument(opening.id, client);
    expect((await revisions(opening.id))[0]).toEqual(original);
    expect((await revisions(opening.id)).map(row => row.action)).toEqual(["POST", "VOID"]);
  });

  it.each(["tenant", "period", "sequence", "previous", "hash", "snapshot"])("rejects forged %s on INSERT", async field => {
    const document = await makeDocument("100.00");
    await postDocument(document.id, client);
    const original = (await revisions(document.id))[0];
    const forged = {
      ...original, id: randomUUID(), revision: original.revision + 1, previousId: original.id,
      snapshot: original.snapshot as Prisma.InputJsonValue,
    };
    if (field === "tenant") forged.orgId = "foreign-org";
    if (field === "period") forged.periodId = "foreign-period";
    if (field === "sequence") forged.revision += 1;
    if (field === "previous") forged.previousId = "foreign-revision";
    if (field === "hash") forged.snapshotHash = "0".repeat(64);
    if (field === "snapshot") forged.snapshot = {};
    await expect(client.postingRevision.create({ data: forged })).rejects.toThrow();
    expect(await revisions(document.id)).toEqual([original]);
  });

  it("retains the archive after deleting its source organization", async () => {
    const sourceOrg = await client.organization.create({ data: { name: "Synthetic removable organization" } });
    try {
      const sourcePeriod = await client.period.create({ data: { orgId: sourceOrg.id, year: 2026, month: 9 } });
      const document = await client.document.create({ data: {
        orgId: sourceOrg.id, periodId: sourcePeriod.id, typeId,
        date: new Date("2026-09-11T00:00:00Z"), payload: { amount: "100.00" },
      } });
      await postDocument(document.id, client);
      const where = { orgId: sourceOrg.id, documentId: document.id };
      const original = await client.postingRevision.findMany({ where });
      expect(original).toHaveLength(1);
      await client.organization.delete({ where: { id: sourceOrg.id } });
      expect(await client.postingRevision.findMany({ where })).toEqual(original);
    } finally {
      await client.organization.deleteMany({ where: { id: sourceOrg.id } });
    }
  });

  it("retains archived identity after live document deletion without cascade", async () => {
    const document = await makeDocument("100.00");
    await postDocument(document.id, client);
    await voidDocument(document.id, client);
    const original = await revisions(document.id);
    await client.document.delete({ where: { id: document.id } });
    expect(await revisions(document.id)).toEqual(original);
    await expect(client.postingRevision.create({ data: {
      ...original[1], id: randomUUID(), revision: 3, previousId: original[1].id,
      snapshot: original[1].snapshot as Prisma.InputJsonValue,
    } })).rejects.toThrow(/live document/);
  });
});
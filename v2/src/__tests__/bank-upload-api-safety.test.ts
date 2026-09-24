import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/import/bank/route";
import { BANK_UPLOAD_MAX_BODY_BYTES, BANK_UPLOAD_MAX_FILE_BYTES, BANK_UPLOAD_TIMEOUT_MS } from "@/lib/bankUpload";
import { BANK_STATEMENT_MAX_LINES, BANK_STATEMENT_MAX_TRANSACTIONS } from "@/lib/parsers/parser1c";

const mocks = vi.hoisted(() => ({ membership: vi.fn(), findBank: vi.fn(), transaction: vi.fn() }));
vi.mock("@/lib/context", () => ({ getActiveMembership: mocks.membership }));
vi.mock("@/lib/prisma", () => ({ default: { bankAccount: { findFirst: mocks.findBank }, $transaction: mocks.transaction } }));

const accountNumber = "00000000000000000001";
const statement = [
  "1CClientBankExchange", `РасчСчет=${accountNumber}`, "СекцияРасчСчет",
  `РасчСчет=${accountNumber}`, "ДатаНачала=01.09.2026", "ДатаКонца=30.09.2026",
  "НачальныйОстаток=0.00", "КонечныйОстаток=0.10", "КонецРасчСчет",
  "СекцияДокумент=Платежное поручение", "Дата=10.09.2026", "Сумма=0.10",
  "ПлательщикРасчСчет=00000000000000000002", `ПолучательРасчСчет=${accountNumber}`,
  "НазначениеПлатежа=Synthetic", "КонецДокумента", "КонецФайла",
].join("\n");

function upload(file: File, preview = false, extra?: string, confirmedCurrency: string | null = "UZS") {
  const form = new FormData();
  form.set("file", file);
  form.set("bankAccountId", "bank-1");
  if (confirmedCurrency !== null) form.set("confirmedCurrency", confirmedCurrency);
  if (extra) form.set("extra", extra);
  return new NextRequest(`http://localhost/api/import/bank${preview ? "?preview=true" : ""}`, { method: "POST", body: form });
}

function streamed(stream: ReadableStream<Uint8Array>, preview = false, signal?: AbortSignal) {
  return new NextRequest(new Request(`http://localhost/api/import/bank${preview ? "?preview=true" : ""}`, {
    method: "POST", body: stream, duplex: "half", signal,
    headers: { "content-type": "multipart/form-data; boundary=bank", "content-length": "1" },
  } as RequestInit));
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.membership.mockResolvedValue({ orgId: "own", userId: "actor", role: "OWNER" });
  mocks.findBank.mockResolvedValue({ id: "bank-1", orgId: "own", accountNumber, currency: "UZS" });
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe("bank upload API resource limits", () => {
  it("requires explicit currency confirmation for a source without currency", async () => {
    const response = await POST(upload(new File([statement], "bank.txt"), false, undefined, null));
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ code: "BANK_CURRENCY_CONFIRMATION_REQUIRED" });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it.each([false, true])("rejects a conflicting source currency before writes, preview=%s", async preview => {
    const response = await POST(upload(new File([statement.replace("КонецРасчСчет", "Валюта=USD\nКонецРасчСчет")], "bank.txt"), preview));
    expect(response.status).toBe(422);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("allows preview without confirmation and exposes missing currency", async () => {
    const response = await POST(upload(new File([statement], "bank.txt"), true, undefined, null));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ currency: null, bankCurrency: "UZS", requiresCurrencyConfirmation: true });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("rechecks currency under the account lock", async () => {
    mocks.transaction.mockImplementation(callback => callback({
      $queryRaw: async () => [{ lastBalance: "0.00", lastSyncedAt: null, currency: "USD", accountNumber }],
    }));
    const response = await POST(upload(new File([statement], "bank.txt")));
    expect(response.status).toBe(422);
  });

  it.each([false, true])("persists the original source atomically, archive failure=%s", async failArchive => {
    const archive = vi.fn(async () => {
      if (failArchive) throw new Error("archive unavailable");
    });
    let committed = false;
    const audit = vi.fn();
    mocks.transaction.mockImplementation(async callback => {
      const result = await callback({
        $queryRaw: async () => [{ lastBalance: "0.00", lastSyncedAt: null, currency: "UZS", accountNumber }],
        period: { upsert: async () => ({ id: "period" }), findUniqueOrThrow: async () => ({ status: "OPEN", lockDate: null }) },
        stagedTransaction: { findUnique: async () => null, createMany: async () => ({ count: 1 }), findMany: async () => [] },
        bankAccount: { update: vi.fn() }, bankImportBatch: { create: archive, findMany: async () => [] }, auditLog: { create: audit },
      });
      committed = true;
      return result;
    });
    vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await POST(upload(new File([statement], "bank.txt")));
    expect(response.status).toBe(failArchive ? 500 : 200);
    expect(committed).toBe(!failArchive);
    expect(archive).toHaveBeenCalledWith({ data: expect.objectContaining({
      sourceData: Buffer.from(statement), sourceName: "bank.txt", parserVersion: "1c-bank-v2",
      rows: [expect.objectContaining({ amount: "0.10" })],
      result: expect.objectContaining({ newValue: expect.objectContaining({ bankBatchVersion: 1, rollbackVersion: 2, currencyEvidence: "USER_CONFIRMED", confirmedCurrency: "UZS" }) }),
    }) });
    expect(audit).toHaveBeenCalledTimes(failArchive ? 0 : 1);
  });

  it.each([false, true])("preserves real parsing and preview for a file at the limit: %s", async atLimit => {
    const source = atLimit
      ? Buffer.concat([Buffer.from(statement + "\n"), Buffer.alloc(BANK_UPLOAD_MAX_FILE_BYTES - Buffer.byteLength(statement) - 1, 32)])
      : statement;
    const request = upload(new File([source], "bank.txt"), true);
    const unboundedParser = vi.spyOn(request, "formData");
    const response = await POST(request);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ total: 1, transactions: [{ amount: "0.10", direction: "CREDIT" }] });
    expect(unboundedParser).not.toHaveBeenCalled();
    expect(mocks.findBank).toHaveBeenCalledWith({ where: { id: "bank-1", orgId: "own" } });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it.each([false, true])("rejects extra fields exceeding the body limit before DB access, preview=%s", async preview => {
    const response = await POST(upload(new File([statement], "bank.txt"), preview, "x".repeat(BANK_UPLOAD_MAX_BODY_BYTES)));
    expect(response.status).toBe(413);
    expect(await response.json()).toMatchObject({ code: "BANK_UPLOAD_TOO_LARGE" });
    expect(mocks.findBank).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it.each([0, BANK_UPLOAD_MAX_FILE_BYTES + 1])("retains the separate file limit for %s bytes", async size => {
    const response = await POST(upload(new File([new Uint8Array(size)], "bank.txt")));
    expect(response.status).toBe(size === 0 ? 400 : 413);
    expect(mocks.findBank).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it.each([false, true])("times out a stalled request without writes, preview=%s", async preview => {
    vi.useFakeTimers();
    const cancel = vi.fn(() => new Promise<void>(() => {}));
    const stream = new ReadableStream<Uint8Array>({ cancel });
    const pending = POST(streamed(stream, preview));
    await vi.advanceTimersByTimeAsync(BANK_UPLOAD_TIMEOUT_MS);
    const response = await pending;
    expect(response.status).toBe(408);
    expect(await response.json()).toMatchObject({ code: "BANK_UPLOAD_TIMEOUT" });
    expect(cancel).toHaveBeenCalledOnce();
    expect(mocks.findBank).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("returns a controlled response for malformed multipart without writes", async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) { controller.enqueue(new TextEncoder().encode("broken")); controller.close(); },
    });
    const response = await POST(streamed(stream));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: "BANK_UPLOAD_INVALID" });
    expect(mocks.findBank).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("checks permissions before consuming multipart", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.membership.mockResolvedValue({ orgId: "own", userId: "actor", role: "VIEWER" });
    const request = upload(new File([statement], "bank.txt"));
    expect((await POST(request)).status).toBe(403);
    expect(request.bodyUsed).toBe(false);
    expect(mocks.findBank).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it.each([false, true])("rejects excessive operation count before writes, preview=%s", async preview => {
    const start = statement.indexOf("СекцияДокумент=");
    const document = statement.slice(start, statement.indexOf("КонецФайла"));
    const text = statement.slice(0, start).replace("КонечныйОстаток=0.10", "КонечныйОстаток=100.10") +
      document.repeat(BANK_STATEMENT_MAX_TRANSACTIONS + 1) + "КонецФайла";
    const response = await POST(upload(new File([text], "bank.txt"), preview));
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ code: "BANK_STATEMENT_INVALID", error: expect.stringContaining("1000 операций") });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("rejects excessive text lines before writes", async () => {
    const response = await POST(upload(new File([statement + "\n".repeat(BANK_STATEMENT_MAX_LINES)], "bank.txt")));
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ code: "BANK_STATEMENT_INVALID", error: expect.stringContaining("50000 текстовых строк") });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("rejects a disconnected client without writes", async () => {
    const controller = new AbortController();
    const cancel = vi.fn();
    const request = streamed(new ReadableStream<Uint8Array>({ cancel }), false, controller.signal);
    const pending = POST(request);
    controller.abort();
    const response = await pending;
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: "BANK_UPLOAD_ABORTED" });
    expect(cancel).toHaveBeenCalledOnce();
    expect(mocks.findBank).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
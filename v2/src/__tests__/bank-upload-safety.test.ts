import { afterEach, describe, expect, it, vi } from "vitest";
import {
  BANK_UPLOAD_MAX_BODY_BYTES, BANK_UPLOAD_TIMEOUT_MS, readBankUpload,
} from "@/lib/bankUpload";

const multipartRequest = () => {
  const form = new FormData();
  form.set("file", new File(["synthetic statement"], "bank.txt"));
  form.set("bankAccountId", "bank-1");
  return new Request("http://localhost/api/import/bank", { method: "POST", body: form });
};

function streamRequest(stream: ReadableStream<Uint8Array>, headers: Record<string, string> = {}, signal?: AbortSignal) {
  return new Request("http://localhost/api/import/bank", {
    method: "POST", body: stream, duplex: "half", signal,
    headers: { "content-type": "multipart/form-data; boundary=bank", ...headers },
  } as RequestInit);
}

afterEach(() => vi.useRealTimers());

describe("bounded bank multipart reader", () => {
  it("parses a real multipart upload without Content-Length", async () => {
    const result = await readBankUpload(multipartRequest());
    expect(result.get("bankAccountId")).toBe("bank-1");
    expect(await (result.get("file") as File).text()).toBe("synthetic statement");
  });

  it.each([undefined, "1"])("counts actual streamed bytes with Content-Length %s", async contentLength => {
    const cancel = vi.fn();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(BANK_UPLOAD_MAX_BODY_BYTES));
        controller.enqueue(Uint8Array.of(1));
      }, cancel,
    });
    const request = streamRequest(stream, contentLength ? { "content-length": contentLength } : {});
    await expect(readBankUpload(request)).rejects.toMatchObject({ status: 413, code: "BANK_UPLOAD_TOO_LARGE" });
    expect(cancel).toHaveBeenCalledOnce();
    expect(stream.locked).toBe(false);
  });

  it("rejects an oversized declared length without reading the stream", async () => {
    const pull = vi.fn();
    const cancel = vi.fn();
    const stream = new ReadableStream<Uint8Array>({ pull, cancel }, { highWaterMark: 0 });
    await expect(readBankUpload(streamRequest(stream, {
      "content-length": String(BANK_UPLOAD_MAX_BODY_BYTES + 1),
    }))).rejects.toMatchObject({ status: 413 });
    expect(pull).not.toHaveBeenCalled();
    expect(cancel).toHaveBeenCalledOnce();
  });

  it("counts additional multipart fields toward the body limit", async () => {
    const form = new FormData();
    form.set("file", new File(["small"], "bank.txt"));
    form.set("extra", "x".repeat(BANK_UPLOAD_MAX_BODY_BYTES));
    await expect(readBankUpload(new Request("http://localhost", { method: "POST", body: form })))
      .rejects.toMatchObject({ status: 413 });
  });

  it("rejects malformed multipart data", async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) { controller.enqueue(new TextEncoder().encode("broken")); controller.close(); },
    });
    await expect(readBankUpload(streamRequest(stream))).rejects.toMatchObject({ status: 400, code: "BANK_UPLOAD_INVALID" });
  });

  it("times out a stalled stream even when cancellation never settles", async () => {
    vi.useFakeTimers();
    const cancel = vi.fn(() => new Promise<void>(() => {}));
    const stream = new ReadableStream<Uint8Array>({ cancel });
    const result = readBankUpload(streamRequest(stream));
    const assertion = expect(result).rejects.toMatchObject({ status: 408, code: "BANK_UPLOAD_TIMEOUT" });
    await vi.advanceTimersByTimeAsync(BANK_UPLOAD_TIMEOUT_MS);
    await assertion;
    expect(cancel).toHaveBeenCalledOnce();
    expect(stream.locked).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("does not reset the overall deadline when more bytes arrive", async () => {
    vi.useFakeTimers();
    let source: ReadableStreamDefaultController<Uint8Array>;
    const cancel = vi.fn();
    const stream = new ReadableStream<Uint8Array>({ start(controller) { source = controller; }, cancel });
    const result = readBankUpload(streamRequest(stream));
    const assertion = expect(result).rejects.toMatchObject({ status: 408 });
    await vi.advanceTimersByTimeAsync(BANK_UPLOAD_TIMEOUT_MS - 1);
    source!.enqueue(Uint8Array.of(1));
    await vi.advanceTimersByTimeAsync(1);
    await assertion;
    expect(cancel).toHaveBeenCalledOnce();
  });

  it.each([false, true])("honors cancellation, already aborted: %s", async alreadyAborted => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const cancel = vi.fn();
    const stream = new ReadableStream<Uint8Array>({ cancel });
    if (alreadyAborted) controller.abort();
    const result = readBankUpload(streamRequest(stream, {}, controller.signal));
    const assertion = expect(result).rejects.toMatchObject({ status: 400, code: "BANK_UPLOAD_ABORTED" });
    if (!alreadyAborted) controller.abort();
    await assertion;
    expect(cancel).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("turns a source failure into a controlled error", async () => {
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) { controller.error(new Error("synthetic disconnect")); },
    });
    await expect(readBankUpload(streamRequest(stream))).rejects.toMatchObject({ status: 400, code: "BANK_UPLOAD_INVALID" });
    expect(stream.locked).toBe(false);
  });

  it("accepts exactly the body byte limit and clears the deadline", async () => {
    vi.useFakeTimers();
    const prefix = '--bank\r\nContent-Disposition: form-data; name="extra"\r\n\r\n';
    const suffix = "\r\n--bank--\r\n";
    const body = Buffer.concat([Buffer.from(prefix), Buffer.alloc(BANK_UPLOAD_MAX_BODY_BYTES - prefix.length - suffix.length, 120), Buffer.from(suffix)]);
    const stream = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(body); controller.close(); } });
    const parsed = await readBankUpload(streamRequest(stream));
    expect(parsed.get("extra")).toHaveLength(BANK_UPLOAD_MAX_BODY_BYTES - prefix.length - suffix.length);
    expect(vi.getTimerCount()).toBe(0);
    expect(stream.locked).toBe(false);
  });

  it.each(["-1", "1.5", "invalid"])("rejects malformed Content-Length %s and cancels the source", async length => {
    const cancel = vi.fn();
    const stream = new ReadableStream<Uint8Array>({ cancel });
    await expect(readBankUpload(streamRequest(stream, { "content-length": length })))
      .rejects.toMatchObject({ status: 400, code: "BANK_UPLOAD_INVALID" });
    expect(cancel).toHaveBeenCalledOnce();
  });

  it("rejects a non-multipart body without reading it", async () => {
    const cancel = vi.fn();
    const pull = vi.fn();
    const stream = new ReadableStream<Uint8Array>({ pull, cancel }, { highWaterMark: 0 });
    await expect(readBankUpload(streamRequest(stream, { "content-type": "application/json" })))
      .rejects.toMatchObject({ status: 400 });
    expect(pull).not.toHaveBeenCalled();
    expect(cancel).toHaveBeenCalledOnce();
  });

  it("rejects a request without a body", async () => {
    await expect(readBankUpload(new Request("http://localhost", { method: "POST" })))
      .rejects.toMatchObject({ status: 400 });
  });

  it("checks the deadline even when continuous chunks prevent timer execution", async () => {
    vi.useFakeTimers();
    const cancel = vi.fn();
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        vi.setSystemTime(Date.now() + BANK_UPLOAD_TIMEOUT_MS);
        controller.enqueue(Uint8Array.of(1));
      }, cancel,
    }, { highWaterMark: 0 });
    await expect(readBankUpload(streamRequest(stream))).rejects.toMatchObject({ status: 408 });
    expect(cancel).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });
});
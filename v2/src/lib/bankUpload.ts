export const BANK_UPLOAD_MAX_BODY_BYTES = 6 * 1024 * 1024;
export const BANK_UPLOAD_MAX_FILE_BYTES = 5 * 1024 * 1024;
export const BANK_UPLOAD_TIMEOUT_MS = 15_000;

export class BankUploadError extends Error {
  constructor(message: string, public readonly status: number, public readonly code: string) {
    super(message);
    this.name = "BankUploadError";
  }
}

export async function readBankUpload(request: Request): Promise<FormData> {
  if (!request.body || request.bodyUsed || request.body.locked) {
    throw new BankUploadError("Ожидается multipart-загрузка выписки", 400, "BANK_UPLOAD_INVALID");
  }

  const reader = request.body.getReader();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let onAbort: (() => void) | undefined;
  try {
    const contentType = request.headers.get("content-type") ?? "";
    if (!/^multipart\/form-data\s*;/i.test(contentType)) {
      throw new BankUploadError("Ожидается multipart-загрузка выписки", 400, "BANK_UPLOAD_INVALID");
    }
    const contentLength = request.headers.get("content-length");
    if (contentLength !== null && !/^\d+$/.test(contentLength)) {
      throw new BankUploadError("Некорректный размер загрузки", 400, "BANK_UPLOAD_INVALID");
    }
    if (contentLength !== null && Number(contentLength) > BANK_UPLOAD_MAX_BODY_BYTES) {
      throw new BankUploadError("Общий размер загрузки превышает 6 МиБ", 413, "BANK_UPLOAD_TOO_LARGE");
    }
    const aborted = () => new BankUploadError("Загрузка выписки отменена", 400, "BANK_UPLOAD_ABORTED");
    if (request.signal.aborted) throw aborted();

    const timedOut = () => new BankUploadError(
      "Время загрузки выписки превышает 15 секунд", 408, "BANK_UPLOAD_TIMEOUT",
    );
    const deadline = Date.now() + BANK_UPLOAD_TIMEOUT_MS;
    const interrupted = new Promise<never>((_resolve, reject) => {
      onAbort = () => reject(aborted());
      request.signal.addEventListener("abort", onAbort, { once: true });
      timer = setTimeout(() => reject(timedOut()), BANK_UPLOAD_TIMEOUT_MS);
    });
    const readBytes = async () => {
      const bytes = Buffer.alloc(BANK_UPLOAD_MAX_BODY_BYTES);
      let totalBytes = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (request.signal.aborted) throw aborted();
        if (Date.now() >= deadline) throw timedOut();
        if (done) return bytes.subarray(0, totalBytes);
        if (value.byteLength > BANK_UPLOAD_MAX_BODY_BYTES - totalBytes) {
          throw new BankUploadError("Общий размер загрузки превышает 6 МиБ", 413, "BANK_UPLOAD_TOO_LARGE");
        }
        bytes.set(value, totalBytes);
        totalBytes += value.byteLength;
      }
    };
    const bytes = await Promise.race([readBytes(), interrupted]);
    return await new Response(bytes, {
      headers: { "content-type": contentType },
    }).formData();
  } catch (error) {
    void reader.cancel(error).catch(() => {});
    if (error instanceof BankUploadError) throw error;
    throw new BankUploadError("Повреждена multipart-загрузка выписки", 400, "BANK_UPLOAD_INVALID");
  } finally {
    if (timer !== undefined) clearTimeout(timer);
    if (onAbort) request.signal.removeEventListener("abort", onAbort);
    reader.releaseLock();
  }
}
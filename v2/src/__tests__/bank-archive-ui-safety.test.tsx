// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import BankImportArchive from "@/app/closing/steps/BankImportArchive";

describe("bank archive without a browser", () => {
  let container: HTMLDivElement;
  let root: Root;
  const fetchMock = vi.fn();
  const batch = { id: "batch/id", sourceName: "statement.txt", bankCurrency: "UZS", status: "ROLLED_BACK", createdAt: "2026-09-11T00:00:00Z" };
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.stubGlobal("fetch", fetchMock);
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });
  async function click(text: string) {
    const button = Array.from(container.querySelectorAll("button")).find(item => item.textContent?.includes(text));
    if (!button) throw new Error(`Missing button: ${text}`);
    await act(async () => button.click());
  }
  it("retains rolled-back history and offers exact source and protocol routes", async () => {
    fetchMock.mockResolvedValue(Response.json({ batches: [batch], nextCursor: null }));
    await act(async () => root.render(<BankImportArchive key="bank" bankAccountId="bank" />));
    expect(container.textContent).toContain("Импорт отменён");
    expect(container.querySelectorAll("a")).toHaveLength(2);
    expect(container.querySelector("a")!.getAttribute("href")).toBe("/v2/api/import/bank/batches/batch%2Fid/export?format=source");
    expect(container.querySelectorAll("a")[1].getAttribute("href")).toContain("format=protocol");
    expect(fetchMock.mock.calls[0][0]).toBe("/v2/api/import/bank/batches?bankAccountId=bank");
  });
  it("keeps earlier pages when a later request fails and retries the same cursor", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ batches: [batch], nextCursor: "next" }))
      .mockResolvedValueOnce(Response.json({ error: "Archive unavailable" }, { status: 503 }))
      .mockResolvedValueOnce(Response.json({ batches: [{ ...batch, id: "second", sourceName: "second.txt" }], nextCursor: null }));
    await act(async () => root.render(<BankImportArchive key="bank" bankAccountId="bank" />));
    await click("Загрузить ещё");
    expect(container.textContent).toContain("Archive unavailable");
    expect(container.textContent).toContain("statement.txt");
    await click("Повторить загрузку архива");
    expect(container.querySelectorAll("li")).toHaveLength(2);
    expect(fetchMock.mock.calls[1][0]).toBe(fetchMock.mock.calls[2][0]);
    expect(fetchMock.mock.calls[2][0]).toContain("cursor=next");
  });
  it("ignores an old account response after switching accounts", async () => {
    let resolveOld!: (response: Response) => void;
    fetchMock.mockImplementationOnce(() => new Promise<Response>(resolve => { resolveOld = resolve; }))
      .mockResolvedValueOnce(Response.json({ batches: [], nextCursor: null }));
    await act(async () => root.render(<BankImportArchive key="old" bankAccountId="old" />));
    await act(async () => root.render(<BankImportArchive key="new" bankAccountId="new" />));
    await act(async () => resolveOld(Response.json({ batches: [batch], nextCursor: null })));
    expect(container.textContent).toContain("Сохранённых партий нет");
    expect(container.textContent).not.toContain("statement.txt");
    expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
  });
});
// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Step7Summary from "@/app/closing/steps/Step7Summary";

function deferredResponse() {
  let resolve!: (value: Response) => void;
  const promise = new Promise<Response>(done => { resolve = done; });
  return { promise, resolve };
}

const dashboard = (income = "100.00") => ({
  kpi: { totalBalance: "10.00", income, expense: "2.00", taxesOwed: "1.00" },
  stats: { riskItems: 0, needsClarification: 0 },
});
const finalized = {
  period: { id: "december", year: 2026, month: 12, lockDate: "2026-12-31T18:59:59.999Z", status: "CLOSED" },
  taxEvents: [], warnings: [],
};

describe("closing summary safety without a browser", () => {
  let container: HTMLDivElement;
  let root: Root;
  const fetchMock = vi.fn();
  const onFinalized = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "error").mockImplementation(() => {});
    fetchMock.mockImplementation(async (url: string) => Response.json(
      url.includes("dashboard") ? dashboard() : url.includes("/finalize") ? finalized : { done: false },
    ));
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  async function render(periodId = "december") {
    await act(async () => root.render(<Step7Summary periodId={periodId} state={{}}
      onFinalized={onFinalized} onPrev={() => {}} />));
  }

  async function click(text: string) {
    const found = Array.from(container.querySelectorAll("button")).find(item => item.textContent?.includes(text));
    if (!found) throw new Error(`Button not found: ${text}`);
    await act(async () => found.click());
  }

  async function close() {
    await click("Зафиксировать и закрыть период");
    await click("Закрыть период →");
  }

  it.each(["dashboard", "year-end/status"])("refuses a failed %s response and allows retry", async endpoint => {
    const normal = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation((url: string) => url.includes(endpoint)
      ? Promise.resolve(Response.json({ error: "unavailable" }, { status: 500 })) : normal(url));
    await render();
    expect(container.textContent).toContain("Не удалось загрузить сводные данные");
    expect(container.textContent).not.toContain("Зафиксировать и закрыть период");
    fetchMock.mockImplementation(normal);
    await click("Повторить");
    expect(container.textContent).toContain("Зафиксировать и закрыть период");
  });

  it("does not present malformed successful data as zero totals", async () => {
    fetchMock.mockImplementation(async () => Response.json({}));
    await render();
    expect(container.textContent).toContain("Не удалось загрузить сводные данные");
  });

  it("aborts old reads and cannot overwrite a new summary", async () => {
    const pending = deferredResponse();
    const normal = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation((url: string) => url.includes("dashboard") && url.includes("old")
      ? pending.promise : normal(url));
    await render("old");
    const signal = fetchMock.mock.calls[0][1].signal as AbortSignal;
    await render("new");
    await act(async () => pending.resolve(Response.json(dashboard("987654.00"))));
    expect(signal.aborted).toBe(true);
    expect(container.textContent?.replace(/\s/g, "")).not.toContain("987654");
  });

  it("ignores successful finalization after changing periods", async () => {
    const pending = deferredResponse();
    const normal = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation((url: string) => url.includes("/finalize") ? pending.promise : normal(url));
    await render();
    await close();
    await render("january");
    await act(async () => pending.resolve(Response.json(finalized)));
    expect(onFinalized).not.toHaveBeenCalled();
    expect(container.textContent).not.toContain("Месяц успешно закрыт");
  });

  it("resets an already completed result when selecting a new period", async () => {
    await render();
    await close();
    expect(onFinalized).toHaveBeenCalledOnce();
    await render("january");
    expect(container.textContent).not.toContain("Месяц успешно закрыт");
    expect(container.textContent).toContain("Зафиксировать и закрыть период");
  });

  it("does not treat an unconfirmed year-end conflict as success", async () => {
    await render();
    await close();
    const normal = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation((url: string) => url === "/v2/api/closing/year-end"
      ? Promise.resolve(Response.json({ error: "conflict" }, { status: 409 })) : normal(url));
    await click("Перенести прибыль");
    await click("Подтвердить перенос");
    expect(container.textContent).not.toContain("Финансовый результат перенесён");
    expect(container.textContent).toContain("conflict");
  });

  it("accepts a year-end conflict only after a successful status confirmation", async () => {
    await render();
    await close();
    const normal = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation((url: string) => url === "/v2/api/closing/year-end"
      ? Promise.resolve(Response.json({ error: "already closed" }, { status: 409 }))
      : url.includes("year-end/status") ? Promise.resolve(Response.json({ done: true })) : normal(url));
    await click("Перенести прибыль");
    await click("Подтвердить перенос");
    expect(container.textContent).toContain("Финансовый результат перенесён");
    expect(fetchMock.mock.calls.filter(([url]) => url.includes("year-end/status"))).toHaveLength(2);
  });

  it("releases a stalled summary after its deadline without real waiting", async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation((_url: string, options: RequestInit) => new Promise((_resolve, reject) => {
      options.signal!.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
    }));
    await render();
    await act(async () => vi.advanceTimersByTimeAsync(30000));
    expect(container.textContent).toContain("Не удалось загрузить сводные данные");
    expect(vi.getTimerCount()).toBe(0);
  });
});
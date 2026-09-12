// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ClosingWizard from "@/app/closing/ClosingWizard";

vi.mock("@/app/closing/steps/Step1Import", () => ({ default: ({ onNext }: { onNext: () => void }) => <button onClick={onNext}>step-next</button> }));
vi.mock("@/app/closing/steps/Step2Clarification", () => ({ default: () => <div>step-two</div> }));
vi.mock("@/app/closing/steps/Step3Registry", () => ({ default: () => null }));
vi.mock("@/app/closing/steps/Step5FxDiff", () => ({ default: () => null }));
vi.mock("@/app/closing/steps/Step6Soliq", () => ({ default: () => null }));
vi.mock("@/app/closing/steps/Step7EInvoices", () => ({ default: () => null }));
vi.mock("@/app/closing/steps/Step7Summary", () => ({ default: () => null }));

function deferredResponse() {
  let resolve!: (value: Response) => void;
  const promise = new Promise<Response>(done => { resolve = done; });
  return { promise, resolve };
}

const state = (currentStep = 1, rentAmount = 10) => ({ currentStep,
  accruals: { salaryAmount: 0, depreciationAmount: 0, rentAmount, expenseAccountCode: "" },
});

describe("closing wizard isolation without a browser", () => {
  let container: HTMLDivElement;
  let root: Root;
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "error").mockImplementation(() => {});
    fetchMock.mockImplementation(async (url: string) => Response.json(url.includes("pending-invoices") ? []
      : url.includes("/state") ? state() : { stats: { needsClarification: 0 } }));
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

  async function render(id: string) {
    await act(async () => root.render(<ClosingWizard period={{ id, month: 9, year: 2026, status: "OPEN", mode: "NORMAL" }}
      onRefreshList={() => {}} />));
  }

  async function next() {
    const button = Array.from(container.querySelectorAll("button")).find(item => item.textContent === "step-next");
    if (!button) throw new Error("Missing test step");
    await act(async () => button.click());
  }

  it.each(["pending-invoices", "/state", "dashboard"])("blocks the wizard when %s fails", async endpoint => {
    const normal = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation((url: string) => url.includes(endpoint)
      ? Promise.resolve(Response.json({ error: "unavailable" }, { status: 500 })) : normal(url));
    await render("old");
    expect(container.textContent).toContain("Не удалось загрузить данные мастера");
    expect(container.textContent).not.toContain("step-next");
  });

  it("hides previous accruals immediately and mounts the new amounts only after loading", async () => {
    const pending = deferredResponse();
    const normal = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation((url: string) => url.includes("/state")
      ? url.includes("old") ? Promise.resolve(Response.json(state(4, 10))) : pending.promise : normal(url));
    await render("old");
    expect(container.querySelectorAll<HTMLInputElement>('input[type="number"]')[2].value).toBe("10");
    await render("new");
    expect(container.querySelectorAll("input")).toHaveLength(0);
    expect(container.textContent).toContain("Загрузка состояния");
    await act(async () => pending.resolve(Response.json(state(4, 20))));
    expect(container.querySelectorAll<HTMLInputElement>('input[type="number"]')[2].value).toBe("20");
  });

  it("ignores an old state response and aborts its request", async () => {
    const pending = deferredResponse();
    const normal = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation((url: string) => url.includes("old/state") ? pending.promise : normal(url));
    await render("old");
    const signal = fetchMock.mock.calls.find(([url]) => url.includes("old/state"))?.[1]?.signal as AbortSignal | undefined;
    await render("new");
    await act(async () => pending.resolve(Response.json(state(2))));
    expect(container.textContent).toContain("step-next");
    expect(container.textContent).not.toContain("step-two");
    expect(signal?.aborted).toBe(true);
  });

  it.each(["http", "network"])("does not advance after a %s failure checking invoices", async kind => {
    await render("old");
    if (kind === "http") fetchMock.mockResolvedValueOnce(Response.json({ error: "unavailable" }, { status: 500 }));
    else fetchMock.mockRejectedValueOnce(new Error("offline"));
    await next();
    expect(container.textContent).toContain("step-next");
    expect(container.textContent).not.toContain("step-two");
    expect(container.textContent).toContain("Не удалось проверить ЭСФ");
    await next();
    expect(container.textContent).toContain("step-two");
  });

  it("ignores a pending old navigation after changing periods", async () => {
    await render("old");
    const pending = deferredResponse();
    fetchMock.mockReturnValueOnce(pending.promise);
    await next();
    await render("new");
    await act(async () => pending.resolve(Response.json([])));
    expect(container.textContent).toContain("step-next");
    expect(container.textContent).not.toContain("step-two");
  });

  it("rejects malformed successful pending-invoice data", async () => {
    const normal = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation((url: string) => url.includes("pending-invoices")
      ? Promise.resolve(Response.json({ length: 0 })) : normal(url));
    await render("old");
    expect(container.textContent).toContain("Не удалось загрузить данные мастера");
  });

  it("bounds initial loading with a deadline and cleans up timers", async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation((_url: string, options?: RequestInit) => new Promise((_resolve, reject) => {
      options?.signal?.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
    }));
    await render("old");
    await act(async () => vi.advanceTimersByTimeAsync(30000));
    expect(container.textContent).toContain("Не удалось загрузить данные мастера");
    expect(vi.getTimerCount()).toBe(0);
  });
});
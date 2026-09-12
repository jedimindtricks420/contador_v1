// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Step4Accruals from "@/app/closing/steps/Step4Accruals";

function deferredResponse() {
  let resolve!: (value: Response) => void;
  const promise = new Promise<Response>(done => { resolve = done; });
  return { promise, resolve };
}

describe("accrual step period isolation without a browser", () => {
  let container: HTMLDivElement;
  let root: Root;
  const fetchMock = vi.fn();
  const onNext = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValue(Response.json({ hasPostedDocs: false }));
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  async function render(periodId: string, rentAmount = 10) {
    await act(async () => root.render(<Step4Accruals periodId={periodId}
      initialAccruals={{ salaryAmount: 0, depreciationAmount: 0, rentAmount }}
      onNext={onNext} onPrev={() => {}} />));
  }

  function button(text: string) {
    const found = Array.from(container.querySelectorAll("button")).find(item => item.textContent?.includes(text));
    if (!found) throw new Error(`Button not found: ${text}`);
    return found;
  }

  async function click(text: string) {
    await act(async () => button(text).click());
  }

  function rent() {
    return container.querySelectorAll<HTMLInputElement>('input[type="number"]')[2].value;
  }

  it("reinitializes amounts when the period changes", async () => {
    await render("august", 10);
    await render("september", 20);
    expect(rent()).toBe("20");
  });

  it("does not advance a new period when an old save succeeds", async () => {
    const pending = deferredResponse();
    fetchMock.mockReturnValueOnce(pending.promise);
    await render("august");
    await click("Сохранить и продолжить");
    expect(fetchMock.mock.calls[0][0]).toBe("/v2/api/closing/august/step/4/complete");
    await render("september", 20);
    await act(async () => pending.resolve(Response.json({ ok: true })));
    expect(onNext).not.toHaveBeenCalled();
    expect(rent()).toBe("20");
    expect(button("Сохранить и продолжить").disabled).toBe(false);
  });

  it("does not clear a new period when an old reset succeeds", async () => {
    const pending = deferredResponse();
    fetchMock.mockReturnValueOnce(pending.promise);
    await render("august");
    await click("Сбросить");
    await act(async () => container.querySelectorAll<HTMLButtonElement>("button").item(
      container.querySelectorAll("button").length - 1).click());
    expect(fetchMock.mock.calls[0][1].method).toBe("DELETE");
    await render("september", 20);
    await act(async () => pending.resolve(Response.json({ reset: true })));
    expect(rent()).toBe("20");
  });

  it("aborts old hint requests and ignores even a late response", async () => {
    const pending = deferredResponse();
    fetchMock.mockReturnValueOnce(pending.promise);
    await render("august", 0);
    const signal = fetchMock.mock.calls[0][1]?.signal as AbortSignal | undefined;
    await render("september", 0);
    await act(async () => pending.resolve(Response.json({
      hasPostedDocs: true, postedSalaryAmount: 0, postedDepreciationAmount: 0,
      postedRentAmount: 999, postedExpenseAccountCode: null,
    })));
    expect(container.textContent).not.toContain("Обнаружены проведённые начисления");
    expect(signal?.aborted).toBe(true);
  });

  it("disables reset while saving", async () => {
    fetchMock.mockReturnValueOnce(deferredResponse().promise);
    await render("august");
    await click("Сохранить и продолжить");
    expect(button("Сбросить").disabled).toBe(true);
  });

  it("keeps the current values on failure and advances only after a successful retry", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ error: "locked" }, { status: 400 }));
    await render("august", 12.01);
    await click("Сохранить и продолжить");
    expect(onNext).not.toHaveBeenCalled();
    expect(container.textContent).toContain("locked");
    expect(rent()).toBe("12.01");
    await click("Сохранить и продолжить");
    expect(onNext).toHaveBeenCalledExactlyOnceWith({ accruals: {
      salaryAmount: 0, depreciationAmount: 0, rentAmount: 12.01, expenseAccountCode: "",
    } });
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({
      salaryAmount: "0", depreciationAmount: "0", rentAmount: "12.01", expenseAccountCode: "",
    });
  });
});
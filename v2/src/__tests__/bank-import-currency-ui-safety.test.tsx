// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Step1Import from "@/app/closing/steps/Step1Import";

vi.mock("@/components/SearchableSelect", () => ({ default: ({ options, value, onChange }: {
  options: { value: string; label: string }[]; value: string; onChange: (value: string) => void;
}) => <select value={value} onChange={event => onChange(event.target.value)}>{options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select> }));

describe("bank currency confirmation without a browser", () => {
  let container: HTMLDivElement;
  let root: Root;
  const fetchMock = vi.fn();
  const refresh = vi.fn();
  beforeEach(async () => {
    vi.resetAllMocks();
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValueOnce(Response.json([
      { id: "uzs", name: "Local", currency: "UZS" }, { id: "usd", name: "Foreign", currency: "USD" },
    ]));
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    await act(async () => root.render(<Step1Import periodId="period" stats={null} onNext={vi.fn()} onRefreshStats={refresh} />));
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });
  async function chooseFile(name = "bank.txt") {
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;
    Object.defineProperty(input, "files", { configurable: true, value: [new File(["source"], name)] });
    await act(async () => input.dispatchEvent(new Event("change", { bubbles: true })));
  }
  const uploadButton = () => container.querySelector<HTMLButtonElement>("fieldset button")!;
  async function requireConfirmation() {
    await chooseFile();
    fetchMock.mockResolvedValueOnce(Response.json({ code: "BANK_CURRENCY_CONFIRMATION_REQUIRED", error: "Currency required" }, { status: 422 }));
    await act(async () => uploadButton().click());
  }
  it("sends no implied confirmation and requires a checked acknowledgement before retry", async () => {
    await requireConfirmation();
    expect(fetchMock.mock.calls[1][1].body.get("confirmedCurrency")).toBeNull();
    expect(uploadButton().disabled).toBe(true);
    expect(container.textContent).toContain("UZS");
    await act(async () => container.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click());
    expect(uploadButton().disabled).toBe(false);
    fetchMock.mockResolvedValueOnce(Response.json({ imported: 1, duplicates: 0, importBatchId: "batch" }));
    await act(async () => uploadButton().click());
    expect(fetchMock.mock.calls[2][1].body.get("confirmedCurrency")).toBe("UZS");
    expect(refresh).toHaveBeenCalledOnce();
    expect(container.querySelector('input[type="checkbox"]')).toBeNull();
  });
  it.each(["file", "account"])("clears acknowledgement when changing %s", async changed => {
    await requireConfirmation();
    await act(async () => container.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click());
    if (changed === "file") await chooseFile("different.txt");
    else {
      const select = container.querySelector("select")!;
      await act(async () => { select.value = "usd"; select.dispatchEvent(new Event("change", { bubbles: true })); });
    }
    fetchMock.mockResolvedValueOnce(Response.json({ code: "BANK_CURRENCY_CONFIRMATION_REQUIRED", error: "Currency required" }, { status: 422 }));
    await act(async () => uploadButton().click());
    expect(fetchMock.mock.calls[2][1].body.get("confirmedCurrency")).toBeNull();
    expect(uploadButton().disabled).toBe(true);
  });
  it("offers rollback for an archived quiet period with zero transactions", async () => {
    await chooseFile();
    fetchMock.mockResolvedValueOnce(Response.json({ imported: 0, duplicates: 0, emptyStatement: true, importBatchId: "quiet-batch" }));
    await act(async () => uploadButton().click());
    expect(container.textContent).toContain("Период без операций подтверждён выпиской");
    const rollbackButton = [...container.querySelectorAll("button")].find(button => button.textContent?.includes("Отменить загрузку"))!;
    await act(async () => rollbackButton.click());
    const confirm = [...container.querySelectorAll("button")].find(button => button.textContent === "Да, откатить")!;
    fetchMock.mockResolvedValueOnce(Response.json({ deleted: 0 }));
    await act(async () => confirm.click());
    expect(fetchMock.mock.calls[2]).toEqual(["/v2/api/import/bank/rollback", expect.objectContaining({ method: "DELETE", body: JSON.stringify({ batchId: "quiet-batch" }) })]);
    expect(refresh).toHaveBeenCalledTimes(2);
  });
});
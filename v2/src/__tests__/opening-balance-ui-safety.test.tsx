// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import OpeningBalancePage from "@/app/settings/opening-balance/page";

vi.mock("@/components/SearchableSelect", () => ({ default: ({ options, value, onChange }: {
  options: { value: string; label: string }[]; value: string; onChange: (value: string) => void;
}) => <select aria-label="Account" value={value} onChange={event => onChange(event.target.value)}>
  <option value="">Select</option>{options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
</select> }));

describe("opening balance form without a browser", () => {
  let container: HTMLDivElement;
  let root: Root;
  const fetchMock = vi.fn();
  const accounts = [{ code: "5100", name: "Group", type: "ASSET", isDeprecated: false, children: [
    { code: "5110", name: "Bank", type: "ASSET", isDeprecated: false, children: [] },
  ] }, { code: "8330", name: "Capital", type: "LIABILITY", isDeprecated: false, children: [] }];

  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockImplementation(async url => Response.json(url.endsWith("/accounts") ? accounts : { lines: [] }));
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
    if (!button) throw new Error(`Button not found: ${text}`);
    await act(async () => button.click());
  }
  async function input(selector: string, value: string) {
    const element = container.querySelector<HTMLInputElement | HTMLSelectElement>(selector)!;
    const prototype = element.tagName === "SELECT" ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    await act(async () => {
      Object.getOwnPropertyDescriptor(prototype, "value")!.set!.call(element, value);
      element.dispatchEvent(new Event(element.tagName === "SELECT" ? "change" : "input", { bubbles: true }));
    });
  }

  it("flattens account children and sends large amounts as exact strings", async () => {
    await act(async () => root.render(<OpeningBalancePage />));
    expect(container.querySelector('option[value="5100"]')).toBeNull();
    expect(container.querySelector('option[value="5110"]')).not.toBeNull();
    await input("select", "5110");
    await input('[aria-label="Дебет строки 1"]', "9007199254740993.27");
    await click("Добавить строку");
    await input("tbody tr:nth-child(2) select", "8330");
    await input('[aria-label="Кредит строки 2"]', "9007199254740993.27");
    await click("Сохранить начальные остатки");
    const [, init] = fetchMock.mock.calls.find(([, options]) => options?.method === "POST")!;
    expect(JSON.parse(init.body).lines).toEqual([
      { accountCode: "5110", debit: "9007199254740993.27", credit: "0.00" },
      { accountCode: "8330", debit: "0.00", credit: "9007199254740993.27" },
    ]);
    expect(container.textContent).toContain("Проведённый начальный баланс");
    expect(container.querySelector("fieldset")!.disabled).toBe(true);
  });

  it("restores the stored date and locks a posted balance without hiding legacy accounts", async () => {
    fetchMock.mockImplementation(async url => Response.json(url.endsWith("/accounts") ? accounts : {
      documentId: "old", date: "2026-01-01", lines: [
        { accountCode: "5110", debit: "100.00", credit: "0.00" },
        { accountCode: "8890", debit: "0.00", credit: "100.00" },
      ],
    }));
    await act(async () => root.render(<OpeningBalancePage />));
    expect(container.querySelector<HTMLInputElement>("#opening-date")!.value).toBe("2026-01-01");
    expect(container.querySelector("fieldset")!.disabled).toBe(true);
    expect(container.textContent).toContain("8890");
    expect(container.textContent).not.toContain("Разница балансируется");
    expect(container.textContent).not.toContain("Сохранить начальные остатки");
  });

  it("does not treat a failed read as an empty balance and permits retry", async () => {
    fetchMock.mockImplementation(async url => url.endsWith("/accounts") ? Response.json(accounts) : Response.json({ error: "Needs review" }, { status: 409 }));
    await act(async () => root.render(<OpeningBalancePage />));
    expect(container.textContent).toContain("Needs review");
    expect(container.querySelector("fieldset")!.disabled).toBe(true);
    await click("Сохранить начальные остатки");
    expect(fetchMock.mock.calls.some(([, options]) => options?.method === "POST")).toBe(false);
    fetchMock.mockImplementation(async url => Response.json(url.endsWith("/accounts") ? accounts : { lines: [] }));
    await click("Повторить загрузку");
    expect(container.querySelector("fieldset")!.disabled).toBe(false);
  });
});
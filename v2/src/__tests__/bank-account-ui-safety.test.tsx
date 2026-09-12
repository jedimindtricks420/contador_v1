// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AccountsClient from "@/app/accounts/AccountsClient";

describe("bank account form without a browser", () => {
  let container: HTMLDivElement;
  let root: Root;
  const fetchMock = vi.fn();
  const legacy = { id: "bank", name: "Legacy", bankName: null, accountNumber: null, currency: "UZS", lastBalance: "0" };

  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockImplementation(async () => Response.json([legacy]));
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
    const element = container.querySelector<HTMLInputElement>(selector)!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(element, value);
      element.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }

  async function openEdit() {
    await act(async () => root.render(<AccountsClient />));
    await act(async () => container.querySelector<HTMLButtonElement>('button[title="Редактировать"]')!.click());
  }

  it.each(["0.10", "9007199254740993.27", "-0.01"])("submits the exact decimal string %s on creation", async amount => {
    await act(async () => root.render(<AccountsClient />));
    await click("Добавить счёт");
    await input('input[placeholder="Например, Основной UZS"]', "New");
    await input('input[placeholder="20208000600001234567"]', "00000000000000000001");
    await input("#bank-account-balance", amount);
    expect(container.querySelector<HTMLFormElement>("form")!.checkValidity()).toBe(true);
    await click("Сохранить");
    const request = fetchMock.mock.calls.find(([, init]) => init?.method === "POST")!;
    expect(request[0]).toBe("/v2/api/bank-accounts");
    expect(JSON.parse(request[1].body)).toMatchObject({ lastBalance: amount, accountNumber: "00000000000000000001" });
  });

  it("renames a legacy account without resubmitting missing identity or its balance", async () => {
    await openEdit();
    await input('input[placeholder="Например, Основной UZS"]', "Renamed");
    await click("Сохранить");
    const request = fetchMock.mock.calls.find(([, init]) => init?.method === "PUT")!;
    expect(request[0]).toBe("/v2/api/bank-accounts/bank");
    expect(JSON.parse(request[1].body)).toEqual({ name: "Renamed" });
  });

  it("does not write an unchanged form", async () => {
    await openEdit();
    await click("Сохранить");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(container.querySelector("form")).toBeNull();
  });

  it("keeps a rejected amount intact for correction", async () => {
    await openEdit();
    await input("#bank-account-balance", "bad");
    fetchMock.mockImplementationOnce(async () => Response.json({ error: "Некорректный остаток" }, { status: 400 }));
    await click("Сохранить");
    expect(container.textContent).toContain("Некорректный остаток");
    expect(container.querySelector<HTMLInputElement>("#bank-account-balance")!.value).toBe("bad");
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ lastBalance: "bad" });
  });
});
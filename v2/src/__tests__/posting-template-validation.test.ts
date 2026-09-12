import { describe, expect, it, vi } from "vitest";
import { baseDocumentTypes } from "@/lib/ensureBaseData";
import { validateTemplate } from "@/lib/posting/templateValidator";
import { evaluate } from "@/lib/posting/expressionEval";

vi.mock("@/lib/prisma", () => ({ default: {} }));

describe("base posting template validation", () => {
  it.each(baseDocumentTypes)("validates $code without seeding a database", ({ code, template }) => {
    expect(validateTemplate(template)).toEqual(
      code === "PERIOD_CLOSING" ? ["Массив lines не должен быть пустым"] : [],
    );
  });

  it("rejects an unknown formula variable", () => {
    expect(validateTemplate({
      lines: [{ accountCode: "5110", side: "debit", expression: "ammount" }],
    })).not.toEqual([]);
  });

  it.each([
    { profit: 150, loss: 0, debit: "9210", credit: "9310", amount: "150" },
    { profit: 0, loss: 60, debit: "9430", credit: "9210", amount: "60" },
  ])("posts disposal result $profit/$loss to $debit/$credit", (example) => {
    const definition = baseDocumentTypes.find(({ code }) => code === "FIXED_ASSET_DISPOSAL_RESULT")!;
    const lines = definition.template.lines
      .filter((line) => !("condition" in line) || !line.condition || !evaluate(line.condition as string, example).isZero())
      .map((line) => ({
        code: line.accountCode, side: line.side, amount: evaluate(line.expression, example).toString(),
      }));
    expect(lines).toEqual([
      { code: example.debit, side: "debit", amount: example.amount },
      { code: example.credit, side: "credit", amount: example.amount },
    ]);
  });
});
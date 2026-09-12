import { describe, expect, it } from "vitest";
import { buildSoliqRows, resolveSoliqDecisions, SoliqBatchError, soliqCompletionSchema, soliqControlTotals, validateSoliqRows } from "@/lib/soliqBatch";

const period = { year: 2026, month: 9 };
const item = { date: new Date("2026-08-31T19:00:00.000Z"), inn: "111111111", counterpartyName: "Example", amount: 100.1, vatAmount: 12.01, direction: "REVENUE" as const };
const batchId = "ab77abb4-1b67-4b42-bc01-8a1b35239715";

describe("server-owned Soliq batch contract", () => {
  it("stores exact decimal strings and stable row identities", () => {
    const rows = buildSoliqRows([item, { ...item, direction: "EXPENSE" }], period);
    expect(rows.map(row => row.rowId)).toEqual(["1", "2"]);
    expect(soliqControlTotals(rows)).toEqual({ rowCount: 2, net: "200.20", gross: "224.22", inputVat: "12.01", outputVat: "12.01", vat: "0.00" });
  });

  it.each([
    { amount: -1 }, { amount: 1.001 }, { amount: Infinity }, { vatAmount: NaN },
    { amount: 0, vatAmount: 0 }, { amount: Number.MAX_SAFE_INTEGER },
    { date: new Date("invalid") }, { date: new Date("2026-08-31T18:59:59Z") },
    { date: new Date("2026-09-30T19:00:00Z") }, { inn: "not-an-inn" },
  ])("rejects invalid parsed data %j", patch => {
    expect(() => buildSoliqRows([{ ...item, ...patch }], period)).toThrow();
  });

  it.each(["amount", "vatAmount", "direction", "date", "taxSummary", "parsedPayload"]) ("rejects client financial field %s", field => {
    expect(soliqCompletionSchema.safeParse({ batchId, decisions: [], [field]: 1 }).success).toBe(false);
    expect(soliqCompletionSchema.safeParse({ batchId, decisions: [{ rowId: "1", openItemId: null, [field]: 1 }] }).success).toBe(false);
  });

  it("allows only decisions and derives financial fields from stored rows", () => {
    const rows = buildSoliqRows([item], period);
    const request = soliqCompletionSchema.parse({ batchId, decisions: [{ rowId: "1", openItemId: "advance", receiptKind: "services" }] });
    expect(resolveSoliqDecisions(rows, soliqControlTotals(rows), request.decisions)[0]).toMatchObject({ amount: "100.10", vatAmount: "12.01", matchedOpenItemId: "advance", matchedAccountCode: "6310" });
  });

  it.each([
    { decisions: [] }, { decisions: [{ rowId: "2", openItemId: null }] },
    { decisions: [{ rowId: "1", openItemId: null }, { rowId: "1", openItemId: null }] },
  ])("rejects incomplete or duplicated decisions %j", ({ decisions }) => {
    const rows = buildSoliqRows([item], period);
    expect(() => resolveSoliqDecisions(rows, soliqControlTotals(rows), decisions)).toThrow(SoliqBatchError);
  });

  it("rejects reused advances and corrupted totals or identities", () => {
    const rows = buildSoliqRows([item, item], period);
    expect(() => resolveSoliqDecisions(rows, soliqControlTotals(rows), rows.map(row => ({ rowId: row.rowId, openItemId: "same" })))).toThrow(/более одного/);
    expect(() => resolveSoliqDecisions(rows, { ...soliqControlTotals(rows), gross: "1.00" }, [])).toThrow(/итоги/);
    expect(() => validateSoliqRows([rows[0], rows[0]], period)).toThrow(/Повторный/);
  });

  it("preserves exact stored cents when binary numbers would lose them", () => {
    const rows = validateSoliqRows([{
      rowId: "1", date: item.date.toISOString(), inn: item.inn, counterpartyName: item.counterpartyName,
      direction: "REVENUE", amount: "70368744177664.01", vatAmount: "0.00",
    }], period);
    const resolved = resolveSoliqDecisions(rows, soliqControlTotals(rows), [{ rowId: "1", openItemId: null }]);
    expect(resolved[0].amount).toBe("70368744177664.01");
  });
});
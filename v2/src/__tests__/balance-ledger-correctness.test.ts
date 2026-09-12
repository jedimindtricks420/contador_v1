import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const database = vi.hoisted(() => ({ $queryRaw: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ default: database }));
vi.mock("@/lib/context", () => ({ getActiveOrgId: vi.fn().mockResolvedValue("org-1") }));

import { GET } from "@/app/api/reports/balance/route";

describe("balance ledger classification", () => {
  beforeEach(() => vi.clearAllMocks());

  it("includes leased assets in fixed assets and deducts their depreciation", async () => {
    database.$queryRaw.mockResolvedValueOnce([
      { code: "0310", sumDebit: "1000", sumCredit: "0" },
      { code: "0299", sumDebit: "0", sumCredit: "200" },
      { code: "0710", sumDebit: "300", sumCredit: "0" },
      { code: "7910", sumDebit: "0", sumCredit: "1100" },
    ]).mockResolvedValueOnce([{ netResult: "0" }]);

    const response = await GET(new NextRequest("http://localhost/api/reports/balance?to=2026-09-30"));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      asOf: "2026-09-30T18:59:59.999Z",
      line010: 1000, line011: 200, line012: 800, line090: 300,
      line130: 1100, line400: 1100, line780: 1100,
      balanceCheck: true, difference: 0,
    });
    for (const [query, orgId, endExclusive] of database.$queryRaw.mock.calls) {
      expect(orgId).toBe("org-1");
      expect(endExclusive.toISOString()).toBe("2026-09-30T19:00:00.000Z");
      expect(query.join("?")).toMatch(/d\.date\s*<\s*\?/);
    }
  });

  it.each(["2026-02-29", "not-a-date", ""])("rejects invalid balance date %s before reading ledger", async (date) => {
    const response = await GET(new NextRequest(`http://localhost/api/reports/balance?to=${date}`));
    expect(response.status).toBe(400);
    expect(database.$queryRaw).not.toHaveBeenCalled();
  });
});
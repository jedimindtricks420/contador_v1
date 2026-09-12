import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/accounts/route";

const { getOrgId, database } = vi.hoisted(() => ({ getOrgId: vi.fn(), database: {
  account: { findMany: vi.fn() }, organization: { findUnique: vi.fn() },
} }));
vi.mock("@/lib/context", () => ({ getActiveOrgId: getOrgId }));
vi.mock("@/lib/prisma", () => ({ default: database, prismaWithOrg: () => database }));

describe("tenant-scoped account usage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getOrgId.mockResolvedValue("own-org");
    database.organization.findUnique.mockResolvedValue({ settings: {} });
    database.account.findMany.mockResolvedValue([
      { id: "group", code: "5100", name: "Bank accounts", parentId: null, _count: { journalEntries: 0, openItems: 0 } },
      { id: "leaf", code: "5110", name: "Bank", parentId: "group", _count: { journalEntries: 2, openItems: 3 } },
    ]);
  });

  it("scopes both usage counters to the active organization without changing hierarchy", async () => {
    const response = await GET(new NextRequest("http://localhost/api/accounts"));
    expect(response.status).toBe(200);
    expect(database.account.findMany).toHaveBeenCalledWith({ orderBy: { code: "asc" }, include: {
      _count: { select: { journalEntries: { where: { document: { orgId: "own-org" } } }, openItems: { where: { orgId: "own-org" } } } },
    } });
    expect(await response.json()).toEqual([expect.objectContaining({ code: "5100", usageCount: 0,
      children: [expect.objectContaining({ code: "5110", usageCount: 5 })],
    })]);
  });

  it.each(["UNAUTHORIZED", "NO_ACTIVE_ORG", "FORBIDDEN"])("does not read statistics after %s", async message => {
    getOrgId.mockRejectedValue(new Error(message));
    expect((await GET(new NextRequest("http://localhost/api/accounts"))).status).toBe(message === "UNAUTHORIZED" ? 401 : 403);
    expect(database.account.findMany).not.toHaveBeenCalled();
  });
});
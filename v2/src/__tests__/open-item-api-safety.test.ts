import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { PATCH as closeItem } from "@/app/api/open-items/[id]/close/route";
import { POST as reopenItem } from "@/app/api/open-items/[id]/reopen/route";

const { membership, database } = vi.hoisted(() => ({
  membership: vi.fn(),
  database: { openItem: { findFirst: vi.fn(), update: vi.fn() }, $transaction: vi.fn() },
}));
vi.mock("@/lib/context", () => ({ getActiveMembership: membership }));
vi.mock("@/lib/prisma", () => ({ default: database }));

describe.each([{ handler: closeItem, method: "PATCH" }, { handler: reopenItem, method: "POST" }])(
  "direct OpenItem mutation $method", ({ handler, method }) => {
    const invoke = (body: unknown = {}) => handler(new NextRequest("http://localhost/api/open-items/item-1", {
      method, body: JSON.stringify(body),
    }), { params: Promise.resolve({ id: "item-1" }) });

    beforeEach(() => {
      vi.resetAllMocks();
      membership.mockResolvedValue({ orgId: "org-1", userId: "user-1", role: "ACCOUNTANT" });
      database.openItem.findFirst.mockResolvedValue({ id: "item-1", status: "OPEN", closingDocumentId: null });
    });

    it.each([{}, { closingDocumentId: "foreign-document", dateClosed: "2026-09-10" }])(
      "rejects direct mutation even with a supplied document: %j", async (body) => {
        expect((await invoke(body)).status).toBe(409);
        expect(database.openItem.update).not.toHaveBeenCalled();
        expect(database.$transaction).not.toHaveBeenCalled();
      },
    );

    it("does not reopen previously settled debt", async () => {
      database.openItem.findFirst.mockResolvedValue({ id: "item-1", status: "CLOSED", closingDocumentId: "payment-1" });
      expect((await invoke()).status).toBe(409);
      expect(database.openItem.update).not.toHaveBeenCalled();
    });

    it("does not expose another organization's position", async () => {
      database.openItem.findFirst.mockResolvedValue(null);
      expect((await invoke()).status).toBe(404);
      expect(database.openItem.findFirst).toHaveBeenCalledWith({ where: { id: "item-1", orgId: "org-1" } });
    });

    it("rejects read-only roles before looking up the position", async () => {
      membership.mockResolvedValue({ orgId: "org-1", role: "VIEWER" });
      expect((await invoke()).status).toBe(403);
      expect(database.openItem.findFirst).not.toHaveBeenCalled();
    });

    it.each([["UNAUTHORIZED", 401], ["FORBIDDEN", 403], ["NO_ACTIVE_ORG", 403]])(
      "handles %s before data access", async (message, status) => {
        membership.mockRejectedValue(new Error(String(message)));
        expect((await invoke()).status).toBe(status);
        expect(database.openItem.findFirst).not.toHaveBeenCalled();
      },
    );
  },
);
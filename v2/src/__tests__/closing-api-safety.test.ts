import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/periods/[id]/close/route";
import { POST as finalizeWizard } from "@/app/api/closing/[periodId]/finalize/route";
import { MissingCogsError } from "@/lib/closing";
import { PostingValidationError } from "@/lib/posting/errors";

const { membership, finalize, findPeriod } = vi.hoisted(() => ({
  membership: vi.fn(), finalize: vi.fn(), findPeriod: vi.fn(),
}));
vi.mock("@/lib/context", () => ({ getActiveMembership: membership }));
vi.mock("@/lib/closing", () => ({ finalizePeriod: finalize, MissingCogsError: class extends Error {} }));
vi.mock("@/lib/prisma", () => ({ default: { period: { findFirst: findPeriod } } }));

function close(body: object = {}) {
  return POST(new NextRequest("http://localhost/api/periods/period/close", {
    method: "POST", body: JSON.stringify(body),
  }), { params: Promise.resolve({ id: "period" }) });
}

describe("period close API", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    membership.mockResolvedValue({ orgId: "org", userId: "user", role: "OWNER" });
    findPeriod.mockResolvedValue({ id: "period", status: "OPEN" });
    finalize.mockResolvedValue({ period: { id: "period", status: "CLOSED" } });
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("delegates closing to the transactional service with current membership", async () => {
    const response = await close();
    expect(response.status).toBe(200);
    expect(findPeriod).toHaveBeenCalledWith({ where: { id: "period", orgId: "org" } });
    expect(finalize).toHaveBeenCalledWith("period", "org", "user");
  });

  it("rejects force even for the owner", async () => {
    expect((await close({ force: true })).status).toBe(400);
    expect(finalize).not.toHaveBeenCalled();
  });

  it("rejects a read-only role", async () => {
    membership.mockResolvedValue({ orgId: "org", userId: "user", role: "VIEWER" });
    expect((await close()).status).toBe(403);
    expect(findPeriod).not.toHaveBeenCalled();
    expect(finalize).not.toHaveBeenCalled();
  });

  it("does not close a foreign period", async () => {
    findPeriod.mockResolvedValue(null);
    expect((await close()).status).toBe(404);
    expect(finalize).not.toHaveBeenCalled();
  });

  it("returns service validation failures without claiming closure", async () => {
    finalize.mockRejectedValue(new Error("Банковские операции не обработаны"));
    expect((await close()).status).toBe(400);
  });

  const wizard = (body = "{}") => finalizeWizard(new NextRequest("http://localhost/api/closing/period/finalize", {
    method: "POST", body,
  }), { params: Promise.resolve({ periodId: "period" }) });

  it.each(["OWNER", "ADMIN", "ACCOUNTANT"])("uses the current %s identity for wizard finalization", async role => {
    membership.mockResolvedValue({ orgId: "org", userId: "current-user", role });
    expect((await wizard('{"confirmMissingCogs":true}')).status).toBe(200);
    expect(findPeriod).toHaveBeenCalledWith({ where: { id: "period", orgId: "org" } });
    expect(finalize).toHaveBeenCalledWith("period", "org", "current-user", undefined, { confirmMissingCogs: true });
  });

  it.each(["VIEWER", "MEMBER", "UNKNOWN"])("blocks %s before reading the wizard period", async role => {
    membership.mockResolvedValue({ orgId: "org", userId: "user", role });
    expect((await wizard()).status).toBe(403);
    expect(findPeriod).not.toHaveBeenCalled();
    expect(finalize).not.toHaveBeenCalled();
  });

  it("cannot finalize another tenant's period", async () => {
    findPeriod.mockResolvedValue(null);
    expect((await wizard()).status).toBe(404);
    expect(finalize).not.toHaveBeenCalled();
  });

  it.each(["{", "null", "[]", '{"force":true}', '{"confirmMissingCogs":"true"}', '{"orgId":"foreign"}'])
    ("rejects malformed or unsupported wizard parameters %s", async body => {
      expect((await wizard(body)).status).toBe(400);
      expect(finalize).not.toHaveBeenCalled();
    });

  it.each(["{", "null", "[]", '{"force":"false"}', '{"extra":true}'])
    ("rejects malformed or unsupported direct-close parameters %s", async body => {
      const response = await POST(new NextRequest("http://localhost/api/periods/period/close", {
        method: "POST", body,
      }), { params: Promise.resolve({ id: "period" }) });
      expect(response.status).toBe(400);
      expect(finalize).not.toHaveBeenCalled();
    });

  it("maps currency validation to 400 and preserves the explicit missing-COGS conflict", async () => {
    finalize.mockRejectedValueOnce(new PostingValidationError("Unsupported currency"));
    const response = await wizard();
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Unsupported currency" });
    finalize.mockRejectedValueOnce(new MissingCogsError("Missing COGS"));
    const conflict = await wizard();
    expect(conflict.status).toBe(409);
    expect(await conflict.json()).toEqual({ error: "Missing COGS", code: "MISSING_COGS" });
  });

  it("preserves bodyless wizard requests without treating broken JSON as empty", async () => {
    expect((await wizard("")).status).toBe(200);
    expect(finalize).toHaveBeenCalledWith("period", "org", "user", undefined, { confirmMissingCogs: false });
  });
});
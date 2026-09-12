import { beforeEach, describe, expect, it, vi } from "vitest";
import { getActiveMembership, getActiveOrgId } from "@/lib/context";

const { getSessionFromCookie, findMembership } = vi.hoisted(() => ({
  getSessionFromCookie: vi.fn(), findMembership: vi.fn()
}));
vi.mock("@/lib/auth", () => ({ getSessionFromCookie }));
vi.mock("@/lib/prisma", () => ({ default: { orgMember: { findFirst: findMembership } } }));

describe("active organization membership", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getSessionFromCookie.mockResolvedValue({ userId: "user-1", activeOrgId: "org-1" });
    findMembership.mockResolvedValue({ userId: "user-1", orgId: "org-1", role: "ACCOUNTANT" });
  });

  it("validates both user and organization before returning an ID", async () => {
    expect(await getActiveOrgId()).toBe("org-1");
    expect(findMembership).toHaveBeenCalledWith({
      where: { userId: "user-1", orgId: "org-1" }, include: { org: true }
    });
  });

  it("immediately rejects revoked membership with an unchanged session", async () => {
    expect(await getActiveOrgId()).toBe("org-1");
    findMembership.mockResolvedValue(null);
    await expect(getActiveOrgId()).rejects.toThrow("FORBIDDEN");
  });

  it("does not cache the old role", async () => {
    expect((await getActiveMembership()).role).toBe("ACCOUNTANT");
    findMembership.mockResolvedValue({ userId: "user-1", orgId: "org-1", role: "VIEWER" });
    expect((await getActiveMembership()).role).toBe("VIEWER");
  });

  it("rejects a missing session without querying membership", async () => {
    getSessionFromCookie.mockResolvedValue(null);
    await expect(getActiveOrgId()).rejects.toThrow("UNAUTHORIZED");
    expect(findMembership).not.toHaveBeenCalled();
  });

  it("rejects a session without an active organization", async () => {
    getSessionFromCookie.mockResolvedValue({ userId: "user-1", activeOrgId: null });
    await expect(getActiveOrgId()).rejects.toThrow("NO_ACTIVE_ORG");
    expect(findMembership).not.toHaveBeenCalled();
  });
});
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import nodemailer from "nodemailer";
import { isMailConfigured, sendInviteEmail, sendPasswordResetEmail } from "@/lib/mailer";

describe("mail dependency compatibility", () => {
  const createTransport = nodemailer.createTransport;

  beforeEach(() => {
    vi.stubEnv("SMTP_HOST", "smtp.example.test");
    vi.stubEnv("SMTP_PORT", "587");
    vi.stubEnv("SMTP_USER", "sender@example.test");
    vi.stubEnv("SMTP_PASS", "test-only");
    vi.stubEnv("SMTP_FROM", "sender@example.test");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.example.test");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it.each(["reset", "invite"] as const)("renders the %s email through the real MIME encoder without network", async kind => {
    const transport = createTransport({ streamTransport: true, buffer: true });
    const sendMail = vi.spyOn(transport, "sendMail");
    const factory = vi.spyOn(nodemailer, "createTransport").mockReturnValue(
      transport as unknown as ReturnType<typeof createTransport>,
    );

    const sent = kind === "reset"
      ? await sendPasswordResetEmail("recipient@example.test", "https://app.example.test/reset?token=synthetic", 2)
      : await sendInviteEmail("recipient@example.test", "Test organization", "synthetic-password");

    expect(sent).toBe(true);
    expect(factory).toHaveBeenCalledWith({
      host: "smtp.example.test", port: 587, secure: false,
      auth: { user: "sender@example.test", pass: "test-only" },
    });
    expect(sendMail).toHaveBeenCalledTimes(1);
    const result = await sendMail.mock.results[0].value;
    expect(result.envelope.to).toEqual(["recipient@example.test"]);
    expect(result.message.toString()).toContain("multipart/alternative");
    expect(result.message.toString()).toContain("recipient@example.test");
  });

  it("returns false without attempting delivery when SMTP is not configured", async () => {
    vi.stubEnv("SMTP_HOST", "");
    const factory = vi.spyOn(nodemailer, "createTransport");
    expect(isMailConfigured()).toBe(false);
    expect(await sendPasswordResetEmail("recipient@example.test", "https://app.example.test/reset", 1)).toBe(false);
    expect(await sendInviteEmail("recipient@example.test", "Test", "synthetic-password")).toBe(false);
    expect(factory).not.toHaveBeenCalled();
  });

  it("propagates delivery errors instead of reporting success", async () => {
    const transport = createTransport({ streamTransport: true, buffer: true });
    vi.spyOn(transport, "sendMail").mockRejectedValue(new Error("synthetic delivery failure"));
    vi.spyOn(nodemailer, "createTransport").mockReturnValue(
      transport as unknown as ReturnType<typeof createTransport>,
    );
    await expect(sendPasswordResetEmail("recipient@example.test", "https://app.example.test/reset", 1))
      .rejects.toThrow("synthetic delivery failure");
  });
});
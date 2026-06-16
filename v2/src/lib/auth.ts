import { SignJWT } from "jose";
import { cookies } from "next/headers";
export { COOKIE_NAME, verifySession, type SessionPayload } from "./auth-edge";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "fallback-secret-change-in-prod"
);

export async function createSession(payload: { userId: string; email: string; activeOrgId: string | null }): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(JWT_SECRET);
}

export async function getSessionFromCookie() {
  const { COOKIE_NAME, verifySession } = await import("./auth-edge");
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySession(token);
}

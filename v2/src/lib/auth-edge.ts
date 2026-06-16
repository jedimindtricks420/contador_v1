import { jwtVerify } from "jose";

export const COOKIE_NAME = "v2_session";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "fallback-secret-change-in-prod"
);

export interface SessionPayload {
  userId: string;
  email: string;
  activeOrgId: string | null;
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

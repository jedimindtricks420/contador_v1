import { cookies } from "next/headers";
import { decrypt } from "./auth";

export async function getActiveOrganizationId(): Promise<string> {
  const sessionToken = (await cookies()).get("session")?.value;
  if (!sessionToken) throw new Error("Unauthorized");

  try {
    const payload = await decrypt(sessionToken);
    return payload.organizationId;
  } catch (err) {
    throw new Error("Invalid session");
  }
}

export async function getUser(): Promise<{ id: string, email: string }> {
  const sessionToken = (await cookies()).get("session")?.value;
  if (!sessionToken) throw new Error("Unauthorized");

  try {
    const payload = await decrypt(sessionToken);
    return payload.user;
  } catch (err) {
    throw new Error("Invalid session");
  }
}

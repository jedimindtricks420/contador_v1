import { cookies } from "next/headers";
import { decrypt } from "./auth";

import prisma from "./prisma";

export async function getActiveOrganizationId(): Promise<string> {
  const sessionToken = (await cookies()).get("session")?.value;
  if (!sessionToken) throw new Error("Unauthorized");

  const payload = await decrypt(sessionToken);
  const userId = payload.user?.id;
  if (!userId) throw new Error("Invalid session");

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { active_org_id: true }
  });

  if (!user?.active_org_id) {
    throw new Error("No active organization found for user");
  }

  return user.active_org_id;
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

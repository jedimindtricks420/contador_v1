import { getSessionFromCookie } from "./auth";
import prisma from "./prisma";

export async function getSession() {
  const session = await getSessionFromCookie();
  if (!session) throw new Error("UNAUTHORIZED");
  return session;
}

export async function getUser() {
  const session = await getSession();
  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user) throw new Error("UNAUTHORIZED");
  return user;
}

export async function getActiveOrgId(): Promise<string> {
  const session = await getSession();
  if (!session.activeOrgId) throw new Error("NO_ACTIVE_ORG");
  return session.activeOrgId;
}

export async function getActiveMembership() {
  const session = await getSession();
  const orgId = session.activeOrgId;
  if (!orgId) throw new Error("NO_ACTIVE_ORG");

  const membership = await prisma.orgMember.findFirst({
    where: { userId: session.userId, orgId },
    include: { org: true },
  });
  if (!membership) throw new Error("FORBIDDEN");
  return membership;
}

export function unauthorized(message = "Не авторизован") {
  return Response.json({ error: message }, { status: 401 });
}

export function forbidden(message = "Нет доступа") {
  return Response.json({ error: message }, { status: 403 });
}

export function badRequest(message: string) {
  return Response.json({ error: message }, { status: 400 });
}

export function notFound(message = "Не найдено") {
  return Response.json({ error: message }, { status: 404 });
}

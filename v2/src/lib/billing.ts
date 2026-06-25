import prisma from "./prisma";

export async function getUserActivePro(
  userId: string
): Promise<{ isPro: boolean; validUntil: Date | null }> {
  const memberships = await prisma.orgMember.findMany({
    where: { userId },
    select: { orgId: true },
  });
  const orgIds = memberships.map((m) => m.orgId);
  if (orgIds.length === 0) return { isPro: false, validUntil: null };

  const now = new Date();
  const bestSub = await prisma.subscription.findFirst({
    where: {
      orgId: { in: orgIds },
      plan: "PRO",
      validUntil: { gt: now },
    },
    orderBy: { validUntil: "desc" },
  });

  return {
    isPro: !!bestSub,
    validUntil: bestSub?.validUntil ?? null,
  };
}

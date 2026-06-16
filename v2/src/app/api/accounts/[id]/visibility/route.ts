import { NextRequest, NextResponse } from "next/server";
import { prismaWithOrg } from "@/lib/prisma";
import { getActiveOrgId } from "@/lib/context";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const orgId = await getActiveOrgId();
    if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: accountId } = await params;
    const body = await req.json();
    const { isHidden } = body;

    const org = await prismaWithOrg(orgId).organization.findUnique({
      where: { id: orgId },
      select: { settings: true },
    });

    const settings = (org?.settings as Record<string, any>) || {};
    let hiddenAccounts: string[] = settings.hiddenAccounts || [];

    if (isHidden && !hiddenAccounts.includes(accountId)) {
      hiddenAccounts.push(accountId);
    } else if (!isHidden) {
      hiddenAccounts = hiddenAccounts.filter(id => id !== accountId);
    }

    const updatedSettings = {
      ...settings,
      hiddenAccounts,
    };

    await prismaWithOrg(orgId).organization.update({
      where: { id: orgId },
      data: { settings: updatedSettings },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("PATCH /api/accounts/[id]/visibility error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

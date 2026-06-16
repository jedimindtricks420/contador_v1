import { NextRequest, NextResponse } from "next/server";
import { prismaWithOrg } from "@/lib/prisma";
import { getActiveOrgId } from "@/lib/context";

export async function GET(req: NextRequest) {
  try {
    const orgId = await getActiveOrgId();
    if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const org = await prismaWithOrg(orgId).organization.findUnique({
      where: { id: orgId },
      select: { settings: true },
    });

    const settings = (org?.settings as Record<string, any>) || {};
    const deadlines = settings.openItemDeadlines || {
      "4310": 30, // Авансы выданные
      "6310": 30, // Авансы полученные
      "4220": 10, // Подотчетные
      "5110_UNIDENTIFIED": 5, // Невыясненные
    };

    return NextResponse.json(deadlines);
  } catch (error) {
    console.error("GET /api/settings/open-item-deadlines error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const orgId = await getActiveOrgId();
    if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const deadlines = await req.json();

    const org = await prismaWithOrg(orgId).organization.findUnique({
      where: { id: orgId },
      select: { settings: true },
    });

    const settings = (org?.settings as Record<string, any>) || {};
    const updatedSettings = {
      ...settings,
      openItemDeadlines: deadlines,
    };

    await prismaWithOrg(orgId).organization.update({
      where: { id: orgId },
      data: { settings: updatedSettings },
    });

    return NextResponse.json(updatedSettings.openItemDeadlines);
  } catch (error) {
    console.error("PATCH /api/settings/open-item-deadlines error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

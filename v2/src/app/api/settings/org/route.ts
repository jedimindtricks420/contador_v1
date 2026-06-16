import { NextRequest, NextResponse } from "next/server";
import { getActiveOrgId } from "@/lib/context";
import { prismaWithOrg } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const orgId = await getActiveOrgId();
    if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const org = await prismaWithOrg(orgId).organization.findUnique({
      where: { id: orgId },
      select: {
        name: true,
        inn: true,
        taxRegime: true,
        isVatPayer: true,
        activityGroup: true,
        activityDescription: true,
        activityCustom: true,
        aiConfidenceThreshold: true,
        maxClarificationQuestions: true,
      },
    });

    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    return NextResponse.json(org);
  } catch (error) {
    console.error("GET /api/settings/org error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const orgId = await getActiveOrgId();
    if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();

    const updatedOrg = await prismaWithOrg(orgId).organization.update({
      where: { id: orgId },
      data: {
        name: body.name,
        inn: body.inn,
        taxRegime: body.taxRegime,
        isVatPayer: body.isVatPayer,
        activityGroup: body.activityGroup ?? null,
        activityDescription: body.activityDescription ?? null,
        activityCustom: body.activityCustom ?? null,
        aiConfidenceThreshold: body.aiConfidenceThreshold,
        maxClarificationQuestions: body.maxClarificationQuestions,
      },
    });

    return NextResponse.json(updatedOrg);
  } catch (error) {
    console.error("PATCH /api/settings/org error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

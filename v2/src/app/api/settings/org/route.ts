import { NextRequest, NextResponse } from "next/server";
import { getActiveOrgId, getActiveMembership } from "@/lib/context";
import { prismaWithOrg } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const orgId = await getActiveOrgId();

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
        turnoverTaxRate: true,
      },
    });

    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    return NextResponse.json(org);
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED" || error.message === "NO_ACTIVE_ORG")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    console.error("GET /api/settings/org error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const orgId = await getActiveOrgId();

    const membership = await getActiveMembership();
    if (membership.role !== "OWNER" && membership.role !== "ADMIN") {
      return NextResponse.json({ error: "Only admins can update org settings" }, { status: 403 });
    }

    const body = await req.json();

    const turnoverTaxRate = body.turnoverTaxRate !== undefined
      ? Math.max(0.01, Math.min(0.04, Number(body.turnoverTaxRate)))
      : undefined;

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
        ...(turnoverTaxRate !== undefined && { turnoverTaxRate }),
      },
    });

    return NextResponse.json(updatedOrg);
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED" || error.message === "NO_ACTIVE_ORG")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    console.error("PATCH /api/settings/org error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

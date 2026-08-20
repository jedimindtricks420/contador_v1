import { NextRequest, NextResponse } from "next/server";
import { getActiveOrgId, getActiveMembership } from "@/lib/context";
import { prismaWithOrg } from "@/lib/prisma";
import { TURNOVER_TAX_RATE_MIN, TURNOVER_TAX_RATE_MAX } from "@/lib/constants";

export async function GET() {
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
        taxBenefit: true,
        itParkResidentSince: true,
        itParkCertificateNumber: true,
        avgHeadcount: true,
        avgHeadcountDisabled: true,
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
      ? Math.max(TURNOVER_TAX_RATE_MIN, Math.min(TURNOVER_TAX_RATE_MAX, Number(body.turnoverTaxRate)))
      : undefined;

    // Льгота IT Park (эпик, Фаза 1 — только поля настроек, ТЗ 7.1) и поля
    // шапки «Расчёта налога на прибыль» (среднегодовая численность).
    if (body.taxBenefit !== undefined && body.taxBenefit !== "NONE" && body.taxBenefit !== "IT_PARK_RESIDENT") {
      return NextResponse.json({ error: "taxBenefit должен быть NONE или IT_PARK_RESIDENT" }, { status: 400 });
    }
    const itParkResidentSince = body.itParkResidentSince !== undefined
      ? (body.itParkResidentSince ? new Date(body.itParkResidentSince) : null)
      : undefined;
    if (itParkResidentSince && isNaN(itParkResidentSince.getTime())) {
      return NextResponse.json({ error: "Некорректная дата itParkResidentSince" }, { status: 400 });
    }
    const avgHeadcount = body.avgHeadcount !== undefined ? Math.max(0, Math.trunc(Number(body.avgHeadcount) || 0)) : undefined;
    const avgHeadcountDisabled = body.avgHeadcountDisabled !== undefined ? Math.max(0, Math.trunc(Number(body.avgHeadcountDisabled) || 0)) : undefined;

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
        ...(body.taxBenefit !== undefined && { taxBenefit: body.taxBenefit }),
        ...(itParkResidentSince !== undefined && { itParkResidentSince }),
        ...(body.itParkCertificateNumber !== undefined && { itParkCertificateNumber: body.itParkCertificateNumber || null }),
        ...(avgHeadcount !== undefined && { avgHeadcount }),
        ...(avgHeadcountDisabled !== undefined && { avgHeadcountDisabled }),
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

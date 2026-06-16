import { NextRequest, NextResponse } from "next/server";
import { prismaWithOrg } from "@/lib/prisma";
import { getActiveOrgId } from "@/lib/context";

export async function GET(req: NextRequest) {
  try {
    const orgId = await getActiveOrgId();
    if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const templates = await prismaWithOrg(orgId).taxDeadlineTemplate.findMany({
      where: { orgId },
      orderBy: { type: "asc" },
    });

    return NextResponse.json(templates);
  } catch (error) {
    console.error("GET /api/settings/tax-deadlines error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const orgId = await getActiveOrgId();
    if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const template = await prismaWithOrg(orgId).taxDeadlineTemplate.create({
      data: {
        orgId,
        type: body.type,
        dayOfMonth: body.dayOfMonth,
        frequency: body.frequency,
        taxRegime: body.taxRegime || null,
        isActive: body.isActive ?? true,
      },
    });

    return NextResponse.json(template, { status: 201 });
  } catch (error) {
    console.error("POST /api/settings/tax-deadlines error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const orgId = await getActiveOrgId();
    if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { id, ...data } = body;

    const template = await prismaWithOrg(orgId).taxDeadlineTemplate.update({
      where: { id },
      data: {
        dayOfMonth: data.dayOfMonth,
        frequency: data.frequency,
        isActive: data.isActive,
      },
    });

    return NextResponse.json(template);
  } catch (error) {
    console.error("PUT /api/settings/tax-deadlines error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const orgId = await getActiveOrgId();
    if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const existing = await prismaWithOrg(orgId).taxDeadlineTemplate.findFirst({
      where: { id, orgId },
    });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await prismaWithOrg(orgId).taxDeadlineTemplate.delete({
      where: { id },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/settings/tax-deadlines error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

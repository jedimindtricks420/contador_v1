import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getActiveOrgId } from "@/lib/context";
import { clearRulesCache } from "@/lib/classification/rulesEngine";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const orgId = await getActiveOrgId();
    const { matchType, matchValue, categoryId, direction } = await req.json();

    // Verify ownership
    const rule = await prisma.rule.findFirst({
      where: { id, orgId }
    });

    if (!rule) {
      return NextResponse.json({ error: "Правило не найдено" }, { status: 404 });
    }

    const updated = await prisma.rule.update({
      where: { id, orgId },
      data: {
        matchType: matchType || undefined,
        matchValue: matchValue || undefined,
        categoryId: categoryId || undefined,
        direction: direction !== undefined ? (direction || null) : undefined
      }
    });

    clearRulesCache(orgId);
    return NextResponse.json(updated);
  } catch (err: any) {
    console.error("PUT RULE ERROR:", err);
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const orgId = await getActiveOrgId();

    const rule = await prisma.rule.findFirst({
      where: { id, orgId }
    });

    if (!rule) {
      return NextResponse.json({ error: "Правило не найдено" }, { status: 404 });
    }

    await prisma.rule.delete({
      where: { id, orgId }
    });

    clearRulesCache(orgId);
    return NextResponse.json({ deleted: true });
  } catch (err: any) {
    console.error("DELETE RULE ERROR:", err);
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}

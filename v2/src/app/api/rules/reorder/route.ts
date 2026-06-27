import { NextRequest, NextResponse } from "next/server";
import { prismaWithOrg } from "@/lib/prisma";
import { getActiveOrgId } from "@/lib/context";
import { clearRulesCache } from "@/lib/classification/rulesEngine";

export async function PATCH(req: NextRequest) {
  try {
    const orgId = await getActiveOrgId();
    if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { ids } = body as { ids: string[] };

    if (!Array.isArray(ids)) {
      return NextResponse.json({ error: "ids must be an array of rule IDs" }, { status: 400 });
    }

    // Use a single extended client instance so $transaction and the queries
    // belong to the same client (required by Prisma's batch-transaction API).
    const client = prismaWithOrg(orgId);
    const updatePromises = ids.map((id, index) =>
      client.rule.update({
        where: { id },
        data: { order: index },
      })
    );

    await client.$transaction(updatePromises);

    clearRulesCache(orgId);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("PATCH /api/rules/reorder error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

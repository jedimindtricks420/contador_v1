import { NextRequest, NextResponse } from "next/server";
import { getActiveMembership } from "@/lib/context";
import prisma from "@/lib/prisma";

const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };

export async function GET(req: NextRequest) {
  try {
    const { orgId } = await getActiveMembership();
    const documentId = req.nextUrl.searchParams.get("documentId");
    const cursor = req.nextUrl.searchParams.get("cursor");
    if (!documentId || documentId.length > 100 || (cursor !== null && (!cursor || cursor.length > 100))) {
      return NextResponse.json({ error: "Invalid document or cursor" }, { status: 400, headers });
    }
    const scope = { orgId, documentId };
    const anchor = cursor ? await prisma.postingRevision.findFirst({
      where: { ...scope, id: cursor }, select: { revision: true },
    }) : null;
    if (cursor && !anchor) return NextResponse.json({ error: "Revision not found" }, { status: 404, headers });
    const revisions = await prisma.postingRevision.findMany({
      where: { ...scope, ...(anchor ? { revision: { lt: anchor.revision } } : {}) },
      orderBy: { revision: "desc" }, take: 21,
      select: {
        id: true, documentId: true, periodId: true, revision: true, previousId: true,
        action: true, createdBy: true, createdAt: true, snapshotHash: true,
      },
    });
    return NextResponse.json({ revisions: revisions.slice(0, 20), nextCursor: revisions.length > 20 ? revisions[19].id : null }, { headers });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const status = message === "UNAUTHORIZED" ? 401 : ["FORBIDDEN", "NO_ACTIVE_ORG"].includes(message) ? 403 : 500;
    return NextResponse.json({ error: status === 500 ? "Failed to load posting archive" : "Access denied" }, { status, headers });
  }
}
import { createHash } from "node:crypto";
import type { PostingRevision } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { getActiveMembership } from "@/lib/context";
import prisma from "@/lib/prisma";

const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };

export async function GET(_req: NextRequest, { params }: { params: Promise<{ revisionId: string }> }) {
  try {
    const { orgId } = await getActiveMembership();
    const { revisionId } = await params;
    if (!revisionId || revisionId.length > 100) {
      return NextResponse.json({ error: "Invalid revision" }, { status: 400, headers });
    }
    const [revision] = await prisma.$queryRaw<(Omit<PostingRevision, "snapshot"> & { snapshotCanonical: string })[]>`
      SELECT "id", "orgId", "documentId", "periodId", "revision", "previousId",
        "action", "createdBy", "createdAt", "snapshotHash", "snapshot"::text AS "snapshotCanonical"
      FROM "PostingRevision" WHERE "id" = ${revisionId} AND "orgId" = ${orgId}
    `;
    if (!revision) return NextResponse.json({ error: "Revision not found" }, { status: 404, headers });
    if (createHash("sha256").update(revision.snapshotCanonical, "utf8").digest("hex") !== revision.snapshotHash) {
      return NextResponse.json({ error: "Posting archive integrity check failed" }, { status: 409, headers });
    }
    return NextResponse.json({ exportVersion: "posting-revision-v1", revision }, {
      headers: { ...headers, "Content-Disposition": 'attachment; filename="posting-revision.json"' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const status = message === "UNAUTHORIZED" ? 401 : ["FORBIDDEN", "NO_ACTIVE_ORG"].includes(message) ? 403 : 500;
    return NextResponse.json({ error: status === 500 ? "Failed to export posting archive" : "Access denied" }, { status, headers });
  }
}
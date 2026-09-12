import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getActiveMembership } from "@/lib/context";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest, { params }: { params: Promise<{ batchId: string }> }) {
  try {
    const { orgId } = await getActiveMembership();
    const format = req.nextUrl.searchParams.get("format") ?? "protocol";
    if (format !== "source" && format !== "protocol") {
      return NextResponse.json({ error: "Формат должен быть source или protocol" }, { status: 400 });
    }
    const { batchId } = await params;
    const batch = await prisma.soliqImportBatch.findFirst({
      where: { id: batchId, orgId, period: { orgId } },
    });
    if (!batch) return NextResponse.json({ error: "Пакет Soliq не найден" }, { status: 404 });
    if (createHash("sha256").update(batch.sourceData).digest("hex") !== batch.sourceHash) {
      return NextResponse.json({ error: "Хеш источника Soliq не совпадает" }, { status: 409 });
    }
    const headers = {
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": 'attachment; filename="soliq-protocol.json"',
    };
    if (format === "source") {
      const filename = encodeURIComponent(batch.sourceName).replace(/['()*]/g,
        character => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
      return new NextResponse(new Uint8Array(batch.sourceData), {
        headers: {
          ...headers,
          "Content-Type": "application/octet-stream",
          "Content-Disposition": `attachment; filename="soliq-source.bin"; filename*=UTF-8''${filename}`,
        },
      });
    }
    return NextResponse.json({
      exportVersion: "soliq-audit-v1",
      batch: {
        id: batch.id, orgId: batch.orgId, periodId: batch.periodId,
        sourceName: batch.sourceName, sourceHash: batch.sourceHash,
        sourceSize: batch.sourceData.byteLength, parserVersion: batch.parserVersion,
        rows: batch.rows, totals: batch.totals, status: batch.status,
        createdBy: batch.createdBy, createdAt: batch.createdAt,
        postedBy: batch.postedBy, postedAt: batch.postedAt, result: batch.result,
      },
    }, { headers });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal error";
    const status = message === "UNAUTHORIZED" ? 401 : ["FORBIDDEN", "NO_ACTIVE_ORG"].includes(message) ? 403 : 500;
    return NextResponse.json({ error: status === 500 ? "Не удалось выгрузить пакет Soliq" : message }, { status });
  }
}
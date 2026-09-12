import { NextRequest, NextResponse } from "next/server";
import { getActiveMembership } from "@/lib/context";
import prisma from "@/lib/prisma";
import { bankSourceHash } from "@/lib/bankImportBatch";
import { BANK_UPLOAD_MAX_FILE_BYTES } from "@/lib/bankUpload";

const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };

export async function GET(req: NextRequest, { params }: { params: Promise<{ batchId: string }> }) {
  try {
    const { orgId } = await getActiveMembership();
    const format = req.nextUrl.searchParams.get("format") ?? "protocol";
    if (format !== "source" && format !== "protocol") return NextResponse.json({ error: "Формат должен быть source или protocol" }, { status: 400, headers });
    const { batchId } = await params;
    const batch = await prisma.bankImportBatch.findFirst({ where: { id: batchId, orgId, bankAccount: { orgId } } });
    if (!batch) return NextResponse.json({ error: "Партия не найдена" }, { status: 404, headers });
    if (!batch.sourceData.byteLength || batch.sourceData.byteLength > BANK_UPLOAD_MAX_FILE_BYTES || bankSourceHash(batch.sourceData) !== batch.sourceHash) {
      return NextResponse.json({ error: "Нарушена целостность исходной выписки", code: "BANK_SOURCE_INTEGRITY" }, { status: 409, headers });
    }
    if (format === "source") {
      const name = batch.sourceName.split(/[\\/]/).pop()?.replace(/[\u0000-\u001f\u007f]/g, "") || "bank.txt";
      const filename = encodeURIComponent(name).replace(/['()*]/g, character => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
      return new NextResponse(new Uint8Array(batch.sourceData), { headers: {
        ...headers, "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="bank-source.txt"; filename*=UTF-8''${filename}`,
      } });
    }
    return NextResponse.json({ exportVersion: "bank-audit-v1", batch: {
      id: batch.id, orgId: batch.orgId, bankAccountId: batch.bankAccountId, bankCurrency: batch.bankCurrency,
      sourceName: batch.sourceName, sourceHash: batch.sourceHash, sourceSize: batch.sourceData.byteLength,
      parserVersion: batch.parserVersion, rows: batch.rows, statement: batch.statement, result: batch.result,
      status: batch.status, createdBy: batch.createdBy, createdAt: batch.createdAt,
      rolledBackBy: batch.rolledBackBy, rolledBackAt: batch.rolledBackAt, rollbackAuditId: batch.rollbackAuditId,
    } }, { headers: { ...headers, "Content-Disposition": 'attachment; filename="bank-protocol.json"' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const status = message === "UNAUTHORIZED" ? 401 : ["FORBIDDEN", "NO_ACTIVE_ORG"].includes(message) ? 403 : 500;
    return NextResponse.json({ error: status === 500 ? "Не удалось выгрузить архив банка" : "Нет доступа" }, { status, headers });
  }
}
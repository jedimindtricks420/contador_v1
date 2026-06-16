import { NextRequest, NextResponse } from "next/server";
import { getActiveMembership, badRequest } from "@/lib/context";
import prisma from "@/lib/prisma";
import { repostDocument } from "@/lib/posting/postingEngine";

export async function POST(req: NextRequest) {
  try {
    const membership = await getActiveMembership();

    const { documentId, newDocumentTypeId } = await req.json();
    if (!documentId || !newDocumentTypeId) {
      return badRequest("Параметры 'documentId' и 'newDocumentTypeId' обязательны");
    }

    const doc = await prisma.document.findFirst({
      where: { id: documentId, orgId: membership.orgId }
    });

    if (!doc) {
      return badRequest("Документ не найден в вашей организации");
    }

    // Verify document type exists
    const docType = await prisma.documentType.findUnique({
      where: { id: newDocumentTypeId }
    });

    if (!docType) {
      return badRequest("Указанный тип документа не найден");
    }

    const result = await prisma.$transaction(async (tx) => {
      return repostDocument(documentId, newDocumentTypeId, tx, membership.userId);
    });

    return NextResponse.json({ success: true, journalEntries: result.journalEntries });
  } catch (err: any) {
    console.error("REPOST DOCUMENT API ERROR:", err);
    if (err.message === "UNAUTHORIZED") {
      return Response.json({ error: "Не авторизован" }, { status: 401 });
    }
    if (err.message === "FORBIDDEN" || err.message === "NO_ACTIVE_ORG") {
      return Response.json({ error: "Нет доступа" }, { status: 403 });
    }
    return NextResponse.json({ error: err.message || "Внутренняя ошибка сервера" }, { status: 500 });
  }
}

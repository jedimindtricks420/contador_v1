import { NextRequest, NextResponse } from "next/server";
import { getActiveMembership, badRequest } from "@/lib/context";
import prisma from "@/lib/prisma";
import { postDocument } from "@/lib/posting/postingEngine";

export async function POST(req: NextRequest) {
  try {
    const membership = await getActiveMembership();

    const { documentId } = await req.json();
    if (!documentId) {
      return badRequest("Параметр 'documentId' обязателен");
    }

    const doc = await prisma.document.findFirst({
      where: { id: documentId, orgId: membership.orgId }
    });

    if (!doc) {
      return badRequest("Документ не найден в вашей организации");
    }

    const result = await prisma.$transaction(async (tx) => {
      return postDocument(documentId, tx, membership.userId);
    });

    return NextResponse.json(result);
  } catch (err: any) {
    console.error("POST DOCUMENT API ERROR:", err);
    if (err.message === "UNAUTHORIZED") {
      return Response.json({ error: "Не авторизован" }, { status: 401 });
    }
    if (err.message === "FORBIDDEN" || err.message === "NO_ACTIVE_ORG") {
      return Response.json({ error: "Нет доступа" }, { status: 403 });
    }
    return NextResponse.json({ error: err.message || "Внутренняя ошибка сервера" }, { status: 500 });
  }
}

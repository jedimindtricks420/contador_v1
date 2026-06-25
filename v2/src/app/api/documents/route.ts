import { NextRequest, NextResponse } from "next/server";
import { getActiveMembership } from "@/lib/context";
import prisma from "@/lib/prisma";
import { postDocument } from "@/lib/posting/postingEngine";

export async function GET(req: NextRequest) {
  try {
    const membership = await getActiveMembership();
    const { searchParams } = new URL(req.url);

    const periodId = searchParams.get("periodId") || undefined;
    const typeCode = searchParams.get("typeCode") || undefined;
    const status = searchParams.get("status") || undefined;
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(100, parseInt(searchParams.get("limit") || "50"));

    const where: any = { orgId: membership.orgId };
    if (periodId) where.periodId = periodId;
    if (typeCode) where.type = { code: typeCode };
    if (status) where.status = status;

    const [total, documents] = await Promise.all([
      prisma.document.count({ where }),
      prisma.document.findMany({
        where,
        include: {
          type: { select: { id: true, code: true, name: true } },
          period: { select: { year: true, month: true } },
          journalEntries: {
            include: { account: { select: { code: true, name: true } } },
            take: 10
          }
        },
        orderBy: { date: "desc" },
        skip: (page - 1) * limit,
        take: limit
      })
    ]);

    return NextResponse.json({
      total,
      pages: Math.ceil(total / limit),
      documents
    });
  } catch (err: any) {
    console.error("GET DOCUMENTS ERROR:", err);
    if (err.message === "UNAUTHORIZED") return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const membership = await getActiveMembership();
    const body = await req.json();

    const { typeId, periodId, date, payload } = body;
    if (!typeId || !periodId || !date) {
      return NextResponse.json({ error: "typeId, periodId, date обязательны" }, { status: 400 });
    }

    // Verify period belongs to org and is not closed
    const period = await prisma.period.findFirst({
      where: { id: periodId, orgId: membership.orgId }
    });
    if (!period) return NextResponse.json({ error: "Период не найден" }, { status: 404 });
    if (period.status === "CLOSED") {
      return NextResponse.json({ error: "Период закрыт — нельзя создавать документы" }, { status: 409 });
    }

    // Verify type exists
    const docType = await prisma.documentType.findUnique({ where: { id: typeId } });
    if (!docType) return NextResponse.json({ error: "Тип документа не найден" }, { status: 404 });

    const doc = await prisma.$transaction(async (tx) => {
      const created = await tx.document.create({
        data: {
          orgId: membership.orgId,
          periodId,
          typeId,
          date: new Date(date),
          status: "POSTED",
          payload: payload || {}
        }
      });
      await postDocument(created.id, tx, membership.userId);
      return created;
    });

    return NextResponse.json({ id: doc.id, status: doc.status }, { status: 201 });
  } catch (err: any) {
    console.error("POST DOCUMENT ERROR:", err);
    if (err.message === "UNAUTHORIZED") return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

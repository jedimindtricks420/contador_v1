import { NextRequest, NextResponse } from "next/server";
import { getActiveOrgId, getUser } from "@/lib/context";
import prisma from "@/lib/prisma";
import { postDocument } from "@/lib/posting/postingEngine";
import { upsertTaxCalendarEventsForPeriod } from "@/lib/closing";
import { TAX_RATES, ACCOUNTS } from "@/lib/constants";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ periodId: string }> }
) {
  try {
    const { periodId } = await params;
    const orgId = await getActiveOrgId();

    const period = await prisma.period.findFirst({ where: { id: periodId, orgId } });
    if (!period) {
      return NextResponse.json({ error: "Период не найден" }, { status: 404 });
    }

    const openItems = await prisma.openItem.findMany({
      where: {
        orgId,
        affectedPeriodId: periodId,
        status: { in: ["OPEN", "RISK"] },
        account: { code: { in: [ACCOUNTS.ADVANCE_RECEIVED, ACCOUNTS.ADVANCE_PAID_GOODS] } }
      },
      include: { counterparty: true, account: true }
    });

    return NextResponse.json(openItems);
  } catch (err: any) {
    console.error("GET PENDING INVOICES ERROR:", err);
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ periodId: string }> }
) {
  try {
    const { periodId } = await params;
    const orgId = await getActiveOrgId();
    const user = await getUser();

    const period = await prisma.period.findFirst({ where: { id: periodId, orgId } });
    if (!period) {
      return NextResponse.json({ error: "Период не найден" }, { status: 404 });
    }

    const body = await req.json();
    const { openItemId } = body;

    if (!openItemId) {
      return NextResponse.json({ error: "openItemId обязателен" }, { status: 400 });
    }

    const openItem = await prisma.openItem.findFirst({
      where: { id: openItemId, orgId },
      include: { counterparty: true, account: true }
    });

    if (!openItem) {
      return NextResponse.json({ error: "Открытая позиция не найдена" }, { status: 404 });
    }

    if (openItem.status === "CLOSED") {
      return NextResponse.json({ error: "Позиция уже закрыта" }, { status: 400 });
    }

    const org = await prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) {
      return NextResponse.json({ error: "Организация не найдена" }, { status: 404 });
    }

    const amount = Number(openItem.amount);
    const isVat = org.isVatPayer;
    const vatDivisor = 1 + TAX_RATES.VAT;
    const vatAmount = isVat ? Math.round((amount - (amount / vatDivisor)) * 100) / 100 : 0;

    let docTypeCode = "INVOICE_CONFIRMED_PREPAID";
    if (openItem.account.code === ACCOUNTS.ADVANCE_PAID_GOODS) {
      docTypeCode = "GOODS_RECEIVED_PREPAID";
    }

    const docType = await prisma.documentType.findUnique({
      where: { code: docTypeCode }
    });

    if (!docType) {
      return NextResponse.json({ error: `Тип документа ${docTypeCode} не найден` }, { status: 500 });
    }

    const docDate = new Date(period.year, period.month, 0); // Last day of month

    const result = await prisma.$transaction(async (tx) => {
      const doc = await tx.document.create({
        data: {
          orgId,
          periodId,
          typeId: docType.id,
          date: docDate,
          status: "POSTED",
          payload: {
            amount,
            vatAmount,
            counterpartyInn: openItem.counterparty?.inn || null,
            counterpartyHint: openItem.counterparty?.name || null
          } as any
        }
      });

      await postDocument(doc.id, tx, user.id);

      const updatedItem = await tx.openItem.update({
        where: { id: openItemId },
        data: {
          status: "CLOSED",
          closingDocumentId: doc.id,
          dateClosed: docDate
        }
      });

      return updatedItem;
    });

    // Refresh tax calendar estimates after confirming invoice
    upsertTaxCalendarEventsForPeriod(periodId, orgId).catch((e) =>
      console.error("upsertTaxCalendarEventsForPeriod after invoice confirm:", e)
    );

    return NextResponse.json(result);
  } catch (err: any) {
    console.error("POST CONFIRM INVOICE ERROR:", err);
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}

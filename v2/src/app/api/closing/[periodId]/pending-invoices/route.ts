import { NextRequest, NextResponse } from "next/server";
import { getActiveOrgId, getUser } from "@/lib/context";
import prisma from "@/lib/prisma";
import { postDocument } from "@/lib/posting/postingEngine";
import { upsertTaxCalendarEventsForPeriod } from "@/lib/closing";
import { TAX_RATES, ACCOUNTS } from "@/lib/constants";
import { receiptKindFromPaymentType, receiptDocTypeCode, saleDocTypeCode } from "@/lib/receiptKind";

class OpenItemAlreadyClosedError extends Error {
  constructor() {
    super("Позиция уже закрыта");
    this.name = "OpenItemAlreadyClosedError";
  }
}

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
      include: {
        counterparty: true,
        account: true,
        openingDocument: { include: { type: { select: { code: true } } } }
      }
    });

    // suggestedReceiptKind: подсказка «товары/услуги» — для выданных авансов (4310)
    // по категории исходного платежа; для полученных авансов (6310) надёжного
    // сигнала нет (клиентские платежи пока не классифицируются на товар/услугу),
    // поэтому дефолт "services" сохраняет прежнее поведение (выручка на 9030),
    // пока бухгалтер явно не укажет "товары" в UI.
    const items = openItems.map(item => ({
      ...item,
      suggestedReceiptKind:
        item.account.code === ACCOUNTS.ADVANCE_PAID_GOODS
          ? receiptKindFromPaymentType((item.openingDocument as any)?.type?.code)
          : item.account.code === ACCOUNTS.ADVANCE_RECEIVED
          ? "services"
          : null
    }));

    return NextResponse.json(items);
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
    const { openItemId, receiptKind } = body;

    if (!openItemId) {
      return NextResponse.json({ error: "openItemId обязателен" }, { status: 400 });
    }

    const openItem = await prisma.openItem.findFirst({
      where: { id: openItemId, orgId },
      include: {
        counterparty: true,
        account: true,
        openingDocument: { include: { type: { select: { code: true } } } }
      }
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
      // Товары или услуги: явный выбор пользователя из UI, иначе — по категории
      // исходного платежа (SUPPLIER_PAYMENT_SERVICES → услуга, Дт 9420 вместо Дт 2910).
      const kind =
        receiptKind === "goods" || receiptKind === "services"
          ? receiptKind
          : receiptKindFromPaymentType((openItem.openingDocument as any)?.type?.code);
      docTypeCode = receiptDocTypeCode(kind, true);
    } else if (openItem.account.code === ACCOUNTS.ADVANCE_RECEIVED) {
      // Товары или услуги на стороне продажи: надёжного сигнала из платежа клиента
      // нет, поэтому решает бухгалтер в UI; дефолт "services" сохраняет прежнее
      // поведение (выручка на 9030), пока явно не выбрано "товары" (9020).
      const kind = receiptKind === "goods" || receiptKind === "services" ? receiptKind : "services";
      docTypeCode = saleDocTypeCode(kind, true);
    }

    const docType = await prisma.documentType.findUnique({
      where: { code: docTypeCode }
    });

    if (!docType) {
      return NextResponse.json({ error: `Тип документа ${docTypeCode} не найден` }, { status: 500 });
    }

    const docDate = new Date(period.year, period.month, 0); // Last day of month

    const result = await prisma.$transaction(async (tx) => {
      // Lock the row and re-check status so two concurrent "confirm invoice" clicks
      // for the same openItemId can't both post a document and both try to close
      // it — the second request blocks here, then sees status already CLOSED and
      // aborts instead of creating a duplicate POSTED document (same pattern as
      // transactions/[id]/category/route.ts).
      const [lockedItem] = await tx.$queryRaw<{ status: string }[]>`
        SELECT status FROM "OpenItem" WHERE id = ${openItemId} FOR UPDATE
      `;
      if (!lockedItem || lockedItem.status === "CLOSED") {
        throw new OpenItemAlreadyClosedError();
      }

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
    if (err instanceof OpenItemAlreadyClosedError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("POST CONFIRM INVOICE ERROR:", err);
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}

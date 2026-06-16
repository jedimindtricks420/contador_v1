import { NextRequest, NextResponse } from "next/server";
import { getActiveOrgId } from "@/lib/context";
import prisma from "@/lib/prisma";
import { ensureBaseData } from "@/lib/ensureBaseData";
import { parseSoliqExcel } from "@/lib/parsers/parserSoliq";
import Decimal from "decimal.js";

export async function POST(req: NextRequest) {
  try {
    await ensureBaseData();
    const orgId = await getActiveOrgId();
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const periodId = formData.get("periodId") as string | null;

    if (!file || !periodId) {
      return NextResponse.json({ error: "file и periodId обязательны" }, { status: 400 });
    }

    const period = await prisma.period.findFirst({
      where: { id: periodId, orgId },
    });
    if (!period) {
      return NextResponse.json({ error: "Отчётный период не найден" }, { status: 404 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Parse Soliq Excel
    const parsed = parseSoliqExcel(buffer);

    if (parsed.esfItems.length === 0 && parsed.taxSummary.vat === 0 && parsed.taxSummary.turnoverTax === 0) {
      return NextResponse.json({ error: "Не удалось распознать данные в файле" }, { status: 422 });
    }

    // Ensure SOLIQ_IMPORT document type exists
    let soliqDocType = await prisma.documentType.findUnique({
      where: { code: "SOLIQ_IMPORT" }
    });
    if (!soliqDocType) {
      soliqDocType = await prisma.documentType.create({
        data: {
          code: "SOLIQ_IMPORT",
          name: "Импорт отчёта Soliq",
          postingTemplate: {}
        }
      });
    }

    // Create the Soliq Import document
    const soliqDocument = await prisma.document.create({
      data: {
        orgId,
        periodId,
        typeId: soliqDocType.id,
        date: new Date(),
        status: "POSTED",
        payload: {
          taxSummary: {
            vat: parsed.taxSummary.vat,
            outputVat: parsed.taxSummary.outputVat,
            inputVat: parsed.taxSummary.inputVat,
            turnoverTax: parsed.taxSummary.turnoverTax,
            incomeTax: parsed.taxSummary.incomeTax
          },
          expenses: parsed.expenses.length,
          revenues: parsed.revenues.length,
          totalEsfItems: parsed.esfItems.length
        } as any
      }
    });

    // Fetch all currently OPEN items for the org
    const openItems = await prisma.openItem.findMany({
      where: { orgId, status: "OPEN" },
      include: { counterparty: true }
    });

    let matched = 0;
    let unmatched = 0;
    const matchesList: any[] = [];
    const soliqOnlyList: any[] = [];

    // Reconciliation loop
    for (const esf of parsed.esfItems) {
      // Find a matching open item in memory
      const matchIndex = openItems.findIndex(item => {
        const itemInn = item.counterparty?.inn;
        const esfInn = esf.inn;
        const itemAmt = new Decimal(item.amount.toString()).toNumber();
        const esfAmt = esf.amount;
        return itemInn === esfInn && Math.abs(itemAmt - esfAmt) < 0.01;
      });

      if (matchIndex !== -1) {
        const matchedItem = openItems[matchIndex];
        // Remove from memory list so it's not matched twice
        openItems.splice(matchIndex, 1);

        // Update database
        await prisma.openItem.update({
          where: { id: matchedItem.id },
          data: {
            status: "CLOSED",
            closingDocumentId: soliqDocument.id,
            dateClosed: esf.date
          }
        });
        matched++;
        matchesList.push({
          counterpartyName: matchedItem.counterparty?.name || esf.counterpartyName,
          amount: esf.amount
        });
      } else {
        unmatched++;
        soliqOnlyList.push({
          counterpartyName: esf.counterpartyName,
          amount: esf.amount
        });
      }
    }

    const bankOnlyList = openItems.map(item => ({
      counterpartyName: item.counterparty?.name || "Неизвестный контрагент",
      amount: item.amount
    }));

    return NextResponse.json({
      matched,
      unmatched,
      taxSummary: parsed.taxSummary,
      matches: matchesList,
      bankOnly: bankOnlyList,
      soliqOnly: soliqOnlyList
    });
  } catch (err: any) {
    console.error("SOLIQ IMPORT ERROR:", err);
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}

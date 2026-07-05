import { NextRequest, NextResponse } from "next/server";
import { saveClosingState, getClosingState } from "@/lib/closing";
import prisma from "@/lib/prisma";
import { getActiveOrgId } from "@/lib/context";
import { ACCOUNTS, IMPORT, SALARY_EXPENSE_ACCOUNT_CODES } from "@/lib/constants";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ periodId: string; stepNumber: string }> }
) {
  try {
    const { periodId, stepNumber } = await params;
    const orgId = await getActiveOrgId();

    const period = await prisma.period.findFirst({ where: { id: periodId, orgId } });
    if (!period) {
      return NextResponse.json({ error: "Период не найден" }, { status: 404 });
    }
    if (period.status === "CLOSED") {
      return NextResponse.json({ error: "Период уже закрыт. Повторное выполнение шагов невозможно." }, { status: 400 });
    }

    const stepNum = parseInt(stepNumber);
    if (isNaN(stepNum) || stepNum < 1 || stepNum > 8) {
      return NextResponse.json({ error: "Неверный номер шага" }, { status: 400 });
    }
    const body = await req.json();

    if (stepNum === 4) {
      const salaryAmount = parseFloat(body.salaryAmount) || 0;
      const expenseAccountCode = body.expenseAccountCode || "";

      // Only required/validated when there's actually a salary to accrue — no
      // point rejecting a request that's just saving 0/depreciation/rent. Must be
      // explicitly chosen by the user, not silently defaulted to EXPENSE_ADMIN.
      if (salaryAmount > 0 && !SALARY_EXPENSE_ACCOUNT_CODES.includes(expenseAccountCode)) {
        return NextResponse.json(
          { error: `Укажите функцию сотрудника для начисления ЗП. Допустимые счета: ${SALARY_EXPENSE_ACCOUNT_CODES.join(", ")}` },
          { status: 400 }
        );
      }

      await saveClosingState(periodId, {
        accruals: {
          salaryAmount,
          depreciationAmount: parseFloat(body.depreciationAmount) || 0,
          rentAmount: parseFloat(body.rentAmount) || 0,
          expenseAccountCode
        }
      }, orgId);
    } else if (stepNum === 5) {
      await saveClosingState(periodId, {
        fxDiff: {
          exchangeRate: parseFloat(body.exchangeRate) || 0,
          difference: parseFloat(body.difference) || 0
        }
      }, orgId);
    } else if (stepNum === 6) {
      // Execute the Soliq reconciliation if payload is provided
      if (body.parsedPayload) {
        const { postDocument } = await import("@/lib/posting/postingEngine");
        
        // Prevent double execution
        const existingSoliqDoc = await prisma.document.findFirst({
          where: { periodId, type: { code: "SOLIQ_IMPORT" } }
        });
        
        if (existingSoliqDoc) {
          return NextResponse.json({ error: "Сверка Soliq уже была выполнена для этого периода. Отмените предыдущую загрузку, если хотите загрузить новый файл." }, { status: 400 });
        }
        
        let soliqDocType = await prisma.documentType.findUnique({
          where: { code: "SOLIQ_IMPORT" }
        });
        if (!soliqDocType) {
          soliqDocType = await prisma.documentType.create({
            data: {
              code: "SOLIQ_IMPORT",
              name: "Импорт отчёта Soliq",
              postingTemplate: {},
              mode: "MANUAL_ONLY"
            }
          });
        }
        
        const docTypes = await prisma.documentType.findMany();
        const getType = (code: string) => docTypes.find(t => t.code === code);
        
        const parsed = body.parsedPayload;
        
        // Wrap everything in a massive transaction
        await prisma.$transaction(async (tx) => {
          // 1. Create the main SOLIQ_IMPORT document
          await tx.document.create({
            data: {
              orgId,
              periodId,
              typeId: soliqDocType!.id,
              date: new Date(period.year, period.month, 0),
              status: "POSTED",
              payload: {
                taxSummary: parsed.taxSummary,
                expenses: parsed.expenses?.length || 0,
                revenues: parsed.revenues?.length || 0,
                totalEsfItems: parsed.esfItems?.length || 0
              } as any
            }
          });
          
          // 2. Process each ESF item
          for (const esf of parsed.esfItems) {
            const grossAmount = esf.amount + esf.vatAmount;
            
            if (esf.matchStatus === "MATCHED") {
              let docTypeCode = "INVOICE_CONFIRMED_PREPAID";
              let payload: any = {
                amount: grossAmount,
                vatAmount: esf.vatAmount,
                counterpartyInn: esf.inn,
                counterpartyHint: esf.counterpartyName
              };
              
              if (esf.direction === "REVENUE") {
                if (esf.matchedAccountCode === ACCOUNTS.ADVANCE_RECEIVED && (grossAmount - esf.matchedAmount > 0) && (grossAmount - esf.matchedAmount < grossAmount * IMPORT.MARKETPLACE_COMMISSION_TOLERANCE)) {
                  docTypeCode = "MARKETPLACE_REVENUE";
                  payload = {
                    netAmount: esf.matchedAmount,
                    commissionAmount: parseFloat((grossAmount - esf.matchedAmount).toFixed(2)),
                    amount: grossAmount,
                    vatAmount: esf.vatAmount,
                    counterpartyInn: esf.inn,
                    counterpartyHint: esf.counterpartyName
                  };
                } else {
                  docTypeCode = "INVOICE_CONFIRMED_PREPAID";
                }
              } else {
                docTypeCode = "GOODS_RECEIVED_PREPAID";
              }
              
              const type = getType(docTypeCode);
              if (!type) throw new Error(`Document type ${docTypeCode} not found`);
              
              const doc = await tx.document.create({
                data: {
                  orgId,
                  periodId,
                  typeId: type.id,
                  date: new Date(esf.date),
                  status: "POSTED",
                  payload: payload as any
                }
              });
              
              await postDocument(doc.id, tx, "system");

              // Close the open item only for REVENUE matches.
              // EXPENSE matches (Pass 3) reference a StagedTransaction id, not an OpenItem —
              // there is no advance position to close for outgoing supplier payments.
              if (!esf.expenseMatch) {
                const openItem = await tx.openItem.findFirst({
                  where: { id: esf.matchedOpenItemId, orgId }
                });
                if (!openItem) {
                  throw new Error(`Open item ${esf.matchedOpenItemId} not found for this organization`);
                }
                await tx.openItem.update({
                  where: { id: esf.matchedOpenItemId },
                  data: {
                    status: "CLOSED",
                    closingDocumentId: doc.id,
                    dateClosed: new Date(esf.date)
                  }
                });
              }
            } else if (esf.matchStatus === "UNMATCHED") {
              // Postpaid case
              let docTypeCode = "INVOICE_CONFIRMED";
              if (esf.direction === "EXPENSE") {
                docTypeCode = "GOODS_RECEIVED";
              }
              
              const type = getType(docTypeCode);
              if (!type) throw new Error(`Document type ${docTypeCode} not found`);
              
              const doc = await tx.document.create({
                data: {
                  orgId,
                  periodId,
                  typeId: type.id,
                  date: new Date(esf.date),
                  status: "POSTED",
                  payload: {
                    amount: grossAmount,
                    vatAmount: esf.vatAmount,
                    counterpartyInn: esf.inn,
                    counterpartyHint: esf.counterpartyName
                  } as any
                }
              });
              
              await postDocument(doc.id, tx, "system");
            }
          }
        }, {
          maxWait: 5000,
          timeout: 120000
        });
      }

      await saveClosingState(periodId, {
        soliqMatched: {
          matched: parseInt(body.matched) || 0,
          unmatched: parseInt(body.unmatched) || 0
        }
      }, orgId);
    }

    const nextStep = stepNum + 1;
    await saveClosingState(periodId, { currentStep: nextStep }, orgId);

    const updated = await getClosingState(periodId, orgId);
    return NextResponse.json({ nextStep, summary: updated });
  } catch (err: any) {
    console.error("COMPLETE STEP ERROR:", err);
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { saveClosingState, getClosingState } from "@/lib/closing";
import prisma from "@/lib/prisma";
import { getActiveOrgId } from "@/lib/context";
import { ACCOUNTS, IMPORT, SALARY_EXPENSE_ACCOUNT_CODES } from "@/lib/constants";
import { receiptKindFromPaymentType, receiptDocTypeCode, saleDocTypeCode, ReceiptKind } from "@/lib/receiptKind";

// Вид поступления по входящему ЭСФ (товары/услуги) определяется категорией
// исходного платежа: MATCHED-позиции — через связанный OpenItem/StagedTransaction,
// UNMATCHED — по последнему исходящему платежу этому же ИНН. Явный esf.receiptKind
// из фронтенда имеет приоритет.
async function resolveReceiptKind(tx: any, orgId: string, esf: any): Promise<ReceiptKind> {
  if (esf.receiptKind === "goods" || esf.receiptKind === "services") return esf.receiptKind;

  let paymentTypeCode: string | null = null;
  if (esf.matchStatus === "MATCHED" && esf.matchedOpenItemId) {
    if (esf.expenseMatch) {
      const stx = await tx.stagedTransaction.findFirst({
        where: { id: esf.matchedOpenItemId, orgId },
        include: { document: { include: { type: { select: { code: true } } } } }
      });
      paymentTypeCode = stx?.document?.type?.code ?? null;
    } else {
      const openItem = await tx.openItem.findFirst({
        where: { id: esf.matchedOpenItemId, orgId },
        include: { openingDocument: { include: { type: { select: { code: true } } } } }
      });
      paymentTypeCode = (openItem?.openingDocument as any)?.type?.code ?? null;
    }
  }
  if (!paymentTypeCode && esf.inn) {
    const stx = await tx.stagedTransaction.findFirst({
      where: { orgId, direction: "DEBIT", counterpartyInn: esf.inn, documentId: { not: null } },
      orderBy: { date: "desc" },
      include: { document: { include: { type: { select: { code: true } } } } }
    });
    paymentTypeCode = stx?.document?.type?.code ?? null;
  }
  return receiptKindFromPaymentType(paymentTypeCode);
}

// Вид реализации по исходящему ЭСФ (товары/услуги) — в отличие от закупок, у
// массового импорта из Soliq нет надёжного сигнала «категория исходного платежа
// клиента» (такой классификации на стороне продаж пока не существует), поэтому
// дефолт "services" сохраняет прежнее поведение (выручка на 9030). Явный
// esf.receiptKind с фронтенда (если появится в будущем UI) имеет приоритет —
// тот же контракт, что и resolveReceiptKind на стороне закупок.
function resolveSaleKind(esf: any): ReceiptKind {
  return esf.receiptKind === "goods" || esf.receiptKind === "services" ? esf.receiptKind : "services";
}

class SoliqAlreadyImportedError extends Error {
  constructor() {
    super("Сверка Soliq уже была выполнена для этого периода. Отмените предыдущую загрузку, если хотите загрузить новый файл.");
    this.name = "SoliqAlreadyImportedError";
  }
}

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
          // Advisory lock scoped to this period, held for the duration of the
          // transaction (auto-released on commit/rollback) — serialises concurrent
          // "complete step 6" submissions (double-click, retry, two tabs) for the
          // SAME period so the existence check right below can't race: the second
          // transaction blocks here until the first commits (or rolls back), then
          // sees the just-created SOLIQ_IMPORT document and safely aborts instead
          // of re-posting every ESF item a second time.
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('SOLIQ_IMPORT'), hashtext(${periodId}))`;

          // Prevent double execution — re-checked INSIDE the lock (the read before
          // the transaction started was a TOCTOU race: two concurrent requests could
          // both see "no existing doc" before either committed).
          const existingSoliqDoc = await tx.document.findFirst({
            where: { periodId, type: { code: "SOLIQ_IMPORT" } }
          });
          if (existingSoliqDoc) {
            throw new SoliqAlreadyImportedError();
          }

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
                  docTypeCode = saleDocTypeCode(resolveSaleKind(esf), true);
                }
              } else {
                // EXPENSE: товары или услуги — по категории исходного платежа
                const kind = await resolveReceiptKind(tx, orgId, esf);
                docTypeCode = receiptDocTypeCode(kind, true);
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
                const kind = await resolveReceiptKind(tx, orgId, esf);
                docTypeCode = receiptDocTypeCode(kind, false);
              } else {
                docTypeCode = saleDocTypeCode(resolveSaleKind(esf), false);
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
    if (err instanceof SoliqAlreadyImportedError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("COMPLETE STEP ERROR:", err);
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}

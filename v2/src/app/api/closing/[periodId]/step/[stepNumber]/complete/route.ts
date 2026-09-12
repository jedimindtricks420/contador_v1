import { NextRequest, NextResponse } from "next/server";
import { saveClosingState, getClosingState } from "@/lib/closing";
import prisma from "@/lib/prisma";
import { getActiveMembership } from "@/lib/context";
import { assertAccountingWriteRole } from "@/lib/posting/documentPolicy";
import { PostingValidationError } from "@/lib/posting/errors";
import { closingAccrualsSchema, closingFxSchema } from "@/lib/closingInput";
import { receiptKindFromPaymentType, receiptDocTypeCode, saleDocTypeCode, ReceiptKind } from "@/lib/receiptKind";
import Decimal from "decimal.js";
import { tashkentDate } from "@/lib/accountingDate";
import { createHash } from "node:crypto";
import { SoliqBatchError, soliqCompletionSchema, validateSoliqRows, resolveSoliqDecisions, soliqControlTotals } from "@/lib/soliqBatch";
import { assertSoliqLedger } from "@/lib/soliqLedger";

class SoliqMatchError extends Error {}

async function validateMatchedAdvance(tx: any, orgId: string, esf: any) {
  if (esf.expenseMatch) {
    throw new SoliqMatchError("Зачёт банковской строки требует регистра использования платежей; выберите подтверждённый аванс");
  }
  if (typeof esf.matchedOpenItemId !== "string" || !esf.matchedOpenItemId.trim()) {
    throw new SoliqMatchError("Не указана задолженность для зачёта");
  }
  await tx.$queryRaw`SELECT "id" FROM "OpenItem" WHERE "orgId" = ${orgId} AND "id" = ${esf.matchedOpenItemId} FOR UPDATE`;
  const item = await tx.openItem.findFirst({
    where: { id: esf.matchedOpenItemId, orgId },
    include: { account: true, counterparty: true, openingDocument: true },
  });
  const expectedAccount = esf.direction === "REVENUE" ? "6310" : "4310";
  if (!item || !["OPEN", "RISK"].includes(item.status) || item.closingDocumentId ||
      item.openingDocument.orgId !== orgId || item.openingDocument.status !== "POSTED" ||
      item.account.code !== expectedAccount || esf.matchedAccountCode !== item.account.code ||
      !item.counterpartyId || item.counterparty?.orgId !== orgId ||
      typeof esf.inn !== "string" || !esf.inn.trim() || item.counterparty.inn?.trim() !== esf.inn.trim() ||
      item.dateOpened > new Date(esf.date) ||
      !new Decimal(item.amount.toString()).equals(new Decimal(esf.amount).plus(esf.vatAmount))) {
    throw new SoliqMatchError("Выбранный аванс недоступен или не соответствует ИНН, счёту, дате и точной сумме ЭСФ");
  }
  return item;
}

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
    const membership = await getActiveMembership();
    assertAccountingWriteRole(membership.role);
    const orgId = membership.orgId;

    const period = await prisma.period.findFirst({ where: { id: periodId, orgId } });
    if (!period) {
      return NextResponse.json({ error: "Период не найден" }, { status: 404 });
    }
    if (period.status === "CLOSED") {
      return NextResponse.json({ error: "Период уже закрыт. Повторное выполнение шагов невозможно." }, { status: 400 });
    }

    const stepNum = Number(stepNumber);
    if (!/^[1-8]$/.test(stepNumber)) {
      return NextResponse.json({ error: "Неверный номер шага" }, { status: 400 });
    }
    const body = await req.json();

    if (stepNum === 4 || stepNum === 5) {
      const parsed = (stepNum === 4 ? closingAccrualsSchema : closingFxSchema).safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
      }
      const nextStep = stepNum + 1;
      await saveClosingState(periodId, {
        currentStep: nextStep,
        ...(stepNum === 4 ? { accruals: parsed.data } : { fxDiff: parsed.data }),
      }, orgId);
      return NextResponse.json({ nextStep, summary: await getClosingState(periodId, orgId) });
    } else if (stepNum === 6) {
      if (body.skip === true && Object.keys(body).length === 1) {
        await prisma.$transaction(async tx => {
          await tx.$queryRaw`SELECT "id" FROM "Period" WHERE "id" = ${periodId} AND "orgId" = ${orgId} FOR NO KEY UPDATE`;
          const activeBatch = await tx.soliqImportBatch.findFirst({
            where: { orgId, periodId, status: { in: ["READY", "POSTED"] } }, select: { id: true },
          });
          const imported = await tx.document.findFirst({ where: { orgId, periodId, type: { code: "SOLIQ_IMPORT" } }, select: { id: true } });
          if (activeBatch || imported) throw new SoliqBatchError("Нельзя пропустить загруженный или проведённый пакет Soliq");
          await saveClosingState(periodId, {
            currentStep: 7, soliqMatched: { matched: 0, unmatched: 0, skipped: true },
          }, orgId, tx);
        }, { maxWait: 5000, timeout: 10000 });
        return NextResponse.json({ nextStep: 7, summary: await getClosingState(periodId, orgId) });
      }
      const request = soliqCompletionSchema.safeParse(body);
      if (!request.success) throw new SoliqBatchError("Требуются batchId и решения по строкам; финансовые данные клиента не принимаются");
      {
        const { postDocument } = await import("@/lib/posting/postingEngine");

        // Wrap everything in a massive transaction
        await prisma.$transaction(async (tx) => {
          await tx.$queryRaw`SELECT "id" FROM "Period" WHERE "id" = ${periodId} AND "orgId" = ${orgId} FOR NO KEY UPDATE`;
          const lockedPeriod = await tx.period.findFirst({ where: { id: periodId, orgId } });
          if (!lockedPeriod || lockedPeriod.status !== "OPEN" || lockedPeriod.lockDate) {
            throw new Error("Период закрыт, заблокирован или недоступен для импорта Soliq");
          }
          await tx.$queryRaw`SELECT "id" FROM "SoliqImportBatch" WHERE "id" = ${request.data.batchId} AND "orgId" = ${orgId} AND "periodId" = ${periodId} FOR UPDATE`;
          const batch = await tx.soliqImportBatch.findFirst({ where: { id: request.data.batchId, orgId, periodId } });
          if (!batch || batch.status !== "READY") throw new SoliqBatchError("Пакет Soliq недоступен или уже проведён");
          if (batch.parserVersion !== "soliq-v1" || createHash("sha256").update(batch.sourceData).digest("hex") !== batch.sourceHash) {
            throw new SoliqBatchError("Версия или хеш источника Soliq не совпадают");
          }
          const rows = validateSoliqRows(batch.rows, lockedPeriod);
          const totals = soliqControlTotals(rows);
          const parsed = {
            esfItems: resolveSoliqDecisions(rows, batch.totals, request.data.decisions),
            taxSummary: { vat: totals.vat, inputVat: totals.inputVat, outputVat: totals.outputVat, turnoverTax: "0.00", incomeTax: "0.00" },
          };
          const postedRows: { rowId: string; documentId: string; documentTypeCode: string }[] = [];
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
            where: { orgId, periodId, type: { code: "SOLIQ_IMPORT" } }
          });
          if (existingSoliqDoc) {
            throw new SoliqAlreadyImportedError();
          }

          let soliqDocType = await tx.documentType.findUnique({ where: { code: "SOLIQ_IMPORT" } });
          if (!soliqDocType) {
            soliqDocType = await tx.documentType.create({ data: {
              code: "SOLIQ_IMPORT", name: "Импорт отчёта Soliq", postingTemplate: {}, mode: "MANUAL_ONLY"
            } });
          }
          const docTypes = await tx.documentType.findMany();
          const getType = (code: string) => docTypes.find(type => type.code === code);

          // 1. Create the main SOLIQ_IMPORT document
          const marker = await tx.document.create({
            data: {
              orgId,
              periodId,
              typeId: soliqDocType!.id,
              date: new Date(tashkentDate(lockedPeriod.year, lockedPeriod.month, 1).getTime() - 1),
              status: "POSTED",
              payload: {
                batchId: batch.id,
                sourceHash: batch.sourceHash,
                totals,
                taxSummary: parsed.taxSummary,
                expenses: rows.filter(row => row.direction === "EXPENSE").length,
                revenues: rows.filter(row => row.direction === "REVENUE").length,
                totalEsfItems: rows.length
              } as any
            }
          });
          
          // 2. Process each ESF item
          for (const esf of parsed.esfItems) {
            const grossDecimal = new Decimal(esf.amount).plus(esf.vatAmount);
            const grossAmount = grossDecimal.toFixed(2);
            
            if (esf.matchStatus === "MATCHED") {
              const matchedAdvance = await validateMatchedAdvance(tx, orgId, esf);
              let docTypeCode = "INVOICE_CONFIRMED_PREPAID";
              const payload: any = {
                soliqBatchId: batch.id,
                soliqRowId: esf.rowId,
                amount: grossAmount,
                vatAmount: esf.vatAmount,
                counterpartyId: matchedAdvance.counterpartyId,
                counterpartyInn: esf.inn,
                counterpartyHint: esf.counterpartyName
              };
              
              if (esf.direction === "REVENUE") {
                docTypeCode = saleDocTypeCode(resolveSaleKind(esf), true);
              } else {
                // EXPENSE: товары или услуги — по категории исходного платежа
                const kind = await resolveReceiptKind(tx, orgId, esf);
                docTypeCode = receiptDocTypeCode(kind, true);
                payload.openItemId = matchedAdvance.id;
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
              
              await postDocument(doc.id, tx, membership.userId);
              postedRows.push({ rowId: esf.rowId, documentId: doc.id, documentTypeCode: docTypeCode });
              {
                const closed = await tx.openItem.updateMany({
                  where: { id: matchedAdvance.id, orgId, OR: [
                    { status: { in: ["OPEN", "RISK"] }, closingDocumentId: null },
                    { status: "CLOSED", closingDocumentId: doc.id },
                  ] },
                  data: {
                    status: "CLOSED",
                    closingDocumentId: doc.id,
                    dateClosed: new Date(esf.date)
                  }
                });
                if (closed.count !== 1) throw new SoliqMatchError("Аванс уже изменён; импорт отменён");
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
                    soliqBatchId: batch.id,
                    soliqRowId: esf.rowId,
                    amount: grossAmount,
                    vatAmount: esf.vatAmount,
                    counterpartyInn: esf.inn,
                    counterpartyHint: esf.counterpartyName
                  } as any
                }
              });
              
              await postDocument(doc.id, tx, membership.userId);
              postedRows.push({ rowId: esf.rowId, documentId: doc.id, documentTypeCode: docTypeCode });
            }
          }
          const written = await tx.document.findMany({
            where: { orgId, periodId, id: { in: postedRows.map(row => row.documentId) } },
            select: { id: true, payload: true, status: true, type: { select: { code: true } },
              journalEntries: { select: { account: { select: { code: true } }, debit: true, credit: true } },
            },
          });
          if (written.length !== rows.length || rows.some(row => {
            const link = postedRows.find(posted => posted.rowId === row.rowId);
            const document = written.find(document => document.id === link?.documentId);
            const payload = document?.payload as Record<string, unknown> | undefined;
            return !payload || payload.soliqBatchId !== batch.id || payload.soliqRowId !== row.rowId ||
              !new Decimal(String(payload.amount)).eq(new Decimal(row.amount).plus(row.vatAmount)) ||
              !new Decimal(String(payload.vatAmount)).eq(row.vatAmount);
          })) throw new SoliqBatchError("Контрольные суммы записанных документов не совпадают с пакетом");
          for (const row of rows) {
            const link = postedRows.find(posted => posted.rowId === row.rowId)!;
            const document = written.find(document => document.id === link.documentId)!;
            if (document.status !== "POSTED" || document.type.code !== link.documentTypeCode) {
              throw new SoliqBatchError("Тип или статус записанного документа не совпадает с пакетом");
            }
            assertSoliqLedger(row, link.documentTypeCode, document.journalEntries);
          }
          await saveClosingState(periodId, {
            currentStep: 7,
            soliqMatched: {
              matched: parsed.esfItems.filter((esf: any) => esf.matchStatus === "MATCHED").length,
              unmatched: parsed.esfItems.filter((esf: any) => esf.matchStatus === "UNMATCHED").length,
            },
          }, orgId, tx);
          const completed = await tx.soliqImportBatch.updateMany({
            where: { id: batch.id, orgId, periodId, status: "READY" },
            data: {
              status: "POSTED", postedAt: new Date(), postedBy: membership.userId,
              result: { markerId: marker.id, rows: postedRows, totals, decisions: request.data.decisions,
                ledgerControl: { version: "soliq-v1", documentCount: written.length, totals },
              },
            },
          });
          if (completed.count !== 1) throw new SoliqBatchError("Пакет Soliq уже изменён");
        }, {
          maxWait: 5000,
          timeout: 120000
        });
        return NextResponse.json({ nextStep: 7, summary: await getClosingState(periodId, orgId) });
      }

    }

    const nextStep = stepNum + 1;
    await saveClosingState(periodId, { currentStep: nextStep }, orgId);

    const updated = await getClosingState(periodId, orgId);
    return NextResponse.json({ nextStep, summary: updated });
  } catch (err: any) {
    if (err instanceof SoliqMatchError || err instanceof SoliqBatchError || err instanceof PostingValidationError || err instanceof SyntaxError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    if (err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    if (err.message === "FORBIDDEN" || err.message === "NO_ACTIVE_ORG") {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    if (err instanceof SoliqAlreadyImportedError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("COMPLETE STEP ERROR:", err);
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}

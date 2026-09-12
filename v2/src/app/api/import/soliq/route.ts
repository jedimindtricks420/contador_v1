import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import Decimal from "decimal.js";
import { getActiveMembership } from "@/lib/context";
import { assertAccountingWriteRole } from "@/lib/posting/documentPolicy";
import prisma from "@/lib/prisma";
import { parseSoliqExcel, SoliqParseError } from "@/lib/parsers/parserSoliq";
import { buildSoliqRows, SOLIQ_MAX_FILE_BYTES, SoliqBatchError, soliqControlTotals, validateSoliqRows, resolveSoliqDecisions } from "@/lib/soliqBatch";
import { tashkentDate } from "@/lib/accountingDate";
import type { SoliqImportBatch } from "@prisma/client";

function importError(error: unknown) {
  const message = error instanceof Error ? error.message : "Internal error";
  const status = message === "UNAUTHORIZED" ? 401 : ["FORBIDDEN", "NO_ACTIVE_ORG"].includes(message) ? 403 :
    error instanceof SoliqBatchError || error instanceof SoliqParseError ? 400 : 500;
  return NextResponse.json({ error: status === 500 ? "Не удалось обработать реестр Soliq" : message }, { status });
}

export async function GET(req: NextRequest) {
  try {
    const { orgId } = await getActiveMembership();
    const periodId = req.nextUrl.searchParams.get("periodId");
    if (!periodId) throw new SoliqBatchError("periodId обязателен");
    const period = await prisma.period.findFirst({ where: { id: periodId, orgId } });
    if (!period) return NextResponse.json({ error: "Отчётный период не найден" }, { status: 404 });
    const batchId = req.nextUrl.searchParams.get("batchId");
    if (!batchId) {
      const batches = await prisma.soliqImportBatch.findMany({
        where: { orgId, periodId, status: "READY" }, orderBy: { createdAt: "asc" },
        select: { id: true, sourceName: true, createdAt: true },
      });
      const marker = await prisma.document.findFirst({ where: { orgId, periodId, type: { code: "SOLIQ_IMPORT" } }, select: { id: true } });
      const posted = await prisma.soliqImportBatch.findFirst({ where: { orgId, periodId, status: "POSTED" }, select: { id: true } });
      const archives = await prisma.soliqImportBatch.findMany({
        where: { orgId, periodId, status: { in: ["POSTED", "CANCELLED"] } }, orderBy: { createdAt: "desc" },
        select: { id: true, sourceName: true, status: true },
      });
      return NextResponse.json({ batches, imported: Boolean(marker || posted), archives });
    }
    const batch = await prisma.soliqImportBatch.findFirst({ where: { id: batchId, orgId, periodId, status: "READY" } });
    if (!batch) return NextResponse.json({ error: "Пакет не найден или уже обработан" }, { status: 404 });
    return await previewBatch(batch, period, orgId);
  } catch (error: unknown) {
    return importError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const membership = await getActiveMembership();
    assertAccountingWriteRole(membership.role);
    const orgId = membership.orgId;
    const formData = await req.formData();
    const file = formData.get("file");
    const periodId = formData.get("periodId");
    if (!(file instanceof File) || typeof periodId !== "string" || !periodId) {
      return NextResponse.json({ error: "file и periodId обязательны" }, { status: 400 });
    }
    if (!file.size || file.size > SOLIQ_MAX_FILE_BYTES) {
      return NextResponse.json({ error: "Файл должен быть непустым и не превышать 5 MiB" }, { status: 400 });
    }
    const period = await prisma.period.findFirst({ where: { id: periodId, orgId } });
    if (!period) return NextResponse.json({ error: "Отчётный период не найден" }, { status: 404 });
    if (period.status !== "OPEN" || period.lockDate) throw new SoliqBatchError("Период закрыт или заблокирован");

    const buffer = Buffer.from(await file.arrayBuffer());
    const parsed = parseSoliqExcel(buffer);
    if (!parsed.templateRecognized) throw new SoliqBatchError("Не удалось распознать реестр Soliq");
    const parsedRows = buildSoliqRows(parsed.esfItems, period);
    const sourceHash = createHash("sha256").update(buffer).digest("hex");
    const batch = await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "Period" WHERE "id" = ${periodId} AND "orgId" = ${orgId} FOR NO KEY UPDATE`;
      const locked = await tx.period.findFirst({ where: { id: periodId, orgId } });
      if (!locked || locked.status !== "OPEN" || locked.lockDate) throw new SoliqBatchError("Период закрыт или заблокирован");
      const marker = await tx.document.findFirst({ where: { orgId, periodId, type: { code: "SOLIQ_IMPORT" } }, select: { id: true } });
      const posted = await tx.soliqImportBatch.findFirst({ where: { orgId, periodId, status: "POSTED" }, select: { id: true } });
      if (marker || posted) throw new SoliqBatchError("Реестр Soliq этого периода уже проведён");
      const existing = await tx.soliqImportBatch.findUnique({ where: { orgId_periodId_sourceHash: { orgId, periodId, sourceHash } } });
      if (existing) {
        if (existing.status !== "READY") throw new SoliqBatchError("Этот пакет Soliq уже проведён или отменён");
        return existing;
      }
      return tx.soliqImportBatch.create({ data: {
        orgId, periodId, sourceName: file.name.slice(0, 255), sourceHash, sourceData: buffer,
        parserVersion: "soliq-v1", rows: parsedRows, totals: soliqControlTotals(parsedRows), createdBy: membership.userId,
      } });
    }, { maxWait: 5000, timeout: 10000 });
    return await previewBatch(batch, period, orgId);
  } catch (error: unknown) {
    return importError(error);
  }
}

async function previewBatch(batch: SoliqImportBatch, period: { year: number; month: number }, orgId: string) {
    if (batch.parserVersion !== "soliq-v1" || createHash("sha256").update(batch.sourceData).digest("hex") !== batch.sourceHash) {
      throw new SoliqBatchError("Версия или хеш источника Soliq не совпадают");
    }
    const rows = validateSoliqRows(batch.rows, period);
    resolveSoliqDecisions(rows, batch.totals, rows.map(row => ({ rowId: row.rowId, openItemId: null })));
    const totals = soliqControlTotals(rows);

    const openItems = await prisma.openItem.findMany({
      where: {
        orgId, status: { in: ["OPEN", "RISK"] }, closingDocumentId: null,
        account: { code: { in: ["6310", "4310"] } },
        openingDocument: { orgId, status: "POSTED" },
        dateOpened: { lt: tashkentDate(period.year, period.month, 1) },
      },
      include: { counterparty: true, account: true, openingDocument: true },
      orderBy: [{ dateOpened: "asc" }, { id: "asc" }],
    });
    const remaining = [...openItems];
    const esfItems = rows.map(row => {
      const gross = new Decimal(row.amount).plus(row.vatAmount);
      const candidates = remaining.filter(item =>
        ["OPEN", "RISK"].includes(item.status) && !item.closingDocumentId &&
        item.openingDocument.orgId === orgId && item.openingDocument.status === "POSTED" &&
        item.counterparty?.orgId === orgId && item.counterparty.inn?.trim() === row.inn &&
        item.account.code === (row.direction === "REVENUE" ? "6310" : "4310") &&
        item.dateOpened <= new Date(row.date) && new Decimal(item.amount.toString()).eq(gross));
      const match = candidates.length === 1 ? candidates[0] : undefined;
      if (match) remaining.splice(remaining.findIndex(item => item.id === match.id), 1);
      return {
        ...row, amount: Number(row.amount), vatAmount: Number(row.vatAmount),
        matchStatus: match ? "MATCHED" : "UNMATCHED",
        matchedOpenItemId: match?.id, matchedAccountCode: match?.account.code,
        matchReason: match ? "EXACT_INN_ACCOUNT_DATE_AMOUNT" : candidates.length > 1 ? "AMBIGUOUS_ADVANCES" : "NO_EXACT_ADVANCE",
      };
    });
    const matched = esfItems.filter(row => row.matchStatus === "MATCHED");
    const unmatched = esfItems.filter(row => row.matchStatus === "UNMATCHED");
    return NextResponse.json({
      batchId: batch.id, sourceHash: batch.sourceHash, sourceName: batch.sourceName, matched: matched.length, unmatched: unmatched.length,
      empty: rows.length === 0,
      taxSummary: { vat: Number(totals.vat), inputVat: Number(totals.inputVat), outputVat: Number(totals.outputVat), turnoverTax: 0, incomeTax: 0 },
      totals, esfItems,
      matches: matched.map(row => ({ rowId: row.rowId, counterpartyName: row.counterpartyName, amount: new Decimal(row.amount).plus(row.vatAmount).toNumber() })),
      soliqOnly: unmatched.map(row => ({ id: row.rowId, counterpartyName: row.counterpartyName, inn: row.inn, amount: new Decimal(row.amount).plus(row.vatAmount).toNumber() })),
      bankOnly: remaining.map(item => ({
        id: item.id, counterpartyName: item.counterparty?.name || "", inn: item.counterparty?.inn || null,
        amount: Number(item.amount), accountCode: item.account.code, date: item.dateOpened,
      })),
    });
}
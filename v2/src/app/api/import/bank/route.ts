import { NextRequest, NextResponse } from "next/server";
import { getActiveOrgId } from "@/lib/context";
import prisma from "@/lib/prisma";
import crypto from "crypto";

import { parse1CExchange } from "@/lib/parsers/parser1c";
import { parseBankExcel } from "@/lib/parsers/parserBankExcel";
import { ParsedTransaction } from "@/lib/parsers/types";
import { Prisma } from "@prisma/client";

export async function POST(req: NextRequest) {
  try {

    const orgId = await getActiveOrgId();
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const bankAccountId = formData.get("bankAccountId") as string | null;
    const parserType = formData.get("parserType") as string | null; // "1C", "Asaka", "Kapital", "IpakYoli", "AUTO"

    const url = new URL(req.url);
    const isPreview = url.searchParams.get("preview") === "true";

    if (!file || !bankAccountId) {
      return NextResponse.json({ error: "file и bankAccountId обязательны" }, { status: 400 });
    }

    const bankAccount = await prisma.bankAccount.findFirst({
      where: { id: bankAccountId, orgId },
    });
    if (!bankAccount) {
      return NextResponse.json({ error: "Банковский счёт не найден" }, { status: 404 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let parsed: ParsedTransaction[] = [];
    let statementOpeningBalance: number | undefined;
    let statementClosingBalance: number | undefined;
    let usedParser = "";

    // Format detection: check ASCII prefix of the buffer (works for both UTF-8 and CP1251)
    const headerSnippet = buffer.slice(0, 64).toString("latin1");
    const is1CHeader = headerSnippet.includes("1CClientBankExchange");

    if (parserType === "1C" || (parserType !== "Asaka" && parserType !== "Kapital" && parserType !== "IpakYoli" && is1CHeader)) {
      const result = parse1CExchange(buffer);
      parsed = result.transactions;
      statementOpeningBalance = result.openingBalance;
      statementClosingBalance = result.closingBalance;
      usedParser = "1CClientBankExchange";
    } else {
      const result = parseBankExcel(buffer);
      parsed = result.transactions;
      statementOpeningBalance = result.openingBalance;
      statementClosingBalance = result.closingBalance;
      usedParser = "Excel Parser";
    }

    if (parsed.length === 0) {
      return NextResponse.json({ error: "Нет транзакций в файле или неподдерживаемый формат" }, { status: 422 });
    }

    // Preview mode: return the parsed results without saving to DB
    if (isPreview) {
      return NextResponse.json({
        parser: usedParser,
        total: parsed.length,
        openingBalance: statementOpeningBalance ?? null,
        closingBalance: statementClosingBalance ?? null,
        transactions: parsed.map(tx => ({
          date: tx.date.toISOString().split("T")[0],
          amount: tx.amount,
          direction: tx.direction,
          description: tx.description,
          counterpartyHint: tx.counterpartyHint || "",
          counterpartyInn: tx.counterpartyInn || ""
        }))
      });
    }

    let imported = 0;
    let duplicates = 0;
    let locked = 0;
    let netDelta = 0;
    const importBatchId = crypto.randomUUID();

    for (const tx of parsed) {
      const year = tx.date.getFullYear();
      const month = tx.date.getMonth() + 1;

      // Find or create accounting period (upsert is race-safe: @@unique([orgId, year, month]))
      const now = new Date();
      const isPast = year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth() + 1);
      const period = await prisma.period.upsert({
        where: { orgId_year_month: { orgId, year, month } },
        create: { orgId, year, month, mode: isPast ? "HISTORICAL" : "ACTIVE", status: "OPEN" },
        update: {}
      });

      // Skip transactions whose period is already closed — they cannot be classified
      if (period.status === "CLOSED") {
        locked++;
        continue;
      }

      // SHA-256 for deduplication
      const hash = crypto
        .createHash("sha256")
        .update(`${orgId}:${bankAccountId}:${tx.date.toISOString()}:${tx.amount}:${tx.description}`)
        .digest("hex");

      try {
        await prisma.stagedTransaction.create({
          data: {
            orgId,
            bankAccountId,
            periodId: period.id,
            date: tx.date,
            amount: tx.amount,
            direction: tx.direction,
            description: tx.description,
            counterpartyHint: tx.counterpartyHint || null,
            counterpartyInn: tx.counterpartyInn || null,
            hash,
            status: "IMPORTED",
            importBatchId,
          },
        });
        imported++;
        netDelta += tx.direction === "CREDIT" ? tx.amount : -tx.amount;
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
          duplicates++;
        } else {
          throw e;
        }
      }
    }

    // Update bank balance.
    // If the statement provides an opening balance AND the account has never been synced
    // (lastBalance === 0 and lastSyncedAt is null), seed lastBalance from the statement.
    // This ensures the first import correctly reflects the real bank opening position.
    if (imported > 0) {
      const current = await prisma.bankAccount.findUnique({
        where: { id: bankAccountId },
        select: { lastBalance: true, lastSyncedAt: true }
      });
      const isFirstSync = !current?.lastSyncedAt && Number(current?.lastBalance ?? 0) === 0;
      const baseBalance = (isFirstSync && statementOpeningBalance !== undefined)
        ? statementOpeningBalance
        : Number(current?.lastBalance ?? 0);
      const newBalance = baseBalance + netDelta;
      await prisma.bankAccount.update({
        where: { id: bankAccountId },
        data: { lastSyncedAt: new Date(), lastBalance: newBalance }
      });
    }

    // Warn if the statement closing balance doesn't match what we computed
    let balanceDiscrepancy: number | null = null;
    if (statementClosingBalance !== undefined && imported > 0) {
      const finalAccount = await prisma.bankAccount.findUnique({
        where: { id: bankAccountId },
        select: { lastBalance: true }
      });
      const computed = Number(finalAccount?.lastBalance ?? 0);
      const diff = Math.abs(computed - statementClosingBalance);
      if (diff > 0.01) balanceDiscrepancy = diff;
    }

    return NextResponse.json({
      imported, duplicates, locked, total: parsed.length, parser: usedParser,
      importBatchId: imported > 0 ? importBatchId : null,
      openingBalance: statementOpeningBalance ?? null,
      closingBalance: statementClosingBalance ?? null,
      balanceDiscrepancy
    });
  } catch (err: any) {
    console.error("BANK STATEMENT IMPORT ERROR:", err);
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}

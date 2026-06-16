import { NextRequest, NextResponse } from "next/server";
import { getActiveOrgId } from "@/lib/context";
import prisma from "@/lib/prisma";
import crypto from "crypto";
import { ensureBaseData } from "@/lib/ensureBaseData";
import { parse1CExchange } from "@/lib/parsers/parser1c";
import { parseBankExcel } from "@/lib/parsers/parserBankExcel";
import { ParsedTransaction } from "@/lib/parsers/types";

export async function POST(req: NextRequest) {
  try {
    await ensureBaseData();
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
    let usedParser = "";

    // Format detection: check ASCII prefix of the buffer (works for both UTF-8 and CP1251)
    const headerSnippet = buffer.slice(0, 64).toString("latin1");
    const is1CHeader = headerSnippet.includes("1CClientBankExchange");

    if (parserType === "1C" || (parserType !== "Asaka" && parserType !== "Kapital" && parserType !== "IpakYoli" && is1CHeader)) {
      // Pass the raw buffer so the parser can handle CP1251 decoding itself
      parsed = parse1CExchange(buffer);
      usedParser = "1CClientBankExchange";
    } else {
      parsed = parseBankExcel(buffer);
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
    let netDelta = 0;
    const importBatchId = crypto.randomUUID();

    for (const tx of parsed) {
      const year = tx.date.getFullYear();
      const month = tx.date.getMonth() + 1;

      // Find or create accounting period
      let period = await prisma.period.findFirst({ where: { orgId, year, month } });
      if (!period) {
        const now = new Date();
        const isPast = year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth() + 1);
        period = await prisma.period.create({
          data: { orgId, year, month, mode: isPast ? "HISTORICAL" : "ACTIVE", status: "OPEN" },
        });
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
      } catch {
        // Duplicate hash - skip it
        duplicates++;
      }
    }

    // Update bank balance: add credits, subtract debits from newly imported transactions
    if (imported > 0) {
      const current = await prisma.bankAccount.findUnique({
        where: { id: bankAccountId },
        select: { lastBalance: true }
      });
      const newBalance = Number(current?.lastBalance ?? 0) + netDelta;
      await prisma.bankAccount.update({
        where: { id: bankAccountId },
        data: { lastSyncedAt: new Date(), lastBalance: newBalance }
      });
    }

    return NextResponse.json({ imported, duplicates, total: parsed.length, parser: usedParser, importBatchId: imported > 0 ? importBatchId : null });
  } catch (err: any) {
    console.error("BANK STATEMENT IMPORT ERROR:", err);
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getActiveOrgId } from "@/lib/context";

import Decimal from "decimal.js";

export async function GET() {
  try {

    const orgId = await getActiveOrgId();
    const accounts = await prisma.bankAccount.findMany({
      where: { orgId },
      orderBy: { name: "asc" }
    });
    return NextResponse.json(accounts);
  } catch (err: any) {
    console.error("GET BANK ACCOUNTS ERROR:", err);
    if (err.message === "UNAUTHORIZED" || err.message === "NO_ACTIVE_ORG") {
      return NextResponse.json({ error: err.message || "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {

    const orgId = await getActiveOrgId();
    const { name, bankName, accountNumber, lastBalance, currency } = await req.json();

    if (!name) {
      return NextResponse.json({ error: "Название счёта обязательно" }, { status: 400 });
    }

    const account = await prisma.bankAccount.create({
      data: {
        orgId,
        name,
        bankName: bankName || null,
        accountNumber: accountNumber || null,
        lastBalance: new Decimal(lastBalance || 0),
        currency: currency || "UZS"
      }
    });

    return NextResponse.json(account, { status: 201 });
  } catch (err: any) {
    console.error("POST BANK ACCOUNT ERROR:", err);
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}

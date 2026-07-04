import { NextRequest, NextResponse } from "next/server";
import { getActiveOrgId, getActiveMembership } from "@/lib/context";
import prisma from "@/lib/prisma";
import { postDocument } from "@/lib/posting/postingEngine";
import { getCharterCapitalDebt } from "@/lib/charterCapital";
import Decimal from "decimal.js";

const FUNDING_TYPES = ["FULLY_PAID_CASH", "PARTIALLY_PAID", "PAID_IN_KIND", "NOT_PAID"] as const;
type FundingType = (typeof FUNDING_TYPES)[number];

// НСБУ-21 §348: имущественный вклад может закрывать долг 4610 только через счета
// активов — основные средства/НМА (01xx) или ТМЗ/прочие активы (10xx-29xx).
const ASSET_ACCOUNT_CODE_RE = /^(0[1-9]\d{2}|1\d{3}|2\d{3})$/;

export async function GET() {
  try {
    const orgId = await getActiveOrgId();

    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: {
        charterCapitalAmount: true,
        charterCapitalFundingType: true,
        charterCapitalDeclaredAt: true,
      },
    });
    if (!org) return NextResponse.json({ error: "Организация не найдена" }, { status: 404 });

    const remainingDebt = org.charterCapitalDeclaredAt ? await getCharterCapitalDebt(orgId) : new Decimal(0);

    return NextResponse.json({
      amount: org.charterCapitalAmount ? Number(org.charterCapitalAmount) : null,
      fundingType: org.charterCapitalFundingType,
      declaredAt: org.charterCapitalDeclaredAt,
      remainingDebt: remainingDebt.toNumber(),
    });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED" || err.message === "NO_ACTIVE_ORG") {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }
    return NextResponse.json({ error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}

async function findOpenPeriod(orgId: string, tx: any) {
  let period = await tx.period.findFirst({
    where: { orgId, status: "OPEN" },
    orderBy: [{ year: "asc" }, { month: "asc" }],
  });
  if (!period) {
    const now = new Date();
    period = await tx.period.create({
      data: { orgId, year: now.getFullYear(), month: now.getMonth() + 1, mode: "ACTIVE", status: "OPEN" },
    });
  }
  return period;
}

async function ensureDeclarationType(tx: any) {
  const type = await tx.documentType.findUnique({ where: { code: "OPENING_CAPITAL_DECLARATION" } });
  if (!type) throw new Error("Тип документа OPENING_CAPITAL_DECLARATION не найден — перезапустите приложение (ensureBaseData)");
  return type;
}

function validateBody(body: any): { error: string } | {
  amount: Decimal; fundingType: FundingType; paidAmount: Decimal | null; fundedAccountCode: string | null;
  confirmedRegistration: boolean; registrationDate: string | null;
} {
  const amountNum = Number(body.amount);
  if (!body.amount || !Number.isFinite(amountNum) || amountNum <= 0) {
    return { error: "Укажите положительную сумму уставного капитала" };
  }
  if (!FUNDING_TYPES.includes(body.fundingType)) {
    return { error: `fundingType должен быть одним из: ${FUNDING_TYPES.join(", ")}` };
  }
  const amount = new Decimal(amountNum);
  let paidAmount: Decimal | null = null;

  if (body.fundingType === "PARTIALLY_PAID" || body.fundingType === "PAID_IN_KIND") {
    const paidNum = Number(body.paidAmount);
    if (!body.paidAmount || !Number.isFinite(paidNum) || paidNum <= 0) {
      return { error: "Укажите оплаченную сумму (paidAmount)" };
    }
    if (paidNum > amountNum) {
      return { error: "Оплаченная сумма не может быть больше суммы уставного капитала" };
    }
    paidAmount = new Decimal(paidNum);
  }

  let fundedAccountCode: string | null = null;
  if (body.fundingType === "PAID_IN_KIND") {
    fundedAccountCode = String(body.fundedAccountCode || "");
    if (!ASSET_ACCOUNT_CODE_RE.test(fundedAccountCode)) {
      return { error: "Укажите корректный счёт актива (0110-0190, 1010-2990) для имущественного вклада" };
    }
  }

  return {
    amount,
    fundingType: body.fundingType,
    paidAmount,
    fundedAccountCode,
    confirmedRegistration: body.confirmedRegistration === true,
    registrationDate: body.registrationDate || null,
  };
}

async function handleSave(req: NextRequest) {
  const orgId = await getActiveOrgId();
  const membership = await getActiveMembership();
  if (membership.role !== "OWNER" && membership.role !== "ADMIN") {
    return NextResponse.json({ error: "Изменять уставный капитал могут только владелец или админ" }, { status: 403 });
  }

  const body = await req.json();
  const validated = validateBody(body);
  if ("error" in validated) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }
  const { amount, fundingType, paidAmount, fundedAccountCode, confirmedRegistration, registrationDate } = validated;

  const org = await prisma.organization.findUnique({ where: { id: orgId } });
  if (!org) return NextResponse.json({ error: "Организация не найдена" }, { status: 404 });

  if (fundedAccountCode) {
    const account = await prisma.account.findUnique({ where: { code: fundedAccountCode } });
    if (!account) return NextResponse.json({ error: `Счёт ${fundedAccountCode} не найден в плане счетов` }, { status: 400 });
  }

  // ── First declaration ──────────────────────────────────────────────────────
  if (!org.charterCapitalDeclaredAt) {
    const result = await prisma.$transaction(async (tx) => {
      const period = await findOpenPeriod(orgId, tx);
      const docType = await ensureDeclarationType(tx);

      const doc = await tx.document.create({
        data: {
          orgId,
          periodId: period.id,
          typeId: docType.id,
          date: new Date(),
          status: "POSTED",
          payload: {
            amount: amount.toNumber(),
            fundingType,
            paidAmount: paidAmount ? paidAmount.toNumber() : null,
            fundedAccountCode,
          } as any,
        },
      });
      await postDocument(doc.id, tx, membership.userId);

      await tx.organization.update({
        where: { id: orgId },
        data: {
          charterCapitalAmount: amount,
          charterCapitalFundingType: fundingType,
          charterCapitalDeclaredAt: new Date(),
        },
      });

      return doc;
    });

    const remainingDebt = await getCharterCapitalDebt(orgId);
    return NextResponse.json({ success: true, documentId: result.id, remainingDebt: remainingDebt.toNumber() }, { status: 201 });
  }

  // ── Subsequent save: amount unchanged — nothing to post ────────────────────
  const currentAmount = new Decimal(org.charterCapitalAmount?.toString() ?? 0);
  if (amount.equals(currentAmount)) {
    return NextResponse.json({ error: "Сумма уставного капитала не изменилась — нет действий для сохранения" }, { status: 400 });
  }

  // ── Decrease — never automated ──────────────────────────────────────────────
  if (amount.lessThan(currentAmount)) {
    return NextResponse.json(
      { error: "Уменьшение уставного капитала требует отдельной бухгалтерской операции, обратитесь к бухгалтеру" },
      { status: 400 }
    );
  }

  // ── Increase — requires explicit confirmation of charter registration ──────
  if (!confirmedRegistration || !registrationDate) {
    return NextResponse.json(
      { error: "Увеличение уставного капитала требует подтверждения регистрации изменений устава (дата и чекбокс)" },
      { status: 400 }
    );
  }

  const diff = amount.minus(currentAmount);
  const result = await prisma.$transaction(async (tx) => {
    const period = await findOpenPeriod(orgId, tx);
    const docType = await ensureDeclarationType(tx);

    const doc = await tx.document.create({
      data: {
        orgId,
        periodId: period.id,
        typeId: docType.id,
        date: new Date(),
        status: "POSTED",
        payload: {
          amount: diff.toNumber(),
          fundingType: "NOT_PAID", // only the base 4610/8330 line fires for the increment
          confirmedRegistration: true,
          registrationDate,
          note: `Увеличение УК с ${currentAmount.toNumber()} до ${amount.toNumber()}`,
        } as any,
      },
    });
    await postDocument(doc.id, tx, membership.userId);

    await tx.organization.update({
      where: { id: orgId },
      data: { charterCapitalAmount: amount },
    });

    return doc;
  });

  const remainingDebt = await getCharterCapitalDebt(orgId);
  return NextResponse.json({ success: true, documentId: result.id, remainingDebt: remainingDebt.toNumber() }, { status: 201 });
}

export async function POST(req: NextRequest) {
  try {
    return await handleSave(req);
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED" || err.message === "NO_ACTIVE_ORG") {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }
    console.error("POST /api/settings/charter-capital error:", err);
    return NextResponse.json({ error: err.message || "Внутренняя ошибка сервера" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  return POST(req);
}

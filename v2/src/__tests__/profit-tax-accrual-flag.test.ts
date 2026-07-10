import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import { NextRequest } from "next/server";
import Decimal from "decimal.js";
import { finalizePeriod } from "@/lib/closing";
import { ensureBaseData } from "@/lib/ensureBaseData";

// Квартальный налог на прибыль нарастающим итогом (ст. 296/338/339 НК РУз):
// - начисление только при закрытии квартальных месяцев (3/6/9/12);
// - delta = кумулятивный налог года − уже начисленное; отрицательная delta
//   оформляется сторно-документом PROFIT_TAX_REVERSAL (Дт 6410 / Кт 9810);
// - autoAccrueProfitTax=false подавляет документы, но не событие календаря;
// - reopen месяца удаляет начисления его квартала и всех последующих.

let currentOrgId = "";
vi.mock("@/lib/context", () => ({ getActiveOrgId: async () => currentOrgId }));

const prisma = new PrismaClient();

let userId: string;
const orgIds: string[] = [];

beforeAll(async () => {
  await ensureBaseData();
  const user = await prisma.user.create({
    data: { email: `qptax_${Date.now()}@test.local`, name: "QPTax Test", passwordHash: "x" },
  });
  userId = user.id;
}, 60_000);

afterAll(async () => {
  for (const id of orgIds) {
    await prisma.organization.delete({ where: { id } }).catch(() => {});
  }
  if (userId) await prisma.user.delete({ where: { id: userId } }).catch(() => {});
  await prisma.$disconnect();
});

async function makeOrg(opts: { taxRegime?: "VAT" | "TURNOVER_TAX"; autoAccrue?: boolean; rate?: number } = {}) {
  const org = await prisma.organization.create({
    data: {
      name: `ООО QPTax ${orgIds.length}`,
      inn: `QP${Date.now()}${orgIds.length}`.slice(0, 20),
      taxRegime: opts.taxRegime ?? "VAT",
      isVatPayer: (opts.taxRegime ?? "VAT") === "VAT",
      autoAccrueProfitTax: opts.autoAccrue ?? true,
      ...(opts.rate != null ? { profitTaxRate: opts.rate } : {}),
      members: { create: { userId, role: "OWNER" } },
    },
  });
  orgIds.push(org.id);
  return org;
}

async function makePeriod(orgId: string, year: number, month: number) {
  return prisma.period.create({
    data: {
      orgId, year, month,
      closingData: {
        currentStep: 7,
        accruals: { salaryAmount: 0, depreciationAmount: 0, rentAmount: 0 },
      } as any,
    },
  });
}

async function postEntries(
  orgId: string, periodId: string, date: Date,
  lines: { code: string; debit?: number; credit?: number }[]
) {
  const docType = await prisma.documentType.findFirstOrThrow({ where: { code: "REVENUE_NO_VAT" } });
  const doc = await prisma.document.create({
    data: { orgId, periodId, typeId: docType.id, date, status: "POSTED", payload: {} as any },
  });
  for (const l of lines) {
    const acc = await prisma.account.findUniqueOrThrow({ where: { code: l.code } });
    await prisma.journalEntry.create({
      data: { documentId: doc.id, accountId: acc.id, debit: l.debit ?? 0, credit: l.credit ?? 0, date },
    });
  }
  return doc;
}

const addRevenue = (orgId: string, periodId: string, date: Date, amount: number) =>
  postEntries(orgId, periodId, date, [
    { code: "5110", debit: amount },
    { code: "9030", credit: amount },
  ]);

const addExpense = (orgId: string, periodId: string, date: Date, amount: number) =>
  postEntries(orgId, periodId, date, [
    { code: "9430", debit: amount },
    { code: "5110", credit: amount },
  ]);

async function profitTaxDocs(orgId: string) {
  return prisma.document.findMany({
    where: { orgId, type: { code: { in: ["PROFIT_TAX_ACCRUAL", "PROFIT_TAX_REVERSAL"] } } },
    include: { type: { select: { code: true } } },
    orderBy: { date: "asc" },
  });
}

async function net9810(orgId: string) {
  const rows = await prisma.journalEntry.findMany({
    where: {
      document: { orgId, type: { code: { notIn: ["PERIOD_CLOSING"] } } },
      account: { code: "9810" },
    },
  });
  return rows.reduce((s, r) => s.plus(new Decimal(r.debit.toString())).minus(new Decimal(r.credit.toString())), new Decimal(0)).toNumber();
}

describe("налог на прибыль — квартальный нарастающий итог", () => {
  it("сценарии 1–3: начисление за Q1, сторно в Q2 при падении кумулятива, полное сторно при уходе в убыток", async () => {
    const org = await makeOrg();
    const y = 2025;
    const p1 = await makePeriod(org.id, y, 1);
    const p2 = await makePeriod(org.id, y, 2);
    const p3 = await makePeriod(org.id, y, 3);

    // Q1: +10 000 000 (янв), −3 000 000 (фев) → кумулятив 7 000 000
    await addRevenue(org.id, p1.id, new Date(y, 0, 15), 10_000_000);
    await addExpense(org.id, p2.id, new Date(y, 1, 15), 3_000_000);

    // Закрытие неквартальных месяцев — без начислений и без событий PROFIT_TAX
    await finalizePeriod(p1.id, org.id, userId);
    await finalizePeriod(p2.id, org.id, userId);
    expect((await profitTaxDocs(org.id)).length).toBe(0);
    expect(await prisma.taxCalendarEvent.count({ where: { orgId: org.id, type: "PROFIT_TAX" } })).toBe(0);

    // Закрытие марта → ACCRUAL 15% × 7 000 000 = 1 050 000
    await finalizePeriod(p3.id, org.id, userId);
    let docs = await profitTaxDocs(org.id);
    expect(docs.length).toBe(1);
    expect(docs[0].type.code).toBe("PROFIT_TAX_ACCRUAL");
    expect((docs[0].payload as any).taxAmount).toBeCloseTo(1_050_000, 2);
    expect((docs[0].payload as any).quarter).toBe(1);
    expect((docs[0].payload as any).cumulativeBase).toBeCloseTo(7_000_000, 2);
    expect(await net9810(org.id)).toBeCloseTo(1_050_000, 2);

    const q1Event = await prisma.taxCalendarEvent.findFirst({
      where: { orgId: org.id, periodId: p3.id, type: "PROFIT_TAX" },
    });
    expect(q1Event).not.toBeNull();
    expect(Number(q1Event!.estimatedAmount)).toBeCloseTo(1_050_000, 2);
    // срок — 20-е число месяца после квартала (ст. 339 ч.5 п.1)
    expect(new Date(q1Event!.dueDate).getMonth()).toBe(3); // апрель
    expect(new Date(q1Event!.dueDate).getDate()).toBe(20);

    // Q2: −5 000 000 (май) → кумулятив 2 000 000, налог 300 000 < начислено 1 050 000
    const p4 = await makePeriod(org.id, y, 4);
    const p5 = await makePeriod(org.id, y, 5);
    const p6 = await makePeriod(org.id, y, 6);
    await addExpense(org.id, p5.id, new Date(y, 4, 15), 5_000_000);
    await finalizePeriod(p4.id, org.id, userId);
    await finalizePeriod(p5.id, org.id, userId);
    await finalizePeriod(p6.id, org.id, userId);

    docs = await profitTaxDocs(org.id);
    expect(docs.length).toBe(2);
    expect(docs[1].type.code).toBe("PROFIT_TAX_REVERSAL");
    expect((docs[1].payload as any).taxAmount).toBeCloseTo(750_000, 2);
    expect((docs[1].payload as any).accruedBefore).toBeCloseTo(1_050_000, 2);
    expect(await net9810(org.id)).toBeCloseTo(300_000, 2); // = 15% × 2 000 000

    // событие Q2 создаётся с суммой 0 (к доплате ничего — ст. 340 ч.7)
    const q2Event = await prisma.taxCalendarEvent.findFirst({
      where: { orgId: org.id, periodId: p6.id, type: "PROFIT_TAX" },
    });
    expect(Number(q2Event!.estimatedAmount)).toBe(0);

    // Q3: −4 000 000 (авг) → кумулятив −2 000 000, база 0 → сторно остатка 300 000
    const p7 = await makePeriod(org.id, y, 7);
    const p8 = await makePeriod(org.id, y, 8);
    const p9 = await makePeriod(org.id, y, 9);
    await addExpense(org.id, p8.id, new Date(y, 7, 15), 4_000_000);
    await finalizePeriod(p7.id, org.id, userId);
    await finalizePeriod(p8.id, org.id, userId);
    await finalizePeriod(p9.id, org.id, userId);

    docs = await profitTaxDocs(org.id);
    expect(docs.length).toBe(3);
    expect(docs[2].type.code).toBe("PROFIT_TAX_REVERSAL");
    expect((docs[2].payload as any).taxAmount).toBeCloseTo(300_000, 2);
    expect(await net9810(org.id)).toBeCloseTo(0, 2);
  }, 120_000);

  it("autoAccrueProfitTax=false: документов нет, квартальное событие календаря есть", async () => {
    const org = await makeOrg({ autoAccrue: false });
    const y = 2025;
    const p3 = await makePeriod(org.id, y, 3);
    await addRevenue(org.id, p3.id, new Date(y, 2, 10), 10_000_000);
    await finalizePeriod(p3.id, org.id, userId);

    expect((await profitTaxDocs(org.id)).length).toBe(0);
    expect(await net9810(org.id)).toBe(0);
    const ev = await prisma.taxCalendarEvent.findFirst({
      where: { orgId: org.id, periodId: p3.id, type: "PROFIT_TAX" },
    });
    expect(ev).not.toBeNull();
    expect(Number(ev!.estimatedAmount)).toBeCloseTo(1_500_000, 2);
  }, 60_000);

  it("profitTaxRate=0.20: начисление по ставке организации", async () => {
    const org = await makeOrg({ rate: 0.2 });
    const y = 2025;
    const p3 = await makePeriod(org.id, y, 3);
    await addRevenue(org.id, p3.id, new Date(y, 2, 10), 10_000_000);
    await finalizePeriod(p3.id, org.id, userId);

    const docs = await profitTaxDocs(org.id);
    expect(docs.length).toBe(1);
    expect((docs[0].payload as any).taxAmount).toBeCloseTo(2_000_000, 2);
  }, 60_000);

  it("TURNOVER_TAX-организация: месячное начисление налога с оборота не изменилось", async () => {
    const org = await makeOrg({ taxRegime: "TURNOVER_TAX" });
    const y = 2025;
    const p1 = await makePeriod(org.id, y, 1);
    await addRevenue(org.id, p1.id, new Date(y, 0, 10), 10_000_000);
    await finalizePeriod(p1.id, org.id, userId);

    const ttax = await prisma.document.findMany({
      where: { orgId: org.id, type: { code: "TURNOVER_TAX_ACCRUAL" } },
    });
    expect(ttax.length).toBe(1);
    expect((ttax[0].payload as any).taxAmount).toBeCloseTo(400_000, 2); // 4%
    expect((await profitTaxDocs(org.id)).length).toBe(0);
  }, 60_000);

  it("reopen месяца внутри квартала удаляет квартальное начисление; следующий квартал доначисляет полную сумму", async () => {
    const org = await makeOrg();
    currentOrgId = org.id;
    const y = 2025;
    const p2 = await makePeriod(org.id, y, 2);
    const p3 = await makePeriod(org.id, y, 3);
    await addRevenue(org.id, p2.id, new Date(y, 1, 10), 10_000_000);
    await finalizePeriod(p2.id, org.id, userId);
    await finalizePeriod(p3.id, org.id, userId);
    expect((await profitTaxDocs(org.id)).length).toBe(1); // ACCRUAL Q1 = 1 500 000

    // reopen февраля → начисление Q1 (лежит в периоде марта) должно удалиться
    const { POST: reopenPOST } = await import("@/app/api/periods/[id]/reopen/route");
    const res = await reopenPOST(
      new NextRequest("http://x/api/periods/reopen", { method: "POST" }),
      { params: Promise.resolve({ id: p2.id }) } as any
    );
    expect(res.status).toBe(200);
    expect((await profitTaxDocs(org.id)).length).toBe(0);
    expect(await prisma.taxCalendarEvent.count({
      where: { orgId: org.id, periodId: p3.id, type: "PROFIT_TAX", status: "PENDING" },
    })).toBe(0);

    // повторное закрытие февраля и следующего квартала (июнь) восстанавливает сумму:
    // accruedSoFar = 0 → начисление за полугодие целиком
    await finalizePeriod(p2.id, org.id, userId);
    const p6 = await makePeriod(org.id, y, 6);
    await finalizePeriod(p6.id, org.id, userId);
    const docs = await profitTaxDocs(org.id);
    expect(docs.length).toBe(1);
    expect((docs[0].payload as any).taxAmount).toBeCloseTo(1_500_000, 2);
    expect((docs[0].payload as any).quarter).toBe(2);
    expect(await net9810(org.id)).toBeCloseTo(1_500_000, 2);
  }, 120_000);
});

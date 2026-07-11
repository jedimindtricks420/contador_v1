import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import { NextRequest } from "next/server";
import Decimal from "decimal.js";
import { ensureBaseData } from "@/lib/ensureBaseData";
import { finalizePeriod } from "@/lib/closing";
import { generateProfitTaxReport, getProfitTaxLineDetails } from "@/lib/taxReport/engine";

// ─── Двухлетний сквозной аудит генератора «Расчёта налога на прибыль» ───────────
// Новая тестовая организация, 24 месяца операций (2025 + 2026), помесячные
// РЕАЛЬНЫЕ закрытия через finalizePeriod (квартальные начисления налога,
// реформация, годовое закрытие 9910→8710). На каждом из 8 квартальных срезов
// (кварталы, полугодия, 9 месяцев, год × 2 года) сверяются:
//   1) все строки Прил.1/Прил.2 и основной формы — с независимо посчитанными
//      ожиданиями из таблицы операций (не из кода движка);
//   2) Прил.1 стр.020 — с Формой №2 стр.010 (роут /api/pnl);
//   3) баланс (Форма №1) — равенство Актив/Пассив после каждого закрытия;
//   4) расшифровки строк (drill-down) — сумма документов == сумма строки;
//   5) строка 090 — с фактическими начислениями закрытия;
//   6) начисления closing.ts — с их же формулой (бухприбыль), а расхождение
//      «начислено vs строка 080» — точно равно ставке × (невычитаемые +
//      доходы, которые closing не включает в базу: 9530/9520).
// Плюс: смена метода себестоимости между годами и защита исторических отчётов.

let currentOrgId = "";
let currentUserId = "";
vi.mock("@/lib/context", () => ({
  getActiveOrgId: async () => currentOrgId,
  getActiveMembership: async () => ({ role: "OWNER", userId: currentUserId, orgId: currentOrgId }),
}));

const prisma = new PrismaClient();
const RATE = 0.15;

let userId: string;
let orgId: string;
const periodIds = new Map<string, string>(); // "2025-1" → id
const accountIdByCode = new Map<string, string>();
const typeIdByCode = new Map<string, string>();

// ─── Таблица операций — единственный источник ожиданий ─────────────────────────
// ap: куда операция должна попасть в форме (null — не участвует в расчёте).
// closingIncome/closingExpense: участвует ли сумма в базе closing.ts
// (computeCumulativeNetProfit): 9530/9520 закрытие в доход НЕ включает.

interface Op {
  y: number; m: number; d: number;
  type: string;
  debit: string; credit: string;
  amount: number;
  override?: boolean;
  ap?: { appendix: "APPENDIX_1" | "APPENDIX_2"; line: string; nonDeductible?: boolean };
  closingIncome?: number;  // вклад в доходную часть базы закрытия
  closingExpense?: number; // вклад в расходную часть базы закрытия
}

const OPS: Op[] = [
  // ── 2025 ──────────────────────────────────────────────────────────────
  { y: 2025, m: 1, d: 5, type: "CAPITAL_CONTRIBUTION", debit: "5110", credit: "8330", amount: 200_000_000 },
  { y: 2025, m: 1, d: 10, type: "INVOICE_CONFIRMED_PREPAID", debit: "4010", credit: "9030", amount: 10_000_000,
    ap: { appendix: "APPENDIX_1", line: "020" }, closingIncome: 10_000_000 },
  { y: 2025, m: 1, d: 25, type: "SALARY_ACCRUAL", debit: "9420", credit: "6710", amount: 3_000_000,
    ap: { appendix: "APPENDIX_2", line: "0105" }, closingExpense: 3_000_000 },
  { y: 2025, m: 2, d: 5, type: "GOODS_RECEIVED", debit: "2910", credit: "5110", amount: 20_000_000 },
  { y: 2025, m: 2, d: 10, type: "INVOICE_CONFIRMED_PREPAID", debit: "4010", credit: "9020", amount: 8_000_000,
    ap: { appendix: "APPENDIX_1", line: "020" }, closingIncome: 8_000_000 },
  { y: 2025, m: 2, d: 10, type: "GOODS_SOLD", debit: "9120", credit: "2910", amount: 5_000_000,
    ap: { appendix: "APPENDIX_2", line: "020" }, closingExpense: 5_000_000 },
  { y: 2025, m: 2, d: 15, type: "BANK_COMMISSION", debit: "9430", credit: "5110", amount: 100_000,
    ap: { appendix: "APPENDIX_2", line: "0137" }, closingExpense: 100_000 },
  { y: 2025, m: 3, d: 5, type: "RENT", debit: "9420", credit: "5110", amount: 1_500_000,
    ap: { appendix: "APPENDIX_2", line: "0111" }, closingExpense: 1_500_000 },
  { y: 2025, m: 3, d: 15, type: "INTEREST_PAYMENT", debit: "9610", credit: "5110", amount: 300_000,
    ap: { appendix: "APPENDIX_2", line: "0113" }, closingExpense: 300_000 },
  { y: 2025, m: 4, d: 10, type: "FINE_PENALTY", debit: "9430", credit: "5110", amount: 200_000,
    ap: { appendix: "APPENDIX_2", line: "0129", nonDeductible: true }, closingExpense: 200_000 },
  { y: 2025, m: 5, d: 12, type: "INTEREST_INCOME_RECEIVED", debit: "5110", credit: "9530", amount: 400_000,
    ap: { appendix: "APPENDIX_1", line: "050" } }, // closing НЕ включает 9530 в базу
  { y: 2025, m: 6, d: 10, type: "INVOICE_CONFIRMED_PREPAID", debit: "4010", credit: "9030", amount: 6_000_000,
    ap: { appendix: "APPENDIX_1", line: "020" }, closingIncome: 6_000_000 },
  { y: 2025, m: 7, d: 8, type: "ADVERTISING", debit: "9410", credit: "5110", amount: 500_000,
    ap: { appendix: "APPENDIX_2", line: "0109" }, closingExpense: 500_000 },
  { y: 2025, m: 8, d: 12, type: "INVOICE_CONFIRMED_PREPAID", debit: "4010", credit: "9030", amount: 5_000_000,
    ap: { appendix: "APPENDIX_1", line: "020" }, closingIncome: 5_000_000 },
  { y: 2025, m: 9, d: 20, type: "CHARITY_PAYMENT", debit: "9430", credit: "5110", amount: 300_000,
    ap: { appendix: "APPENDIX_2", line: "0122", nonDeductible: true }, closingExpense: 300_000 },
  { y: 2025, m: 10, d: 7, type: "GOODS_RECEIVED", debit: "2910", credit: "5110", amount: 10_000_000 },
  { y: 2025, m: 10, d: 10, type: "INVOICE_CONFIRMED_PREPAID", debit: "4010", credit: "9020", amount: 4_000_000,
    ap: { appendix: "APPENDIX_1", line: "020" }, closingIncome: 4_000_000 },
  { y: 2025, m: 10, d: 10, type: "GOODS_SOLD", debit: "9120", credit: "2910", amount: 2_500_000,
    ap: { appendix: "APPENDIX_2", line: "020" }, closingExpense: 2_500_000 },
  { y: 2025, m: 11, d: 14, type: "FX_DIFFERENCE", debit: "9620", credit: "5110", amount: 150_000,
    ap: { appendix: "APPENDIX_2", line: "0114" }, closingExpense: 150_000 },
  { y: 2025, m: 12, d: 5, type: "INVOICE_CONFIRMED_PREPAID", debit: "4010", credit: "9030", amount: 7_000_000,
    ap: { appendix: "APPENDIX_1", line: "020" }, closingIncome: 7_000_000 },
  { y: 2025, m: 12, d: 20, type: "SALARY_ACCRUAL", debit: "9420", credit: "6710", amount: 3_000_000,
    ap: { appendix: "APPENDIX_2", line: "0105" }, closingExpense: 3_000_000 },

  // ── 2026 ──────────────────────────────────────────────────────────────
  { y: 2026, m: 1, d: 10, type: "INVOICE_CONFIRMED_PREPAID", debit: "4010", credit: "9030", amount: 12_000_000,
    ap: { appendix: "APPENDIX_1", line: "020" }, closingIncome: 12_000_000 },
  { y: 2026, m: 1, d: 25, type: "SALARY_ACCRUAL", debit: "9420", credit: "6710", amount: 3_500_000,
    ap: { appendix: "APPENDIX_2", line: "0105" }, closingExpense: 3_500_000 },
  { y: 2026, m: 2, d: 14, type: "DELIVERY_TO_CUSTOMER", debit: "9410", credit: "5110", amount: 250_000,
    ap: { appendix: "APPENDIX_2", line: "0110" }, closingExpense: 250_000 },
  { y: 2026, m: 3, d: 3, type: "RENT", debit: "9420", credit: "5110", amount: 1_800_000,
    ap: { appendix: "APPENDIX_2", line: "0111" }, closingExpense: 1_800_000 },
  { y: 2026, m: 4, d: 9, type: "INVOICE_CONFIRMED_PREPAID", debit: "4010", credit: "9020", amount: 9_000_000,
    ap: { appendix: "APPENDIX_1", line: "020" }, closingIncome: 9_000_000 },
  { y: 2026, m: 4, d: 9, type: "GOODS_SOLD", debit: "9120", credit: "2910", amount: 6_000_000,
    ap: { appendix: "APPENDIX_2", line: "020" }, closingExpense: 6_000_000 },
  { y: 2026, m: 5, d: 6, type: "FINE_PENALTY", debit: "9430", credit: "5110", amount: 250_000,
    ap: { appendix: "APPENDIX_2", line: "0129", nonDeductible: true }, closingExpense: 250_000 },
  // Штраф, признанный вычитаемым переопределением на документе (ТЗ 1.2)
  { y: 2026, m: 5, d: 7, type: "FINE_PENALTY", debit: "9430", credit: "5110", amount: 80_000, override: true,
    ap: { appendix: "APPENDIX_2", line: "0129", nonDeductible: false }, closingExpense: 80_000 },
  // Дивиденды: в Прил.1 стр.120, но ИСКЛЮЧАЮТСЯ из стр.010 основной формы
  { y: 2026, m: 6, d: 11, type: "DIVIDEND_INCOME_RECEIVED", debit: "5110", credit: "9520", amount: 500_000,
    ap: { appendix: "APPENDIX_1", line: "120" } },
  { y: 2026, m: 7, d: 15, type: "INVOICE_CONFIRMED_PREPAID", debit: "4010", credit: "9030", amount: 6_500_000,
    ap: { appendix: "APPENDIX_1", line: "020" }, closingIncome: 6_500_000 },
  { y: 2026, m: 8, d: 20, type: "ADVERTISING", debit: "9410", credit: "5110", amount: 700_000,
    ap: { appendix: "APPENDIX_2", line: "0109" }, closingExpense: 700_000 },
  { y: 2026, m: 9, d: 25, type: "INTEREST_INCOME_RECEIVED", debit: "5110", credit: "9530", amount: 300_000,
    ap: { appendix: "APPENDIX_1", line: "050" } },
  { y: 2026, m: 10, d: 12, type: "INVOICE_CONFIRMED_PREPAID", debit: "4010", credit: "9020", amount: 5_000_000,
    ap: { appendix: "APPENDIX_1", line: "020" }, closingIncome: 5_000_000 },
  { y: 2026, m: 10, d: 12, type: "GOODS_SOLD", debit: "9120", credit: "2910", amount: 3_200_000,
    ap: { appendix: "APPENDIX_2", line: "020" }, closingExpense: 3_200_000 },
  { y: 2026, m: 11, d: 18, type: "BANK_COMMISSION", debit: "9430", credit: "5110", amount: 120_000,
    ap: { appendix: "APPENDIX_2", line: "0137" }, closingExpense: 120_000 },
  { y: 2026, m: 12, d: 8, type: "INVOICE_CONFIRMED_PREPAID", debit: "4010", credit: "9030", amount: 8_000_000,
    ap: { appendix: "APPENDIX_1", line: "020" }, closingIncome: 8_000_000 },
  { y: 2026, m: 12, d: 20, type: "SALARY_ACCRUAL", debit: "9420", credit: "6710", amount: 3_500_000,
    ap: { appendix: "APPENDIX_2", line: "0105" }, closingExpense: 3_500_000 },
];

// ─── Независимый расчёт ожиданий из таблицы операций ───────────────────────────

function quarterEnd(y: number, q: number) { return new Date(y, q * 3, 0, 23, 59, 59, 999); }

function opsUpTo(y: number, q: number): Op[] {
  const end = quarterEnd(y, q);
  return OPS.filter(o => o.y === y && new Date(o.y, o.m - 1, o.d) <= end);
}

function expectedFor(y: number, q: number) {
  const ops = opsUpTo(y, q);
  const ap1 = new Map<string, number>();
  const ap2 = new Map<string, { col3: number; col4: number }>();
  let closingIncome = 0, closingExpense = 0;
  for (const o of ops) {
    closingIncome += o.closingIncome ?? 0;
    closingExpense += o.closingExpense ?? 0;
    if (!o.ap) continue;
    if (o.ap.appendix === "APPENDIX_1") {
      ap1.set(o.ap.line, (ap1.get(o.ap.line) ?? 0) + o.amount);
    } else {
      const cur = ap2.get(o.ap.line) ?? { col3: 0, col4: 0 };
      cur.col3 += o.amount;
      if (o.ap.nonDeductible) cur.col4 += o.amount;
      ap2.set(o.ap.line, cur);
    }
  }
  const ap1Total = [...ap1.values()].reduce((s, v) => s + v, 0);
  const col3 = [...ap2.values()].reduce((s, v) => s + v.col3, 0);
  const col4 = [...ap2.values()].reduce((s, v) => s + v.col4, 0);
  const main010 = ap1Total - (ap1.get("120") ?? 0); // дивиденды исключаются
  const main020 = col3 - col4;
  const main030 = main010 - main020;
  const base = Math.max(main030, 0);
  const tax = new Decimal(base).mul(RATE).toNumber();
  const closingBase = Math.max(closingIncome - closingExpense, 0);
  const closingCumTax = new Decimal(closingBase).mul(RATE).toNumber();
  return { ap1, ap2, ap1Total, col3, col4, main010, main020, main030, tax, closingCumTax };
}

// ─── Инфраструктура ─────────────────────────────────────────────────────────────

async function accId(code: string) {
  if (!accountIdByCode.has(code)) {
    accountIdByCode.set(code, (await prisma.account.findUniqueOrThrow({ where: { code } })).id);
  }
  return accountIdByCode.get(code)!;
}
async function typId(code: string) {
  if (!typeIdByCode.has(code)) {
    typeIdByCode.set(code, (await prisma.documentType.findUniqueOrThrow({ where: { code } })).id);
  }
  return typeIdByCode.get(code)!;
}

// Начислено закрытиями в интервале [from, before) — строка 090 формы считается
// в рамках налогового года, поэтому from = 1 января отчётного года.
async function accruedFromDocs(from: Date, before: Date): Promise<number> {
  const docs = await prisma.document.findMany({
    where: {
      orgId, status: "POSTED", date: { gte: from, lt: before },
      type: { code: { in: ["PROFIT_TAX_ACCRUAL", "PROFIT_TAX_REVERSAL"] } },
    },
    include: { type: { select: { code: true } } },
  });
  return docs.reduce((s, d) => {
    const amt = Number((d.payload as any)?.taxAmount ?? 0);
    return d.type.code === "PROFIT_TAX_ACCRUAL" ? s + amt : s - amt;
  }, 0);
}

beforeAll(async () => {
  await ensureBaseData();
  const user = await prisma.user.create({
    data: { email: `audit2y_${Date.now()}@test.local`, name: "Audit 2Y", passwordHash: "x" },
  });
  userId = user.id;
  currentUserId = user.id;

  const org = await prisma.organization.create({
    data: {
      name: "ООО АУДИТ ДВА ГОДА",
      inn: `A2Y${Date.now()}`.slice(0, 20),
      taxRegime: "VAT", isVatPayer: true, autoAccrueProfitTax: true,
      members: { create: { userId, role: "OWNER" } },
    },
  });
  orgId = org.id;
  currentOrgId = org.id;

  // Периоды 2025-01 … 2026-12
  for (const y of [2025, 2026]) {
    for (let m = 1; m <= 12; m++) {
      const p = await prisma.period.create({
        data: {
          orgId, year: y, month: m,
          closingData: {
            currentStep: 7,
            accruals: { salaryAmount: 0, depreciationAmount: 0, rentAmount: 0 },
            fxDiff: { exchangeRate: 0, difference: 0 },
          } as any,
        },
      });
      periodIds.set(`${y}-${m}`, p.id);
    }
  }

  // Документы из таблицы операций
  for (const o of OPS) {
    const doc = await prisma.document.create({
      data: {
        orgId, periodId: periodIds.get(`${o.y}-${o.m}`)!,
        typeId: await typId(o.type),
        date: new Date(o.y, o.m - 1, o.d), status: "POSTED",
        payload: {} as any,
        taxDeductibleOverride: o.override ?? null,
      },
    });
    await prisma.journalEntry.createMany({
      data: [
        { documentId: doc.id, accountId: await accId(o.debit), debit: o.amount, credit: 0, date: doc.date },
        { documentId: doc.id, accountId: await accId(o.credit), debit: 0, credit: o.amount, date: doc.date },
      ],
    });
  }

  // Метод себестоимости 2025 — первый выбор, свободно (ТЗ 0.3)
  const { POST } = await import("@/app/api/settings/costing-method/route");
  const res2025 = await POST(new NextRequest("http://test/api", {
    method: "POST", body: JSON.stringify({ fiscalYear: 2025, costingMethod: "PROPORTIONAL" }),
    headers: { "Content-Type": "application/json" },
  }));
  if (res2025.status !== 201) throw new Error(`Метод 2025 не зафиксирован: ${res2025.status}`);

  // Закрываем 2025 помесячно (реальный flow: начисления, реформация, год)
  for (let m = 1; m <= 12; m++) {
    await finalizePeriod(periodIds.get(`2025-${m}`)!, orgId, userId);
  }

  // Смена метода на 2026 (DIRECT) — разрешена: 2025 полностью закрыт
  const res2026 = await POST(new NextRequest("http://test/api", {
    method: "POST", body: JSON.stringify({ fiscalYear: 2026, costingMethod: "DIRECT" }),
    headers: { "Content-Type": "application/json" },
  }));
  if (res2026.status !== 201) throw new Error(`Метод 2026 не зафиксирован: ${res2026.status} ${JSON.stringify(await res2026.json())}`);

  // Закрываем 2026 помесячно
  for (let m = 1; m <= 12; m++) {
    await finalizePeriod(periodIds.get(`2026-${m}`)!, orgId, userId);
  }
}, 300_000);

afterAll(async () => {
  if (orgId) await prisma.organization.delete({ where: { id: orgId } }).catch(() => {});
  if (userId) await prisma.user.delete({ where: { id: userId } }).catch(() => {});
  await prisma.$disconnect();
});

// ─── Сверка всех 8 квартальных срезов ───────────────────────────────────────────

const SLICES: [number, number, string][] = [
  [2025, 1, "2025 I квартал"], [2025, 2, "2025 полугодие"],
  [2025, 3, "2025 девять месяцев"], [2025, 4, "2025 год"],
  [2026, 1, "2026 I квартал"], [2026, 2, "2026 полугодие"],
  [2026, 3, "2026 девять месяцев"], [2026, 4, "2026 год"],
];

describe("двухлетний аудит: все квартальные/полугодовые/годовые формы", () => {
  for (const [y, q, label] of SLICES) {
    it(`${label}: строки Прил.1/Прил.2 и основная форма совпадают с независимым расчётом`, async () => {
      const exp = expectedFor(y, q);
      const r = await generateProfitTaxReport(orgId, y, q);

      // Приложение №1 — построчно
      for (const line of r.appendix1.lines) {
        const want = line.code === "010" ? exp.ap1Total : (exp.ap1.get(line.code) ?? 0);
        expect(line.amount, `${label}: Прил.1 стр.${line.code}`).toBe(want);
      }
      // Приложение №2 — построчно (010 = итог, 030 = прочие без себестоимости)
      for (const line of r.appendix2.lines) {
        let want3: number, want4: number;
        if (line.code === "010") { want3 = exp.col3; want4 = exp.col4; }
        else if (line.code === "030") {
          const cogs = exp.ap2.get("020") ?? { col3: 0, col4: 0 };
          want3 = exp.col3 - cogs.col3; want4 = exp.col4 - cogs.col4;
        } else {
          const v = exp.ap2.get(line.code) ?? { col3: 0, col4: 0 };
          want3 = v.col3; want4 = v.col4;
        }
        expect(line.col3, `${label}: Прил.2 стр.${line.code} гр.3`).toBe(want3);
        expect(line.col4, `${label}: Прил.2 стр.${line.code} гр.4`).toBe(want4);
      }

      // Основная форма: значения и внутренние формулы
      const M = r.mainForm.values;
      expect(M["010"], `${label}: стр.010`).toBe(exp.main010);
      expect(M["020"], `${label}: стр.020`).toBe(exp.main020);
      expect(M["030"], `${label}: стр.030`).toBe(exp.main030);
      expect(M["060"], `${label}: стр.060`).toBe(Math.max(exp.main030, 0));
      expect(M["062"], `${label}: стр.062`).toBe(M["060"] - M["061"]);
      expect(M["070"], `${label}: стр.070`).toBe(15);
      expect(M["080"], `${label}: стр.080`).toBe(exp.tax);
      expect(M["150"], `${label}: стр.150`).toBe(M["080"] - M["090"]);

      // Строка 090 == фактические начисления закрытий этого года до начала квартала
      const accrued = await accruedFromDocs(new Date(y, 0, 1), new Date(y, (q - 1) * 3, 1));
      expect(M["090"], `${label}: стр.090 vs документы начислений`).toBe(accrued);

      // Ни одного незамапленного счёта и ни одного неожиданного предупреждения
      expect(r.warnings.filter(w => w.includes("не замаплен")), `${label}: незамапленные счета`).toEqual([]);
      expect(r.warnings.filter(w => w.includes("GOODS_SOLD")), `${label}: ложное GOODS_SOLD`).toEqual([]);
      expect(r.warnings.filter(w => w.includes("Метод себестоимости")), `${label}: метод не подхвачен`).toEqual([]);
    });

    it(`${label}: Прил.1 стр.020 == Форма №2 стр.010 (роут /api/pnl)`, async () => {
      const { GET } = await import("@/app/api/pnl/route");
      const to = quarterEnd(y, q);
      const toStr = `${y}-${String(q * 3).padStart(2, "0")}-${String(to.getDate()).padStart(2, "0")}T23:59:59`;
      const res = await GET(new NextRequest(`http://test/api/pnl?from=${y}-01-01T00:00:00&to=${toStr}`));
      expect(res.status).toBe(200);
      const pnl = await res.json();
      const r = await generateProfitTaxReport(orgId, y, q);
      const ap1_020 = r.appendix1.lines.find(l => l.code === "020")!.amount;
      expect(ap1_020, `${label}: Прил.1 020 vs Форма №2 010`).toBe(pnl.lines.line010);
    });

    it(`${label}: Форма №1 — баланс сходится (Актив == Пассив)`, async () => {
      const { GET } = await import("@/app/api/reports/balance/route");
      const to = quarterEnd(y, q);
      const toStr = `${y}-${String(q * 3).padStart(2, "0")}-${String(to.getDate()).padStart(2, "0")}`;
      const res = await GET(new NextRequest(`http://test/api/reports/balance?to=${toStr}`));
      expect(res.status).toBe(200);
      const bal = await res.json();
      expect(bal.balanceCheck, `${label}: расхождение Актив/Пассив = ${bal.difference}`).toBe(true);
    });

    it(`${label}: расшифровки строк сходятся с суммами строк`, async () => {
      const r = await generateProfitTaxReport(orgId, y, q);
      // Прил.2: каждая ненулевая строка (себестоимость + детальные)
      for (const line of r.appendix2.lines) {
        if (line.code === "010" || line.code === "030") continue;
        if (line.col3 === 0) continue;
        const details = await getProfitTaxLineDetails(orgId, y, q, "APPENDIX_2", line.code);
        const sum = details.reduce((s, d) => s + d.amount, 0);
        const sumNd = details.filter(d => d.nonDeductible).reduce((s, d) => s + d.amount, 0);
        expect(sum, `${label}: drill-down Прил.2 ${line.code} гр.3`).toBe(line.col3);
        expect(sumNd, `${label}: drill-down Прил.2 ${line.code} гр.4`).toBe(line.col4);
      }
      // Прил.1: каждая ненулевая строка
      for (const line of r.appendix1.lines) {
        if (line.code === "010" || line.amount === 0) continue;
        const details = await getProfitTaxLineDetails(orgId, y, q, "APPENDIX_1", line.code);
        const sum = details.reduce((s, d) => s + d.amount, 0);
        expect(sum, `${label}: drill-down Прил.1 ${line.code}`).toBe(line.amount);
      }
    });
  }
});

// ─── Сквозные проверки между годами и с модулем закрытия ───────────────────────

describe("двухлетний аудит: сквозные инварианты", () => {
  it("границы года: 2026 Q1 не наследует ни оборотов, ни авансов 2025", async () => {
    const r = await generateProfitTaxReport(orgId, 2026, 1);
    const exp = expectedFor(2026, 1);
    expect(r.appendix1.total010).toBe(exp.ap1Total);
    expect(r.mainForm.values["090"]).toBe(0); // авансы 2025 не «протекают» в 2026
  });

  it("начисления closing.ts за каждый год равны его же базе (бухприбыль × ставка)", async () => {
    for (const y of [2025, 2026]) {
      const accrued = await accruedFromDocs(new Date(y, 0, 1), new Date(y + 1, 0, 1));
      const exp = expectedFor(y, 4);
      expect(accrued, `${y}: начислено закрытиями`).toBe(exp.closingCumTax);
    }
  });

  it("расхождение «строка 080 − начислено закрытием» = ставка × (невычитаемые + доходы 9530/9520 вне базы закрытия)", async () => {
    for (const y of [2025, 2026]) {
      const r = await generateProfitTaxReport(orgId, y, 4);
      const exp = expectedFor(y, 4);
      const accruedYear = await accruedFromDocs(new Date(y, 0, 1), new Date(y + 1, 0, 1));
      const diff = new Decimal(r.mainForm.values["080"]).minus(accruedYear).toNumber();
      // Доходы, которые генератор включает в стр.010, а closing в базу — нет:
      // 9530 (проценты). Дивиденды 9520 не включает НИ тот, НИ другой.
      const interestIncome = opsUpTo(y, 4)
        .filter(o => o.credit === "9530")
        .reduce((s, o) => s + o.amount, 0);
      const expectedDiff = new Decimal(exp.col4 + interestIncome).mul(RATE).toNumber();
      expect(diff, `${y}: расхождение форма↔начисление`).toBe(expectedDiff);
    }
  });

  it("метод себестоимости: 2025 — PROPORTIONAL, 2026 — DIRECT; исторический отчёт защищён", async () => {
    const r2025 = await generateProfitTaxReport(orgId, 2025, 4);
    const r2026 = await generateProfitTaxReport(orgId, 2026, 4);
    // 2025 считается по методу, действовавшему В ТОМ году, несмотря на смену
    expect(r2025.meta.costingMethod).toBe("PROPORTIONAL");
    expect(r2025.appendixStatuses.find(a => a.code === "2.1b")?.status).toBe("NEEDS_DATA");
    expect(r2025.appendixStatuses.find(a => a.code === "2.1a")?.status).toBe("NOT_APPLICABLE");
    // 2026 — уже прямой метод, приложения меняются местами
    expect(r2026.meta.costingMethod).toBe("DIRECT");
    expect(r2026.appendixStatuses.find(a => a.code === "2.1a")?.status).toBe("NEEDS_DATA");
    expect(r2026.appendixStatuses.find(a => a.code === "2.1b")?.status).toBe("NOT_APPLICABLE");
  });

  it("статусы приложений: кварталы — ANNUAL_ONLY для годовых, год — рабочие статусы", async () => {
    for (const [y, q] of [[2025, 1], [2025, 2], [2025, 3], [2026, 1], [2026, 2], [2026, 3]] as const) {
      const r = await generateProfitTaxReport(orgId, y, q);
      for (const code of ["2.1", "2.1a", "2.1b", "8"]) {
        expect(r.appendixStatuses.find(a => a.code === code)?.status, `${y} Q${q} прил.${code}`).toBe("ANNUAL_ONLY");
      }
      expect(r.appendixStatuses.find(a => a.code === "1")?.status).toBe("FILLED");
      expect(r.appendixStatuses.find(a => a.code === "2")?.status).toBe("FILLED");
    }
  });

  it("реформация и годовое закрытие не искажают форму: 24 периода закрыты, 9910/8710 вне расчёта", async () => {
    const closed = await prisma.period.count({ where: { orgId, status: "CLOSED" } });
    expect(closed).toBe(24);
    const ye = await prisma.document.count({ where: { orgId, type: { code: "YEAR_END_CLOSE" } } });
    expect(ye).toBe(2); // обе годовые реформации выполнены
    // Контроль: суммы формы уже сверены с ожиданиями, посчитанными БЕЗ учёта
    // PERIOD_CLOSING/YEAR_END_CLOSE — совпадение доказывает исключение реформации.
  });

  it("сводная таблица аудита (печать для протокола)", async () => {
    const rows: string[] = [];
    rows.push("срез             | 010 доход  | 020 вычит. | 030 приб. | 080 налог | 090 аванс | 150 к упл.");
    for (const [y, q, label] of SLICES) {
      const M = (await generateProfitTaxReport(orgId, y, q)).mainForm.values;
      rows.push(
        `${label.padEnd(16)} | ${String(M["010"]).padStart(10)} | ${String(M["020"]).padStart(10)} | ` +
        `${String(M["030"]).padStart(9)} | ${String(M["080"]).padStart(9)} | ${String(M["090"]).padStart(9)} | ${String(M["150"]).padStart(9)}`
      );
    }
    console.log("\n=== АУДИТ: основная форма по 8 срезам ===\n" + rows.join("\n"));
    expect(rows.length).toBe(9);
  });

  it("после смены метода попытка перезаписать 2026 возвращает 409", async () => {
    const { POST } = await import("@/app/api/settings/costing-method/route");
    const res = await POST(new NextRequest("http://test/api", {
      method: "POST", body: JSON.stringify({ fiscalYear: 2026, costingMethod: "PROPORTIONAL" }),
      headers: { "Content-Type": "application/json" },
    }));
    expect(res.status).toBe(409);
  });
});

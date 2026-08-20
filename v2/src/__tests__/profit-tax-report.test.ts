import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import { NextRequest } from "next/server";
import { ensureBaseData } from "@/lib/ensureBaseData";
import { generateProfitTaxReport, getProfitTaxLineDetails } from "@/lib/taxReport/engine";
import {
  DEFAULT_TAX_REPORT_MAPPING,
  TAX_REPORT_EXCLUDED_TRANSIT_CODES,
  APPENDIX1_LINES, APPENDIX2_LINES,
} from "@/lib/taxReport/constants";
import { MASTER_COA } from "@/lib/seed-coa";
import { finalizePeriod } from "@/lib/closing";

// Генератор «Расчёта налога на прибыль» (ТЗ: docs/TZ_generator_otcheta_i_dashboard.md):
// - Приложение №1/№2 раскладываются по TaxReportAccountMapping (счёт → строка,
//   правило по типу документа приоритетнее правила по счёту);
// - основная форма 010–150 считается нарастающим итогом с начала года;
// - строка 090 — начисленные авансы из PROFIT_TAX_ACCRUAL предыдущих кварталов;
// - Document.taxDeductibleOverride переопределяет графу 4;
// - метод себестоимости фиксируется на год (409 при попытке смены в открытом году).

let currentOrgId = "";
let currentUserId = "";
vi.mock("@/lib/context", () => ({
  getActiveOrgId: async () => currentOrgId,
  getActiveMembership: async () => ({ role: "OWNER", userId: currentUserId, orgId: currentOrgId }),
}));

const prisma = new PrismaClient();

let userId: string;
const orgIds: string[] = [];
const accountIdByCode = new Map<string, string>();
const typeIdByCode = new Map<string, string>();

async function accountId(code: string) {
  if (!accountIdByCode.has(code)) {
    const acc = await prisma.account.findUniqueOrThrow({ where: { code } });
    accountIdByCode.set(code, acc.id);
  }
  return accountIdByCode.get(code)!;
}

async function typeId(code: string) {
  if (!typeIdByCode.has(code)) {
    const t = await prisma.documentType.findUniqueOrThrow({ where: { code } });
    typeIdByCode.set(code, t.id);
  }
  return typeIdByCode.get(code)!;
}

async function makeOrg(extra: Record<string, unknown> = {}) {
  const org = await prisma.organization.create({
    data: {
      name: `ООО PTReport ${orgIds.length}`,
      inn: `PT${Date.now()}${orgIds.length}`.slice(0, 20),
      taxRegime: "VAT",
      isVatPayer: true,
      members: { create: { userId, role: "OWNER" } },
      ...extra,
    } as any,
  });
  orgIds.push(org.id);
  return org;
}

async function makePeriod(orgId: string, year: number, month: number, status: "OPEN" | "CLOSED" = "OPEN") {
  return prisma.period.create({ data: { orgId, year, month, status } });
}

/// Создаёт POSTED-документ с проводками напрямую (движок генератора read-only,
/// posting engine для теста раскладки не нужен).
async function makeDoc(
  orgId: string,
  periodId: string,
  docTypeCode: string,
  date: Date,
  entries: { code: string; debit?: number; credit?: number }[],
  opts: { override?: boolean | null; payload?: Record<string, unknown> } = {}
) {
  const doc = await prisma.document.create({
    data: {
      orgId, periodId,
      typeId: await typeId(docTypeCode),
      date, status: "POSTED",
      payload: (opts.payload ?? {}) as any,
      taxDeductibleOverride: opts.override ?? null,
    },
  });
  for (const e of entries) {
    await prisma.journalEntry.create({
      data: {
        documentId: doc.id,
        accountId: await accountId(e.code),
        debit: e.debit ?? 0,
        credit: e.credit ?? 0,
        date,
      },
    });
  }
  return doc;
}

beforeAll(async () => {
  await ensureBaseData();
  const user = await prisma.user.create({
    data: { email: `ptreport_${Date.now()}@test.local`, name: "PT Report Test", passwordHash: "x" },
  });
  userId = user.id;
  currentUserId = user.id;
}, 60_000);

afterAll(async () => {
  for (const id of orgIds) {
    await prisma.organization.delete({ where: { id } }).catch(() => {});
  }
  if (userId) await prisma.user.delete({ where: { id: userId } }).catch(() => {});
  await prisma.$disconnect();
});

// ─── Полнота маппинга (по образцу pnl-transit-completeness) ─────────────────────

describe("полнота дефолтного маппинга", () => {
  it("каждый TRANSIT-счёт плана замаплен на строку Прил.1/№2 или явно исключён", () => {
    const mapped = new Set(DEFAULT_TAX_REPORT_MAPPING.map(m => m.accountCode));
    const excluded = new Set(TAX_REPORT_EXCLUDED_TRANSIT_CODES);
    const missing = MASTER_COA
      .filter(a => a.type === "TRANSIT" && !a.isDeprecated)
      .map(a => a.code)
      .filter(code => !mapped.has(code) && !excluded.has(code));
    expect(missing, `TRANSIT-счета без маппинга и без явного исключения: ${missing.join(", ")}`).toEqual([]);
  });

  it("каждое правило маппинга ссылается на существующую строку приложения", () => {
    const ap1Codes = new Set(APPENDIX1_LINES.map(l => l.code));
    const ap2Codes = new Set(APPENDIX2_LINES.map(l => l.code));
    for (const m of DEFAULT_TAX_REPORT_MAPPING) {
      const codes = m.appendixCode === "APPENDIX_1" ? ap1Codes : ap2Codes;
      expect(codes.has(m.lineCode), `${m.accountCode} → ${m.appendixCode}.${m.lineCode}: строки нет в форме`).toBe(true);
    }
  });

  it("сид создал дефолтные строки маппинга в БД", async () => {
    const count = await prisma.taxReportAccountMapping.count({ where: { orgId: null } });
    expect(count).toBe(DEFAULT_TAX_REPORT_MAPPING.length);
  });
});

// ─── Движок: раскладка по строкам и основная форма ─────────────────────────────

describe("generateProfitTaxReport", () => {
  let orgA: { id: string };

  beforeAll(async () => {
    orgA = await makeOrg();
    const p3 = await makePeriod(orgA.id, 2026, 3, "CLOSED");
    const p4 = await makePeriod(orgA.id, 2026, 4);
    const apr = new Date(2026, 3, 15);

    // Аванс Q1: начислен налог 100 000 (строка 090 для Q2)
    await makeDoc(orgA.id, p3.id, "PROFIT_TAX_ACCRUAL", new Date(2026, 2, 28), [
      { code: "9810", debit: 100_000 }, { code: "6410", credit: 100_000 },
    ], { payload: { taxAmount: 100_000 } });

    // Доходы: услуги 10 000 000 (Кт 9030), проценты 500 000 (Кт 9530)
    await makeDoc(orgA.id, p4.id, "INVOICE_CONFIRMED_PREPAID", apr, [
      { code: "6310", debit: 10_000_000 }, { code: "9030", credit: 10_000_000 },
    ]);
    await makeDoc(orgA.id, p4.id, "INTEREST_INCOME_RECEIVED", apr, [
      { code: "5110", debit: 500_000 }, { code: "9530", credit: 500_000 },
    ]);

    // Расходы
    await makeDoc(orgA.id, p4.id, "GOODS_SOLD", apr, [
      { code: "9120", debit: 3_000_000 }, { code: "2910", credit: 3_000_000 },
    ]);
    await makeDoc(orgA.id, p4.id, "SALARY_ACCRUAL", apr, [
      { code: "9420", debit: 2_000_000 }, { code: "6710", credit: 2_000_000 },
    ]);
    await makeDoc(orgA.id, p4.id, "RENT", apr, [
      { code: "9420", debit: 1_000_000 }, { code: "5110", credit: 1_000_000 },
    ]);
    await makeDoc(orgA.id, p4.id, "BANK_COMMISSION", apr, [
      { code: "9430", debit: 50_000 }, { code: "5110", credit: 50_000 },
    ]);
    await makeDoc(orgA.id, p4.id, "INTEREST_PAYMENT", apr, [
      { code: "9610", debit: 200_000 }, { code: "5110", credit: 200_000 },
    ]);
    // Штраф в бюджет: по дефолту невычитаемый (0129, гр.4)
    await makeDoc(orgA.id, p4.id, "FINE_PENALTY", apr, [
      { code: "9430", debit: 100_000 }, { code: "5110", credit: 100_000 },
    ]);
    // Штраф с переопределением «вычитаемый» на документе (ТЗ 1.2)
    await makeDoc(orgA.id, p4.id, "FINE_PENALTY", apr, [
      { code: "9430", debit: 40_000 }, { code: "5110", credit: 40_000 },
    ], { override: true });
  }, 60_000);

  const ap2 = (r: any, code: string) => r.appendix2.lines.find((l: any) => l.code === code);
  const ap1 = (r: any, code: string) => r.appendix1.lines.find((l: any) => l.code === code);

  it("Приложение №1: выручка в 020, проценты в 050, итог 010", async () => {
    const r = await generateProfitTaxReport(orgA.id, 2026, 2);
    expect(ap1(r, "020").amount).toBe(10_000_000);
    expect(ap1(r, "050").amount).toBe(500_000);
    expect(r.appendix1.total010).toBe(10_500_000);
  });

  it("Приложение №2: раскладка по строкам, приоритет правила по типу документа", async () => {
    const r = await generateProfitTaxReport(orgA.id, 2026, 2);
    expect(ap2(r, "020").col3).toBe(3_000_000);   // GOODS_SOLD → себестоимость
    expect(ap2(r, "0105").col3).toBe(2_000_000);  // SALARY_ACCRUAL: 9420, но строка зарплаты
    expect(ap2(r, "0111").col3).toBe(1_000_000);  // RENT: 9420 → аренда
    expect(ap2(r, "0113").col3).toBe(200_000);    // 9610 → проценты
    expect(ap2(r, "0137").col3).toBe(50_000);     // BANK_COMMISSION: остаток 9430
    // Штрафы: 140 000 всего, невычитаемые только 100 000 (у 40 000 override=true)
    expect(ap2(r, "0129").col3).toBe(140_000);
    expect(ap2(r, "0129").col4).toBe(100_000);
    // Итог 010 = 020 (себестоимость) + 030 (прочие)
    expect(r.appendix2.total010.col3).toBe(6_390_000);
    expect(r.appendix2.total010.col4).toBe(100_000);
    expect(r.appendix2.deductible).toBe(6_290_000);
    expect(ap2(r, "030").col3).toBe(3_390_000);
  });

  it("основная форма: 010–150 с авансом Q1 в строке 090", async () => {
    const r = await generateProfitTaxReport(orgA.id, 2026, 2);
    const M = r.mainForm.values;
    expect(M["010"]).toBe(10_500_000);
    expect(M["020"]).toBe(6_290_000);
    expect(M["030"]).toBe(4_210_000);
    expect(M["060"]).toBe(4_210_000);
    expect(M["062"]).toBe(4_210_000);
    expect(M["070"]).toBe(15);
    expect(M["080"]).toBe(631_500);
    expect(M["090"]).toBe(100_000); // PROFIT_TAX_ACCRUAL за Q1
    expect(M["150"]).toBe(531_500);
  });

  it("нарастающий итог: за Q1 обороты апреля не видны", async () => {
    const r = await generateProfitTaxReport(orgA.id, 2026, 1);
    expect(r.appendix1.total010).toBe(0);
    expect(r.appendix2.total010.col3).toBe(0);
    // Начисление налога Q1 — не расход налогового учёта (тип исключён)
    expect(r.mainForm.values["090"]).toBe(0); // до начала Q1 авансов не было
  });

  it("drill-down строки 0129 возвращает оба документа-штрафа с признаком вычитаемости", async () => {
    const details = await getProfitTaxLineDetails(orgA.id, 2026, 2, "APPENDIX_2", "0129");
    expect(details).toHaveLength(2);
    const nd = details.filter(d => d.nonDeductible);
    const dd = details.filter(d => !d.nonDeductible);
    expect(nd).toHaveLength(1);
    expect(nd[0].amount).toBe(100_000);
    expect(dd).toHaveLength(1);
    expect(dd[0].amount).toBe(40_000);
    expect(dd[0].override).toBe(true);
  });

  it("маппинг организации переопределяет дефолт для того же счёта", async () => {
    const orgB = await makeOrg();
    const p = await makePeriod(orgB.id, 2026, 4);
    await makeDoc(orgB.id, p.id, "BANK_COMMISSION", new Date(2026, 3, 10), [
      { code: "9430", debit: 70_000 }, { code: "5110", credit: 70_000 },
    ]);
    // Дефолт: 9430 → 0137. Переопределение орг.: 9430 → 0128, невычитаемые.
    await prisma.taxReportAccountMapping.create({
      data: {
        orgId: orgB.id, accountCode: "9430", documentTypeCode: null,
        appendixCode: "APPENDIX_2", lineCode: "0128", column: "NON_DEDUCTIBLE", isDefault: false,
      },
    });
    const r = await generateProfitTaxReport(orgB.id, 2026, 2);
    expect(ap2(r, "0137").col3).toBe(0);
    expect(ap2(r, "0128").col3).toBe(70_000);
    expect(ap2(r, "0128").col4).toBe(70_000);
  });

  it("товарная выручка без списания себестоимости даёт предупреждение GOODS_SOLD", async () => {
    const orgC = await makeOrg();
    const p = await makePeriod(orgC.id, 2026, 4);
    await makeDoc(orgC.id, p.id, "INVOICE_CONFIRMED_PREPAID", new Date(2026, 3, 12), [
      { code: "6310", debit: 5_000_000 }, { code: "9020", credit: 5_000_000 },
    ]);
    const r = await generateProfitTaxReport(orgC.id, 2026, 2);
    expect(r.warnings.some(w => w.includes("GOODS_SOLD"))).toBe(true);
  });

  it("льгота IT Park: ставка 0%, вся прибыль в строке 040, статус Прил.№6 FILLED", async () => {
    const orgIt = await makeOrg({
      taxBenefit: "IT_PARK_RESIDENT",
      itParkResidentSince: new Date(2026, 0, 1),
    });
    const p = await makePeriod(orgIt.id, 2026, 4);
    await makeDoc(orgIt.id, p.id, "INVOICE_CONFIRMED_PREPAID", new Date(2026, 3, 12), [
      { code: "6310", debit: 1_000_000 }, { code: "9030", credit: 1_000_000 },
    ]);
    const r = await generateProfitTaxReport(orgIt.id, 2026, 2);
    const M = r.mainForm.values;
    expect(r.meta.benefitActive).toBe(true);
    expect(M["030"]).toBe(1_000_000);
    expect(M["040"]).toBe(1_000_000);
    expect(M["062"]).toBe(0);
    expect(M["070"]).toBe(0);
    expect(M["080"]).toBe(0);
    const ap6 = r.appendixStatuses.find(a => a.code === "6");
    expect(ap6?.status).toBe("FILLED");
  });

  it("статусы приложений: годовые заглушки помечены ANNUAL_ONLY в квартале", async () => {
    const r = await generateProfitTaxReport(orgA.id, 2026, 2);
    for (const code of ["2.1", "2.1a", "2.1b", "8"]) {
      expect(r.appendixStatuses.find(a => a.code === code)?.status).toBe("ANNUAL_ONLY");
    }
    expect(r.appendixStatuses.find(a => a.code === "1")?.status).toBe("FILLED");
    expect(r.appendixStatuses.find(a => a.code === "2")?.status).toBe("FILLED");
  });
});

// ─── Метод себестоимости: правило фиксации на год (ТЗ 0.3) ─────────────────────

describe("costing-method API", () => {
  it("первый выбор свободен; смена в открытом году — 409; смена после закрытия года — разрешена", async () => {
    const org = await makeOrg();
    currentOrgId = org.id;
    const { GET, POST } = await import("@/app/api/settings/costing-method/route");

    const post = (body: unknown) => POST(new NextRequest("http://test/api/settings/costing-method", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    }));

    // 1. Первый выбор — свободно, в любой момент года
    let res = await post({ fiscalYear: 2027, costingMethod: "PROPORTIONAL" });
    expect(res.status).toBe(201);

    // 2. Запись на год уже есть → 409, без молчаливой перезаписи
    res = await post({ fiscalYear: 2027, costingMethod: "DIRECT" });
    expect(res.status).toBe(409);
    expect((await res.json()).error).toContain("фиксируется на весь год");

    // 3. Смена метода на 2028 при незакрытом 2027 → 409
    await makePeriod(org.id, 2027, 11, "CLOSED");
    await makePeriod(org.id, 2027, 12, "OPEN");
    res = await post({ fiscalYear: 2028, costingMethod: "DIRECT" });
    expect(res.status).toBe(409);

    // 4. Фиксация ТОГО ЖЕ метода на 2028 — не смена, разрешена
    res = await post({ fiscalYear: 2028, costingMethod: "PROPORTIONAL" });
    expect(res.status).toBe(201);

    // 5. Полное закрытие 2028 (включая декабрь) → смена на 2029 разрешена
    await prisma.period.updateMany({ where: { orgId: org.id, year: 2027 }, data: { status: "CLOSED" } });
    await makePeriod(org.id, 2028, 12, "CLOSED");
    res = await post({ fiscalYear: 2029, costingMethod: "DIRECT" });
    expect(res.status).toBe(201);

    // 6. GET: история и действующий метод (2029 → DIRECT, 2028 → PROPORTIONAL)
    let getRes = await GET(new NextRequest("http://test/api/settings/costing-method?year=2029"));
    let json = await getRes.json();
    expect(json.effectiveMethod).toBe("DIRECT");
    expect(json.history).toHaveLength(3);

    getRes = await GET(new NextRequest("http://test/api/settings/costing-method?year=2028"));
    json = await getRes.json();
    expect(json.effectiveMethod).toBe("PROPORTIONAL");
  }, 60_000);
});

// ─── Pre-close предупреждение в finalizePeriod ──────────────────────────────────

describe("finalizePeriod: блокировка при несписанной себестоимости", () => {
  it("Кт 9020 без GOODS_SOLD за период → блокирует закрытие, confirmMissingCogs=true закрывает с warning", async () => {
    const org = await makeOrg();
    const period = await prisma.period.create({
      data: {
        orgId: org.id, year: 2026, month: 1,
        closingData: {
          currentStep: 7,
          accruals: { salaryAmount: 0, depreciationAmount: 0, rentAmount: 0 },
          fxDiff: { exchangeRate: 0, difference: 0 },
        } as any,
      },
    });
    await makeDoc(org.id, period.id, "INVOICE_CONFIRMED_PREPAID", new Date(2026, 0, 15), [
      { code: "6310", debit: 2_000_000 }, { code: "9020", credit: 2_000_000 },
    ]);

    await expect(finalizePeriod(period.id, org.id, userId)).rejects.toThrow(/себестоимост/);

    const result = await finalizePeriod(period.id, org.id, userId, undefined, { confirmMissingCogs: true });
    expect(result.period.status).toBe("CLOSED");
    expect(result.warnings.some((w: string) => w.includes("GOODS_SOLD"))).toBe(true);
  }, 60_000);

  it("Кт 9020 с полным списанием GOODS_SOLD → закрывается сразу, без блокировки и без warning", async () => {
    const org = await makeOrg();
    const period = await prisma.period.create({
      data: {
        orgId: org.id, year: 2026, month: 1,
        closingData: {
          currentStep: 7,
          accruals: { salaryAmount: 0, depreciationAmount: 0, rentAmount: 0 },
          fxDiff: { exchangeRate: 0, difference: 0 },
        } as any,
      },
    });
    await makeDoc(org.id, period.id, "INVOICE_CONFIRMED_PREPAID", new Date(2026, 0, 15), [
      { code: "6310", debit: 2_000_000 }, { code: "9020", credit: 2_000_000 },
    ]);
    await makeDoc(org.id, period.id, "GOODS_SOLD", new Date(2026, 0, 15), [
      { code: "9120", debit: 2_000_000 }, { code: "2910", credit: 2_000_000 },
    ]);

    const result = await finalizePeriod(period.id, org.id, userId);
    expect(result.period.status).toBe("CLOSED");
    expect(result.warnings.some((w: string) => w.includes("GOODS_SOLD"))).toBe(false);
  }, 60_000);

  it("Кт 9020 с GOODS_SOLD на сумму меньше выручки (нормальная маржа) → закрывается без блокировки", async () => {
    // Себестоимость по определению меньше выручки при прибыльной продаже —
    // проверка смотрит на ФАКТ списания (документ GOODS_SOLD существует), а не
    // на равенство сумм, иначе любая маржинальная продажа ложно блокировала бы
    // закрытие (см. комментарий у H0b в closing.ts).
    const org = await makeOrg();
    const period = await prisma.period.create({
      data: {
        orgId: org.id, year: 2026, month: 1,
        closingData: {
          currentStep: 7,
          accruals: { salaryAmount: 0, depreciationAmount: 0, rentAmount: 0 },
          fxDiff: { exchangeRate: 0, difference: 0 },
        } as any,
      },
    });
    await makeDoc(org.id, period.id, "INVOICE_CONFIRMED_PREPAID", new Date(2026, 0, 15), [
      { code: "6310", debit: 2_000_000 }, { code: "9020", credit: 2_000_000 },
    ]);
    await makeDoc(org.id, period.id, "GOODS_SOLD", new Date(2026, 0, 15), [
      { code: "9120", debit: 1_500_000 }, { code: "2910", credit: 1_500_000 },
    ]);

    const result = await finalizePeriod(period.id, org.id, userId);
    expect(result.period.status).toBe("CLOSED");
    expect(result.warnings.some((w: string) => w.includes("GOODS_SOLD"))).toBe(false);
  }, 60_000);
});

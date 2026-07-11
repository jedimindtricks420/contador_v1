import prisma from "../prisma";
import Decimal from "decimal.js";
import { TAX_RATES } from "../constants";
import {
  APPENDIX1_LINES, APPENDIX1_SUM_LINES,
  APPENDIX2_LINES, APPENDIX2_DETAIL_CODES, APPENDIX2_COGS_LINE,
  MAIN_FORM_LINES, APPENDIX_LIST,
  TAX_REPORT_EXCLUDED_DOC_TYPES, TAX_REPORT_EXCLUDED_TRANSIT_CODES,
  type AppendixStatus, type TaxAppendixCode, type TaxReportColumn,
} from "./constants";

// ─── Генератор «Расчёта налога на прибыль» ──────────────────────────────────────
// Read-only: агрегирует проводки за диапазон [1 января, конец отчётного квартала]
// (нарастающим итогом — ст. 296 ч.4, ст. 339 ч.2 НК, как computeCumulativeNetProfit
// в closing.ts) и раскладывает их по строкам формы my.soliq.uz через
// TaxReportAccountMapping. Ничего не проводит и не пишет в БД — дашборд
// обновляется «на лету», не только по закрытию периода.

export interface TaxMappingRule {
  accountCode: string;
  documentTypeCode: string | null;
  appendixCode: TaxAppendixCode;
  lineCode: string;
  column: TaxReportColumn;
}

interface AggRow {
  code: string;         // код счёта
  docType: string;      // код типа документа
  override: boolean | null; // Document.taxDeductibleOverride
  sumDebit: string;
  sumCredit: string;
}

export interface Appendix1Result {
  lines: { code: string; label: string; amount: number; kind: "computed" | "manual"; indent?: number }[];
  total010: number;
}

export interface Appendix2Result {
  lines: { code: string; label: string; col3: number; col4: number; kind: "computed" | "manual"; indent?: number }[];
  total010: { col3: number; col4: number };
  deductible: number; // графа 3 − графа 4 строки 010 → строка 020 основной формы
}

export interface MainFormResult {
  lines: { code: string; label: string; amount: number; kind: "computed" | "manual" }[];
  values: Record<string, number>;
}

export interface AppendixStatusItem {
  code: string;
  title: string;
  status: AppendixStatus;
  note: string;
}

export interface ProfitTaxReport {
  meta: {
    orgName: string;
    inn: string | null;
    year: number;
    quarter: number;
    periodFrom: string;
    periodTo: string;
    isAnnual: boolean;
    taxRatePct: number;
    taxBenefit: string;
    benefitActive: boolean;
    costingMethod: "PROPORTIONAL" | "DIRECT" | null;
    avgHeadcount: number;
    avgHeadcountDisabled: number;
    generatedAt: string;
  };
  appendix1: Appendix1Result;
  appendix2: Appendix2Result;
  mainForm: MainFormResult;
  appendixStatuses: AppendixStatusItem[];
  warnings: string[];
}

function quarterRange(year: number, quarter: number) {
  const from = new Date(year, 0, 1);
  const to = new Date(year, quarter * 3, 0, 23, 59, 59, 999);
  const quarterStart = new Date(year, (quarter - 1) * 3, 1);
  return { from, to, quarterStart };
}

const r2 = (d: Decimal) => Number(d.toDecimalPlaces(2));

/// Загружает действующий маппинг организации: дефолтные строки (orgId=null),
/// перекрытые строками организации по ключу (accountCode, documentTypeCode).
export async function loadMappingRules(orgId: string, db: any = prisma): Promise<TaxMappingRule[]> {
  const rows = await db.taxReportAccountMapping.findMany({
    where: { OR: [{ orgId: null }, { orgId }] },
  });
  const byKey = new Map<string, TaxMappingRule>();
  // Сначала дефолты, затем организация — org-строки перезаписывают дефолт.
  for (const pass of [rows.filter((r: any) => r.orgId === null), rows.filter((r: any) => r.orgId === orgId)]) {
    for (const r of pass) {
      byKey.set(`${r.accountCode}|${r.documentTypeCode ?? ""}`, {
        accountCode: r.accountCode,
        documentTypeCode: r.documentTypeCode ?? null,
        appendixCode: r.appendixCode,
        lineCode: r.lineCode,
        column: r.column,
      });
    }
  }
  return [...byKey.values()];
}

function resolveRule(rules: TaxMappingRule[], accountCode: string, docType: string): TaxMappingRule | null {
  // Правило по типу документа приоритетнее правила по счёту.
  return rules.find(r => r.accountCode === accountCode && r.documentTypeCode === docType)
    ?? rules.find(r => r.accountCode === accountCode && r.documentTypeCode === null)
    ?? null;
}

/// Метод себестоимости, действующий в налоговом году: запись на сам год, иначе
/// последняя запись более раннего года (метод «тянется» до явной смены).
export async function getCostingMethodForYear(orgId: string, fiscalYear: number, db: any = prisma) {
  const rec = await db.orgCostingMethodHistory.findFirst({
    where: { orgId, fiscalYear: { lte: fiscalYear } },
    orderBy: { fiscalYear: "desc" },
  });
  return rec?.costingMethod ?? null;
}

async function aggregateTransitTurnover(orgId: string, from: Date, to: Date, db: any): Promise<AggRow[]> {
  return db.$queryRaw`
    SELECT a.code,
           dt.code                    AS "docType",
           d."taxDeductibleOverride"  AS "override",
           SUM(je.debit)::text        AS "sumDebit",
           SUM(je.credit)::text       AS "sumCredit"
    FROM "JournalEntry" je
    JOIN "Document"     d  ON d.id  = je."documentId"
    JOIN "DocumentType" dt ON dt.id = d."typeId"
    JOIN "Account"      a  ON a.id  = je."accountId"
    WHERE d."orgId" = ${orgId}
      AND d.status  = 'POSTED'
      AND d.date   >= ${from}
      AND d.date   <= ${to}
      AND a.type    = 'TRANSIT'
      AND dt.code   NOT IN ('PERIOD_CLOSING', 'YEAR_END_CLOSE', 'PROFIT_TAX_ACCRUAL', 'PROFIT_TAX_REVERSAL')
    GROUP BY a.code, dt.code, d."taxDeductibleOverride"
  `;
}

/// Начислено авансом за предыдущие отчётные периоды года (строка 090 основной
/// формы, примечание 4 портала: в ненарастающем порядке = ранее начисленное).
/// Источник — документы PROFIT_TAX_ACCRUAL/REVERSAL, как в блоке E2 closing.ts.
export async function sumAccruedAdvances(orgId: string, from: Date, before: Date, db: any = prisma): Promise<Decimal> {
  const docs = await db.document.findMany({
    where: {
      orgId, status: "POSTED",
      date: { gte: from, lt: before },
      type: { code: { in: ["PROFIT_TAX_ACCRUAL", "PROFIT_TAX_REVERSAL"] } },
    },
    include: { type: { select: { code: true } } },
  });
  let sum = new Decimal(0);
  for (const d of docs) {
    const amt = new Decimal((d.payload as any)?.taxAmount ?? 0);
    sum = d.type.code === "PROFIT_TAX_ACCRUAL" ? sum.plus(amt) : sum.minus(amt);
  }
  return sum;
}

export async function generateProfitTaxReport(
  orgId: string,
  year: number,
  quarter: number,
  db: any = prisma
): Promise<ProfitTaxReport> {
  if (quarter < 1 || quarter > 4) throw new Error("Квартал должен быть от 1 до 4");

  const org = await db.organization.findUnique({ where: { id: orgId } });
  if (!org) throw new Error("Организация не найдена");

  const { from, to, quarterStart } = quarterRange(year, quarter);
  const isAnnual = quarter === 4;
  const warnings: string[] = [];

  const [rules, aggRows, costingMethod, accruedBefore] = await Promise.all([
    loadMappingRules(orgId, db),
    aggregateTransitTurnover(orgId, from, to, db),
    getCostingMethodForYear(orgId, year, db),
    sumAccruedAdvances(orgId, from, quarterStart, db),
  ]);

  // ── Раскладка оборотов по строкам приложений ──────────────────────────
  const ap1 = new Map<string, Decimal>();        // lineCode → сумма (Кт − Дт)
  const ap2 = new Map<string, { col3: Decimal; col4: Decimal }>(); // lineCode → графы
  const unmapped = new Map<string, Decimal>();   // счёт → |оборот| без правила

  const addAp2 = (lineCode: string, amount: Decimal, nonDeductible: boolean) => {
    const cur = ap2.get(lineCode) ?? { col3: new Decimal(0), col4: new Decimal(0) };
    cur.col3 = cur.col3.plus(amount);
    if (nonDeductible) cur.col4 = cur.col4.plus(amount);
    ap2.set(lineCode, cur);
  };

  for (const row of aggRows) {
    const debit = new Decimal(row.sumDebit || "0");
    const credit = new Decimal(row.sumCredit || "0");
    const rule = resolveRule(rules, row.code, row.docType);

    if (!rule) {
      if (!TAX_REPORT_EXCLUDED_TRANSIT_CODES.includes(row.code)) {
        const prev = unmapped.get(row.code) ?? new Decimal(0);
        unmapped.set(row.code, prev.plus(debit.minus(credit).abs()));
      }
      continue;
    }

    if (rule.appendixCode === "APPENDIX_1") {
      const prev = ap1.get(rule.lineCode) ?? new Decimal(0);
      ap1.set(rule.lineCode, prev.plus(credit.minus(debit)));
    } else {
      const amount = debit.minus(credit); // расход нетто (сторно уменьшают)
      if (amount.isZero()) continue;
      // Переопределение вычитаемости на уровне документа (ТЗ 1.2):
      // true — вычитаемый (только графа 3), false — невычитаемый (графы 3 и 4),
      // null — по колонке правила маппинга.
      const nonDeductible = row.override === null
        ? rule.column === "NON_DEDUCTIBLE"
        : row.override === false;
      addAp2(rule.lineCode, amount, nonDeductible);
    }
  }

  for (const [code, amount] of unmapped) {
    if (!amount.isZero()) {
      warnings.push(
        `Счёт ${code} имеет обороты ${amount.toFixed(2)} за период, но не замаплен ни на одну строку ` +
        `Приложений №1/№2 (TaxReportAccountMapping) — суммы не попали в расчёт.`
      );
    }
  }

  // ── Приложение №1 ──────────────────────────────────────────────────────
  const ap1Get = (code: string) => ap1.get(code) ?? new Decimal(0);
  const ap1Total = APPENDIX1_SUM_LINES.reduce((s, c) => s.plus(ap1Get(c)), new Decimal(0));

  const appendix1: Appendix1Result = {
    lines: APPENDIX1_LINES.map(l => ({
      code: l.code, label: l.label, kind: l.kind, indent: l.indent,
      amount: l.code === "010" ? r2(ap1Total) : r2(ap1Get(l.code)),
    })),
    total010: r2(ap1Total),
  };

  // ── Приложение №2 ──────────────────────────────────────────────────────
  const ap2Get = (code: string) => ap2.get(code) ?? { col3: new Decimal(0), col4: new Decimal(0) };
  const cogs = ap2Get(APPENDIX2_COGS_LINE);
  const others = APPENDIX2_DETAIL_CODES.reduce(
    (s, c) => {
      const v = ap2Get(c);
      return { col3: s.col3.plus(v.col3), col4: s.col4.plus(v.col4) };
    },
    { col3: new Decimal(0), col4: new Decimal(0) }
  );
  const total010col3 = cogs.col3.plus(others.col3);
  const total010col4 = cogs.col4.plus(others.col4);

  const appendix2: Appendix2Result = {
    lines: APPENDIX2_LINES.map(l => {
      if (l.code === "010") return { code: l.code, label: l.label, kind: l.kind, indent: l.indent, col3: r2(total010col3), col4: r2(total010col4) };
      if (l.code === "030") return { code: l.code, label: l.label, kind: l.kind, indent: l.indent, col3: r2(others.col3), col4: r2(others.col4) };
      const v = ap2Get(l.code);
      return { code: l.code, label: l.label, kind: l.kind, indent: l.indent, col3: r2(v.col3), col4: r2(v.col4) };
    }),
    total010: { col3: r2(total010col3), col4: r2(total010col4) },
    deductible: r2(total010col3.minus(total010col4)),
  };

  // ── Основная форма ─────────────────────────────────────────────────────
  // Строка 010 = Прил.1 стр.010 − 052 − 060 − 120 − 131 (формула портала).
  const line010 = ap1Total
    .minus(ap1Get("052")).minus(ap1Get("060")).minus(ap1Get("120")).minus(ap1Get("131"));
  const line020 = total010col3.minus(total010col4);
  const line030 = line010.minus(line020);

  // Льгота IT Park (эпик, Фаза 1 — только отображение в генераторе, ТЗ 7.2):
  // активна с даты регистрации резидентства, не задним числом.
  const benefitActive = org.taxBenefit === "IT_PARK_RESIDENT"
    && (!org.itParkResidentSince || new Date(org.itParkResidentSince) <= to);
  const line040 = benefitActive ? Decimal.max(line030, 0) : new Decimal(0);
  const line050 = new Decimal(0); // Приложение №7 — нулевая ставка, не применимо
  const line060 = Decimal.max(line030.minus(line040).minus(line050), 0);
  const line061 = new Decimal(0); // Приложение №4 — ускоренная амортизация, нет ОС
  const line062 = line060.minus(line061);
  const ratePct = benefitActive ? 0 : new Decimal(org.profitTaxRate ?? TAX_RATES.PROFIT_TAX).mul(100).toNumber();
  const line080 = line062.mul(ratePct).div(100);
  const line090 = accruedBefore;
  const line150 = line080.minus(line090);

  const values: Record<string, number> = {
    "010": r2(line010), "020": r2(line020), "030": r2(line030),
    "040": r2(line040), "050": r2(line050), "060": r2(line060),
    "061": r2(line061), "062": r2(line062), "063": 0,
    "070": ratePct, "071": 0, "072": 0,
    "080": r2(line080), "090": r2(line090),
    "100": 0, "110": 0, "120": 0, "130": 0, "140": 0,
    "150": r2(line150),
  };

  const mainForm: MainFormResult = {
    lines: MAIN_FORM_LINES.map(l => ({ code: l.code, label: l.label, kind: l.kind, amount: values[l.code] ?? 0 })),
    values,
  };

  // ── Статусы приложений ─────────────────────────────────────────────────
  if (!costingMethod) {
    warnings.push(
      "Метод себестоимости не зафиксирован (настройки → метод себестоимости). " +
      "Без него нельзя определить, какое из Приложений №2.1(а)/№2.1(б) заполняется в годовом отчёте."
    );
  }

  // Стр. 020 Прил.2 = 0 при наличии товарной выручки — признак несписанной
  // себестоимости (см. ТЗ, раздел 6 п.1: GOODS_SOLD — ручной документ).
  const revenue9020 = aggRows
    .filter(r => r.code === "9020")
    .reduce((s, r) => s.plus(new Decimal(r.sumCredit || "0")), new Decimal(0));
  if (revenue9020.gt(0) && cogs.col3.isZero()) {
    warnings.push(
      `За период есть выручка от реализации товаров (Кт 9020: ${revenue9020.toFixed(2)}), ` +
      `но себестоимость не списана (нет оборотов 91xx) — строка 020 Приложения №2 равна 0. ` +
      `Создайте документ GOODS_SOLD (Дт 9120 / Кт 2910) на себестоимость проданного.`
    );
  }

  const statusFor = (code: string): { status: AppendixStatus; note: string } => {
    switch (code) {
      case "MAIN":
        return { status: "FILLED", note: "Считается автоматически из Приложений №1 и №2" };
      case "1":
        return appendix1.total010 !== 0
          ? { status: "FILLED", note: "Заполнено из проводок (нарастающим итогом с начала года)" }
          : { status: "NEEDS_DATA", note: "Нет доходов за период — проверьте, что выручка проведена" };
      case "2":
        return appendix2.total010.col3 !== 0
          ? { status: "FILLED", note: "Заполнено из проводок; проверьте графу 4 (невычитаемые)" }
          : { status: "NEEDS_DATA", note: "Нет расходов за период" };
      case "2.1":
        return isAnnual
          ? { status: "NEEDS_DATA", note: "Годовая версия (коды 0301–0334): структура повторяет Приложение №2, сверить перед подачей" }
          : { status: "ANNUAL_ONLY", note: "Заполняется только при представлении отчетности по итогам года" };
      case "2.1a":
        if (!isAnnual) return { status: "ANNUAL_ONLY", note: "Заполняется только в годовом отчёте" };
        return costingMethod === "DIRECT"
          ? { status: "NEEDS_DATA", note: "Метод прямых затрат зафиксирован — заполнить расчёт себестоимости" }
          : { status: "NOT_APPLICABLE", note: "Не заполняется: зафиксирован пропорциональный метод (портал сверяет с шапкой формы)" };
      case "2.1b":
        if (!isAnnual) return { status: "ANNUAL_ONLY", note: "Заполняется только в годовом отчёте" };
        return costingMethod === "PROPORTIONAL"
          ? { status: "NEEDS_DATA", note: "Пропорциональный метод зафиксирован — заполнить расчёт себестоимости" }
          : { status: "NOT_APPLICABLE", note: "Не заполняется: зафиксирован прямой метод (портал сверяет с шапкой формы)" };
      case "3":
        return { status: "NOT_APPLICABLE", note: "Инвестиционный вычет: нет основных средств" };
      case "4":
        return { status: "NOT_APPLICABLE", note: "Амортизация: нет основных средств" };
      case "6":
        return benefitActive
          ? { status: "FILLED", note: "Резидент IT Park: вся налогооблагаемая прибыль льготируется (ставка 0%)" }
          : { status: "NOT_APPLICABLE", note: "Льготы не настроены (taxBenefit = NONE)" };
      case "7":
        return { status: "NOT_APPLICABLE", note: "Нулевая ставка (ст. 337 НК) не применима" };
      case "8":
        return isAnnual
          ? { status: "NEEDS_DATA", note: "Перенос убытков прошлых лет — проверить по историческим данным при годовой подаче (ст. 333 НК, лимит 50% базы)" }
          : { status: "ANNUAL_ONLY", note: "Перенос убытков — только в годовом расчёте (ст. 333 ч.6 НК)" };
      case "9":
        return { status: "NOT_APPLICABLE", note: "Спецоперации (ст. 336 НК) отсутствуют" };
      case "10":
        return { status: "NOT_APPLICABLE", note: "Нет налога, уплаченного за пределами РУз" };
      case "11":
        return { status: "NOT_APPLICABLE", note: "Нет дивидендов/процентов, полученных за рубежом" };
      default:
        return { status: "NOT_APPLICABLE", note: "" };
    }
  };

  const appendixStatuses: AppendixStatusItem[] = APPENDIX_LIST.map(a => ({
    code: a.code, title: a.title, ...statusFor(a.code),
  }));

  return {
    meta: {
      orgName: org.name,
      inn: org.inn ?? null,
      year, quarter,
      periodFrom: from.toISOString(),
      periodTo: to.toISOString(),
      isAnnual,
      taxRatePct: ratePct,
      taxBenefit: org.taxBenefit ?? "NONE",
      benefitActive,
      costingMethod,
      avgHeadcount: org.avgHeadcount ?? 1,
      avgHeadcountDisabled: org.avgHeadcountDisabled ?? 0,
      generatedAt: new Date().toISOString(),
    },
    appendix1,
    appendix2,
    mainForm,
    appendixStatuses,
    warnings,
  };
}

// ─── Расшифровка строки: исходные документы ────────────────────────────────────
// Возвращает документы, чьи проводки попали в строку lineCode приложения
// appendix за период (drill-down на дашборде, «та же логика расшифровки, что в 1С»).

export interface LineDetailRow {
  documentId: string;
  date: string;
  docTypeCode: string;
  docTypeName: string;
  counterparty: string | null;
  accountCode: string;
  amount: number;         // вклад в графу 3 (Прил.2) / сумму строки (Прил.1)
  nonDeductible: boolean; // попал ли вклад в графу 4
  override: boolean | null;
}

export async function getProfitTaxLineDetails(
  orgId: string,
  year: number,
  quarter: number,
  appendix: TaxAppendixCode,
  lineCode: string,
  db: any = prisma
): Promise<LineDetailRow[]> {
  const { from, to } = quarterRange(year, quarter);
  const rules = await loadMappingRules(orgId, db);

  const rows: {
    documentId: string; date: Date; docTypeCode: string; docTypeName: string;
    counterparty: string | null; override: boolean | null;
    code: string; sumDebit: string; sumCredit: string;
  }[] = await db.$queryRaw`
    SELECT d.id                      AS "documentId",
           d.date                    AS "date",
           dt.code                   AS "docTypeCode",
           dt.name                   AS "docTypeName",
           MAX(c.name)               AS "counterparty",
           d."taxDeductibleOverride" AS "override",
           a.code,
           SUM(je.debit)::text       AS "sumDebit",
           SUM(je.credit)::text      AS "sumCredit"
    FROM "JournalEntry" je
    JOIN "Document"     d  ON d.id  = je."documentId"
    JOIN "DocumentType" dt ON dt.id = d."typeId"
    JOIN "Account"      a  ON a.id  = je."accountId"
    LEFT JOIN "Counterparty" c ON c.id = je."counterpartyId"
    WHERE d."orgId" = ${orgId}
      AND d.status  = 'POSTED'
      AND d.date   >= ${from}
      AND d.date   <= ${to}
      AND a.type    = 'TRANSIT'
      AND dt.code   NOT IN ('PERIOD_CLOSING', 'YEAR_END_CLOSE', 'PROFIT_TAX_ACCRUAL', 'PROFIT_TAX_REVERSAL')
    GROUP BY d.id, d.date, dt.code, dt.name, d."taxDeductibleOverride", a.code
    ORDER BY d.date ASC
  `;

  const result: LineDetailRow[] = [];
  for (const row of rows) {
    const rule = resolveRule(rules, row.code, row.docTypeCode);
    if (!rule || rule.appendixCode !== appendix) continue;
    // Строки-итоги Прил.2: 010 покрывает всё, 030 — все детальные строки.
    const matchesLine =
      rule.lineCode === lineCode ||
      (appendix === "APPENDIX_2" && lineCode === "010") ||
      (appendix === "APPENDIX_2" && lineCode === "030" && rule.lineCode !== APPENDIX2_COGS_LINE);
    if (!matchesLine) continue;

    const debit = new Decimal(row.sumDebit || "0");
    const credit = new Decimal(row.sumCredit || "0");
    const amount = appendix === "APPENDIX_1" ? credit.minus(debit) : debit.minus(credit);
    if (amount.isZero()) continue;

    const nonDeductible = appendix === "APPENDIX_2" && (row.override === null
      ? rule.column === "NON_DEDUCTIBLE"
      : row.override === false);

    result.push({
      documentId: row.documentId,
      date: new Date(row.date).toISOString(),
      docTypeCode: row.docTypeCode,
      docTypeName: row.docTypeName,
      counterparty: row.counterparty,
      accountCode: row.code,
      amount: r2(amount),
      nonDeductible,
      override: row.override,
    });
  }
  return result;
}

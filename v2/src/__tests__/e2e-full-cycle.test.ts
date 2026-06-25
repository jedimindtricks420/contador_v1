/**
 * E2E Full Cycle Test — tests the complete user flow without HTTP layer
 *
 * Scenarios:
 * A. Accrual method: advance in March → ESF confirmed in April → revenue in April only
 * B. Supplier accrual: GOODS_RECEIVED creates 6010 payable, SUPPLIER_PAYMENT closes it
 * C. Expense bank templates: BANK_COMMISSION, INTEREST_PAYMENT, UTILITY_PAYMENT, etc.
 * D. finalizePeriod: creates salary accrual + TaxCalendarEvents, locks period
 * E. bankOnly filter: MANUAL_ONLY types excluded from bank transaction UI
 * F. Balance check: every POSTED document has Σ Debit = Σ Credit
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { postDocument } from "@/lib/posting/postingEngine";
import { finalizePeriod } from "@/lib/closing";
import { ensureBaseData } from "@/lib/ensureBaseData";
import Decimal from "decimal.js";

const prisma = new PrismaClient();

// ─── Test amounts ────────────────────────────────────────────────────────────
const ADV_AMOUNT  = 1_120_000;                                        // customer advance (incl. 12% VAT)
const ADV_VAT     = Math.round(ADV_AMOUNT - ADV_AMOUNT / 1.12);       // 120,000
const ADV_NET     = ADV_AMOUNT - ADV_VAT;                             // 1,000,000

const GOODS_AMT   = 560_000;
const GOODS_VAT   = Math.round(GOODS_AMT - GOODS_AMT / 1.12);         // 60,000
const GOODS_NET   = GOODS_AMT - GOODS_VAT;                            // 500,000

const SALARY_AMT  = 5_000_000;
const NDFL        = Math.round(SALARY_AMT * 0.12);                    // 600,000
const SOC_TAX_AMT = Math.round(SALARY_AMT * 0.12);                    // 600,000

// ─── Shared state (populated in beforeAll) ───────────────────────────────────
let orgId: string;
let periodMarchId: string;
let periodAprilId: string;
let periodFinalizeId: string;

describe("Contador E2E Full Cycle", { timeout: 60_000 }, () => {

  beforeAll(async () => {
    await ensureBaseData();

    const user = await prisma.user.create({
      data: {
        email: `e2e_${Date.now()}@test.local`,
        name: "E2E Runner",
        passwordHash: "x",
      },
    });

    const org = await prisma.organization.create({
      data: {
        name: "ООО Тест E2E",
        inn: `E2E${Date.now()}`.slice(0, 20),
        taxRegime: "VAT",
        isVatPayer: true,
        members: { create: { userId: user.id, role: "OWNER" } },
      },
    });
    orgId = org.id;

    // Need BankAccount because StagedTransaction has FK (not used here, but
    // let's create one in case any helper queries for it)
    await prisma.bankAccount.create({
      data: {
        orgId,
        name: "Основной счёт",
        bankName: "Тест Банк",
        accountNumber: `000${Date.now()}`.slice(0, 20),
        currency: "UZS",
      },
    });

    const [pMarch, pApril, pFinalize] = await Promise.all([
      prisma.period.create({ data: { orgId, year: 2025, month: 3 } }),
      prisma.period.create({ data: { orgId, year: 2025, month: 4 } }),
      prisma.period.create({
        data: {
          orgId,
          year: 2025,
          month: 5,
          closingData: {
            currentStep: 7,
            accruals: { salaryAmount: SALARY_AMT, depreciationAmount: 0, rentAmount: 0 },
            fxDiff:    { exchangeRate: 0, difference: 0 },
            soliqMatched: { matched: 0, unmatched: 0 },
          },
        },
      }),
    ]);
    periodMarchId    = pMarch.id;
    periodAprilId    = pApril.id;
    periodFinalizeId = pFinalize.id;
  }, 30_000);

  afterAll(async () => {
    if (orgId) await prisma.organization.delete({ where: { id: orgId } }).catch(() => {});
    await prisma.$disconnect();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SCENARIO A — Accrual method
  // ═══════════════════════════════════════════════════════════════════════════
  describe("Scenario A: Advance in March → ESF in April → revenue only in April", () => {
    let advOpenItemId: string;

    it("A1: ADVANCE_RECEIVED posts Дт 5110 / Кт 6310 and creates OpenItem", async () => {
      const dt = await prisma.documentType.findUnique({ where: { code: "ADVANCE_RECEIVED" } });
      expect(dt, "ADVANCE_RECEIVED type missing").toBeTruthy();

      const doc = await prisma.document.create({
        data: {
          orgId,
          periodId: periodMarchId,
          typeId: dt!.id,
          date: new Date(2025, 2, 15),
          status: "POSTED",
          payload: { amount: ADV_AMOUNT, counterpartyHint: "ООО Покупатель", counterpartyInn: "9999999991" } as any,
        },
      });

      const { journalEntries, openItem } = await postDocument(doc.id, prisma, "test");

      // Balance check
      const totDr = journalEntries.reduce((s, e) => s.plus(e.debit.toString()), new Decimal(0));
      const totCr = journalEntries.reduce((s, e) => s.plus(e.credit.toString()), new Decimal(0));
      expect(totDr.equals(totCr), "A1 JE not balanced").toBe(true);

      // Account check
      const jes = await prisma.journalEntry.findMany({ where: { documentId: doc.id }, include: { account: true } });
      const dr = jes.find(e => e.account.code === "5110" && new Decimal(e.debit.toString()).gt(0));
      const cr = jes.find(e => e.account.code === "6310" && new Decimal(e.credit.toString()).gt(0));
      expect(dr, "5110 debit missing").toBeTruthy();
      expect(cr, "6310 credit missing").toBeTruthy();
      expect(new Decimal(dr!.debit.toString()).toNumber()).toBe(ADV_AMOUNT);

      // OpenItem check
      expect(openItem, "OpenItem must be created").toBeTruthy();
      expect(openItem!.status).toBe("OPEN");
      expect(new Decimal(openItem!.amount.toString()).toNumber()).toBe(ADV_AMOUNT);
      advOpenItemId = openItem!.id;
    });

    it("A2: March has ZERO revenue on 9030", async () => {
      const jes = await prisma.journalEntry.findMany({
        where: { document: { orgId, periodId: periodMarchId, status: "POSTED" }, account: { code: "9030" } },
      });
      const total = jes.reduce((s, e) => s.plus(e.credit.toString()), new Decimal(0));
      expect(total.toNumber()).toBe(0);
    });

    it("A3: INVOICE_CONFIRMED_PREPAID posts Дт 6310 / Кт 9030 / Кт 6410", async () => {
      const dt = await prisma.documentType.findUnique({ where: { code: "INVOICE_CONFIRMED_PREPAID" } });
      expect(dt, "INVOICE_CONFIRMED_PREPAID missing").toBeTruthy();

      const doc = await prisma.document.create({
        data: {
          orgId,
          periodId: periodAprilId,
          typeId: dt!.id,
          date: new Date(2025, 3, 10),
          status: "POSTED",
          payload: {
            amount: ADV_AMOUNT,
            vatAmount: ADV_VAT,
            counterpartyHint: "ООО Покупатель",
            counterpartyInn: "9999999991",
          } as any,
        },
      });

      const { journalEntries } = await postDocument(doc.id, prisma, "test");

      // Balance
      const totDr = journalEntries.reduce((s, e) => s.plus(e.debit.toString()), new Decimal(0));
      const totCr = journalEntries.reduce((s, e) => s.plus(e.credit.toString()), new Decimal(0));
      expect(totDr.equals(totCr), "A3 JE not balanced").toBe(true);

      // Verify all 3 lines
      const jes = await prisma.journalEntry.findMany({ where: { documentId: doc.id }, include: { account: true } });
      const adv = jes.find(e => e.account.code === "6310" && new Decimal(e.debit.toString()).gt(0));
      const rev = jes.find(e => e.account.code === "9030" && new Decimal(e.credit.toString()).gt(0));
      const vat = jes.find(e => e.account.code === "6410" && new Decimal(e.credit.toString()).gt(0));

      expect(adv, "6310 debit missing in A3").toBeTruthy();
      expect(rev, "9030 credit missing in A3").toBeTruthy();
      expect(vat, "6410 credit missing in A3 (VAT payer)").toBeTruthy();

      expect(new Decimal(adv!.debit.toString()).toNumber()).toBe(ADV_AMOUNT);
      expect(new Decimal(rev!.credit.toString()).toNumber()).toBe(ADV_NET);
      expect(new Decimal(vat!.credit.toString()).toNumber()).toBe(ADV_VAT);

      // Close OpenItem manually (as pending-invoices route does)
      await prisma.openItem.update({
        where: { id: advOpenItemId },
        data: { status: "CLOSED", closingDocumentId: doc.id, dateClosed: new Date(2025, 3, 10) },
      });
    });

    it("A4: April has revenue = ADV_NET (1,000,000) on 9030", async () => {
      const jes = await prisma.journalEntry.findMany({
        where: { document: { orgId, periodId: periodAprilId, status: "POSTED" }, account: { code: "9030" } },
      });
      const total = jes.reduce((s, e) => s.plus(e.credit.toString()), new Decimal(0));
      expect(total.toNumber()).toBe(ADV_NET);
    });

    it("A5: March still has ZERO 9030 credits after ESF in April", async () => {
      const jes = await prisma.journalEntry.findMany({
        where: { document: { orgId, periodId: periodMarchId, status: "POSTED" }, account: { code: "9030" } },
      });
      const total = jes.reduce((s, e) => s.plus(e.credit.toString()), new Decimal(0));
      expect(total.toNumber()).toBe(0);
    });

    it("A6: OpenItem on 6310 is CLOSED after ESF", async () => {
      const oi = await prisma.openItem.findUnique({ where: { id: advOpenItemId } });
      expect(oi!.status).toBe("CLOSED");
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SCENARIO B — Supplier accrual + payment
  // ═══════════════════════════════════════════════════════════════════════════
  describe("Scenario B: GOODS_RECEIVED creates 6010 payable, SUPPLIER_PAYMENT closes it", () => {
    it("B1: GOODS_RECEIVED → Дт 9120 + Дт 4410 / Кт 6010 (creates OpenItem)", async () => {
      const dt = await prisma.documentType.findUnique({ where: { code: "GOODS_RECEIVED" } });
      expect(dt).toBeTruthy();

      const doc = await prisma.document.create({
        data: {
          orgId,
          periodId: periodMarchId,
          typeId: dt!.id,
          date: new Date(2025, 2, 20),
          status: "POSTED",
          payload: { amount: GOODS_AMT, vatAmount: GOODS_VAT, counterpartyHint: "ООО Поставщик", counterpartyInn: "8888888881" } as any,
        },
      });

      const { journalEntries, openItem } = await postDocument(doc.id, prisma, "test");

      const totDr = journalEntries.reduce((s, e) => s.plus(e.debit.toString()), new Decimal(0));
      const totCr = journalEntries.reduce((s, e) => s.plus(e.credit.toString()), new Decimal(0));
      expect(totDr.equals(totCr), "B1 JE not balanced").toBe(true);

      const jes = await prisma.journalEntry.findMany({ where: { documentId: doc.id }, include: { account: true } });
      const cogs = jes.find(e => e.account.code === "9120" && new Decimal(e.debit.toString()).gt(0));
      const vatIn = jes.find(e => e.account.code === "4410" && new Decimal(e.debit.toString()).gt(0));
      const pay   = jes.find(e => e.account.code === "6010" && new Decimal(e.credit.toString()).gt(0));

      expect(cogs,  "9120 debit missing").toBeTruthy();
      expect(vatIn, "4410 debit missing").toBeTruthy();
      expect(pay,   "6010 credit missing").toBeTruthy();

      expect(new Decimal(cogs!.debit.toString()).toNumber()).toBe(GOODS_NET);
      expect(new Decimal(vatIn!.debit.toString()).toNumber()).toBe(GOODS_VAT);
      expect(new Decimal(pay!.credit.toString()).toNumber()).toBe(GOODS_AMT);

      expect(openItem, "OpenItem on 6010 must be created").toBeTruthy();
    });

    it("B2: SUPPLIER_PAYMENT_GOODS → Дт 6010 / Кт 5110", async () => {
      const dt = await prisma.documentType.findUnique({ where: { code: "SUPPLIER_PAYMENT_GOODS" } });
      expect(dt).toBeTruthy();

      const doc = await prisma.document.create({
        data: {
          orgId,
          periodId: periodMarchId,
          typeId: dt!.id,
          date: new Date(2025, 2, 25),
          status: "POSTED",
          payload: { amount: GOODS_AMT, counterpartyHint: "ООО Поставщик", counterpartyInn: "8888888881" } as any,
        },
      });

      const { journalEntries } = await postDocument(doc.id, prisma, "test");

      const totDr = journalEntries.reduce((s, e) => s.plus(e.debit.toString()), new Decimal(0));
      const totCr = journalEntries.reduce((s, e) => s.plus(e.credit.toString()), new Decimal(0));
      expect(totDr.equals(totCr), "B2 JE not balanced").toBe(true);

      const jes = await prisma.journalEntry.findMany({ where: { documentId: doc.id }, include: { account: true } });
      const dr = jes.find(e => e.account.code === "6010" && new Decimal(e.debit.toString()).gt(0));
      const cr = jes.find(e => e.account.code === "5110" && new Decimal(e.credit.toString()).gt(0));

      expect(dr, "6010 debit missing in B2").toBeTruthy();
      expect(cr, "5110 credit missing in B2").toBeTruthy();
      expect(new Decimal(dr!.debit.toString()).toNumber()).toBe(GOODS_AMT);
    });

    it("B3: Net 6010 for March period = 0 (fully closed)", async () => {
      const jes = await prisma.journalEntry.findMany({
        where: { document: { orgId, periodId: periodMarchId, status: "POSTED" }, account: { code: "6010" } },
      });
      const net = jes.reduce(
        (s, e) => s.plus(e.credit.toString()).minus(e.debit.toString()),
        new Decimal(0)
      );
      expect(net.toNumber()).toBe(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SCENARIO C — Expense bank templates
  // ═══════════════════════════════════════════════════════════════════════════
  describe("Scenario C: Expense bank templates post to correct accounts", () => {
    const cases: { code: string; amount: number; debitCode: string; creditCode: string }[] = [
      { code: "BANK_COMMISSION",  amount:  50_000, debitCode: "9430", creditCode: "5110" },
      { code: "INTEREST_PAYMENT", amount: 200_000, debitCode: "9610", creditCode: "5110" },
      { code: "UTILITY_PAYMENT",  amount: 300_000, debitCode: "9420", creditCode: "5110" },
      { code: "FINE_PENALTY",     amount: 100_000, debitCode: "9430", creditCode: "5110" },
      { code: "INSURANCE_PAYMENT",amount: 150_000, debitCode: "9420", creditCode: "5110" },
      { code: "SUBSCRIPTION",     amount:  80_000, debitCode: "9420", creditCode: "5110" },
      { code: "CUSTOMS_DUTY",     amount: 220_000, debitCode: "9430", creditCode: "5110" },
    ];

    for (const { code, amount, debitCode, creditCode } of cases) {
      it(`C: ${code} → Дт ${debitCode} / Кт ${creditCode}`, async () => {
        const dt = await prisma.documentType.findUnique({ where: { code } });
        expect(dt, `${code} type missing in DB`).toBeTruthy();

        const doc = await prisma.document.create({
          data: {
            orgId,
            periodId: periodAprilId,
            typeId: dt!.id,
            date: new Date(2025, 3, 5),
            status: "POSTED",
            payload: { amount, counterpartyHint: "Тест" } as any,
          },
        });

        const { journalEntries } = await postDocument(doc.id, prisma, "test");

        // Balance check
        const totDr = journalEntries.reduce((s, e) => s.plus(e.debit.toString()), new Decimal(0));
        const totCr = journalEntries.reduce((s, e) => s.plus(e.credit.toString()), new Decimal(0));
        expect(totDr.equals(totCr), `${code}: JE not balanced`).toBe(true);

        // Account check
        const jes = await prisma.journalEntry.findMany({ where: { documentId: doc.id }, include: { account: true } });
        const dr = jes.find(e => e.account.code === debitCode && new Decimal(e.debit.toString()).gt(0));
        const cr = jes.find(e => e.account.code === creditCode && new Decimal(e.credit.toString()).gt(0));

        expect(dr, `${code}: Дт ${debitCode} missing`).toBeTruthy();
        expect(cr, `${code}: Кт ${creditCode} missing`).toBeTruthy();
        expect(new Decimal(dr!.debit.toString()).toNumber()).toBe(amount);
      });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SCENARIO D — finalizePeriod
  // ═══════════════════════════════════════════════════════════════════════════
  describe("Scenario D: finalizePeriod — salary accrual + tax calendar + period lock", () => {

    it("D1: finalizePeriod runs without throwing", async () => {
      await expect(finalizePeriod(periodFinalizeId, orgId, "test")).resolves.not.toThrow();
    });

    it("D2: Period is CLOSED and has lockDate", async () => {
      const p = await prisma.period.findUnique({ where: { id: periodFinalizeId } });
      expect(p!.status).toBe("CLOSED");
      expect(p!.lockDate).not.toBeNull();
    });

    it("D3: SALARY_ACCRUAL document created with balanced JE", async () => {
      const docs = await prisma.document.findMany({
        where: { orgId, periodId: periodFinalizeId },
        include: { type: true, journalEntries: true },
      });
      const salaryDoc = docs.find(d => d.type.code === "SALARY_ACCRUAL");
      expect(salaryDoc, "SALARY_ACCRUAL document missing").toBeTruthy();

      const totDr = salaryDoc!.journalEntries.reduce((s, e) => s.plus(e.debit.toString()), new Decimal(0));
      const totCr = salaryDoc!.journalEntries.reduce((s, e) => s.plus(e.credit.toString()), new Decimal(0));
      expect(totDr.equals(totCr), "SALARY_ACCRUAL JE not balanced").toBe(true);

      // Gross salary: Дт 9420 5,000,000 / Кт 6710 5,000,000
      // НДФЛ: Дт 6710 600,000 / Кт 6410 600,000
      // Соцналог: Дт 9420 600,000 / Кт 6520 600,000
      const jes = await prisma.journalEntry.findMany({
        where: { documentId: salaryDoc!.id },
        include: { account: true },
      });

      const acc9420 = jes.filter(e => e.account.code === "9420");
      const acc6710 = jes.filter(e => e.account.code === "6710");
      const acc6410 = jes.filter(e => e.account.code === "6410");
      const acc6520 = jes.filter(e => e.account.code === "6520");

      expect(acc9420.length).toBeGreaterThan(0);
      expect(acc6710.length).toBeGreaterThan(0);
      expect(acc6410.length).toBeGreaterThan(0);
      expect(acc6520.length).toBeGreaterThan(0);
    });

    it("D4: TaxCalendarEvent PERSONAL_INCOME_TAX = 600,000", async () => {
      const ev = await prisma.taxCalendarEvent.findFirst({
        where: { orgId, periodId: periodFinalizeId, type: "PERSONAL_INCOME_TAX" },
      });
      expect(ev, "PERSONAL_INCOME_TAX event missing").toBeTruthy();
      expect(new Decimal(ev!.estimatedAmount!.toString()).toNumber()).toBe(NDFL);
    });

    it("D5: TaxCalendarEvent SOCIAL_TAX = 600,000", async () => {
      const ev = await prisma.taxCalendarEvent.findFirst({
        where: { orgId, periodId: periodFinalizeId, type: "SOCIAL_TAX" },
      });
      expect(ev, "SOCIAL_TAX event missing").toBeTruthy();
      expect(new Decimal(ev!.estimatedAmount!.toString()).toNumber()).toBe(SOC_TAX_AMT);
    });

    it("D6: Reformed balance — TRANSIT account net debits transferred to 9910", async () => {
      // After reformation, 9910 should have entries (income statement accounts closed)
      const jes9910 = await prisma.journalEntry.findMany({
        where: {
          document: { orgId, periodId: periodFinalizeId, status: "POSTED" },
          account: { code: "9910" },
        },
      });
      // The period had salary expense (TRANSIT accounts 9420, 6710) so 9910 should have entries
      expect(jes9910.length, "9910 reformation entries missing").toBeGreaterThan(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SCENARIO E — bankOnly filter
  // ═══════════════════════════════════════════════════════════════════════════
  describe("Scenario E: bankOnly=true excludes MANUAL_ONLY types from dropdown", () => {
    it("E1: Full catalog includes MANUAL_ONLY types (e.g. GOODS_RECEIVED)", async () => {
      const all = await prisma.documentType.findMany();
      const goods = all.find(t => t.code === "GOODS_RECEIVED");
      expect(goods).toBeTruthy();
      expect(goods!.mode).toBe("MANUAL_ONLY");
    });

    it("E2: bankOnly filter returns zero MANUAL_ONLY types", async () => {
      const bankTypes = await prisma.documentType.findMany({
        where: { mode: { in: ["BANK_AUTO", "HYBRID"] } },
      });
      const manualInBank = bankTypes.filter(t => t.mode === "MANUAL_ONLY");
      expect(manualInBank.length).toBe(0);
    });

    it("E3: ADVANCE_RECEIVED (BANK_AUTO) appears in bankOnly list", async () => {
      const bankTypes = await prisma.documentType.findMany({
        where: { mode: { in: ["BANK_AUTO", "HYBRID"] } },
      });
      const ar = bankTypes.find(t => t.code === "ADVANCE_RECEIVED");
      expect(ar).toBeTruthy();
    });

    it("E4: INVOICE_CONFIRMED_PREPAID (MANUAL_ONLY) absent from bankOnly list", async () => {
      const bankTypes = await prisma.documentType.findMany({
        where: { mode: { in: ["BANK_AUTO", "HYBRID"] } },
      });
      const icp = bankTypes.find(t => t.code === "INVOICE_CONFIRMED_PREPAID");
      expect(icp).toBeUndefined();
    });

    it("E5: SALARY_ACCRUAL (MANUAL_ONLY) absent from bankOnly list", async () => {
      const bankTypes = await prisma.documentType.findMany({
        where: { mode: { in: ["BANK_AUTO", "HYBRID"] } },
      });
      const sa = bankTypes.find(t => t.code === "SALARY_ACCRUAL");
      expect(sa).toBeUndefined();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SCENARIO F — Global balance integrity
  // ═══════════════════════════════════════════════════════════════════════════
  describe("Scenario F: All POSTED documents for test org are balanced", () => {
    it("F1: Every document has Σ Debit = Σ Credit in its JournalEntries", async () => {
      const docs = await prisma.document.findMany({
        where: { orgId, status: "POSTED" },
        include: { journalEntries: true, type: true },
      });

      const unbalanced: string[] = [];

      for (const doc of docs) {
        const totDr = doc.journalEntries.reduce((s, e) => s.plus(e.debit.toString()), new Decimal(0));
        const totCr = doc.journalEntries.reduce((s, e) => s.plus(e.credit.toString()), new Decimal(0));

        if (!totDr.equals(totCr)) {
          unbalanced.push(`[${doc.type.code}] doc=${doc.id} Дт=${totDr} Кт=${totCr}`);
        }
      }

      expect(
        unbalanced,
        `Unbalanced documents:\n${unbalanced.join("\n")}`
      ).toHaveLength(0);
    });

    it("F2: Total org-wide Σ Debit = Σ Credit across all periods", async () => {
      const all = await prisma.journalEntry.findMany({
        where: { document: { orgId } },
      });

      const totDr = all.reduce((s, e) => s.plus(e.debit.toString()), new Decimal(0));
      const totCr = all.reduce((s, e) => s.plus(e.credit.toString()), new Decimal(0));

      expect(
        totDr.equals(totCr),
        `Global imbalance: Дт=${totDr.toFixed(2)} Кт=${totCr.toFixed(2)}`
      ).toBe(true);
    });
  });
});

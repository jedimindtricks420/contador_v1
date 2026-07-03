import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { postDocument } from "@/lib/posting/postingEngine";
import { ensureBaseData } from "@/lib/ensureBaseData";
import Decimal from "decimal.js";

// Regression coverage for the 39 document types added on 2026-07-03 to close
// gaps against NSBU-21 (see prisma-seeded chart of accounts in seed-coa.ts,
// which already anticipated these accounts long before templates existed).
// Each case just needs to post without throwing and balance Дт = Кт.

const prisma = new PrismaClient();

let orgId: string;
let userId: string;
let periodId: string;

const cases: { code: string; payload: Record<string, unknown> }[] = [
  { code: "GRATUITOUS_RECEIPT_FA", payload: { assetAccountCode: "0110", amount: 5_000_000 } },
  { code: "GRATUITOUS_RECEIPT_IA", payload: { assetAccountCode: "0410", amount: 2_000_000 } },
  { code: "GRATUITOUS_RECEIPT_MATERIALS", payload: { amount: 500_000 } },
  { code: "GRATUITOUS_RECEIPT_GOODS", payload: { amount: 800_000 } },
  { code: "GRATUITOUS_RECEIPT_SECURITIES", payload: { amount: 300_000 } },
  { code: "INVENTORY_SURPLUS", payload: { assetAccountCode: "1010", amount: 100_000 } },
  { code: "INVENTORY_SHORTAGE", payload: { assetAccountCode: "1010", amount: 50_000 } },
  { code: "INVENTORY_SHORTAGE_RESOLUTION", payload: { amount: 50_000, hasCulprit: true } },
  { code: "INVENTORY_SHORTAGE_RESOLUTION", payload: { amount: 30_000, hasCulprit: false } },
  { code: "RESERVE_CAPITAL_FORMATION", payload: { amount: 1_000_000 } },
  { code: "PROVISION_FUTURE_EXPENSES", payload: { expenseAccountCode: "9420", amount: 200_000 } },
  { code: "PROVISION_FUTURE_EXPENSES_USE", payload: { targetAccountCode: "6710", amount: 150_000 } },
  { code: "PROVISION_UNUSED_TO_INCOME", payload: { amount: 50_000 } },
  { code: "GRANT_RECEIVABLE", payload: { amount: 3_000_000 } },
  { code: "GRANT_RECEIVED", payload: { amount: 3_000_000 } },
  { code: "SUBSIDY_RECEIVABLE", payload: { amount: 1_000_000 } },
  { code: "SUBSIDY_RECEIVED", payload: { amount: 1_000_000 } },
  { code: "TARGET_RECEIPTS", payload: { amount: 100_000, receiptType: "membership" } },
  { code: "TARGET_RECEIPTS", payload: { amount: 50_000, receiptType: "other" } },
  { code: "TAX_EXEMPTION_RECOGNITION", payload: { amount: 200_000 } },
  { code: "GOODS_REVALUATION", payload: { increaseAmount: 100_000, decreaseAmount: 0 } },
  { code: "GOODS_REVALUATION", payload: { increaseAmount: 0, decreaseAmount: 80_000 } },
  { code: "GOODS_IN_TRANSIT_RECEIVED", payload: { amount: 400_000 } },
  { code: "MATERIALS_RECEIVED", payload: { amount: 1_000_000, vatAmount: 120_000 } },
  { code: "MATERIALS_RECEIVED", payload: { amount: 1_000_000, vatAmount: 0 } },
  { code: "MATERIALS_TO_PRODUCTION", payload: { amount: 500_000 } },
  { code: "FINISHED_GOODS_OUTPUT", payload: { amount: 700_000 } },
  { code: "FINISHED_GOODS_SOLD", payload: { amount: 700_000 } },
  { code: "MATERIALS_RETURNED_TO_SUPPLIER", payload: { amount: 100_000 } },
  { code: "FINANCE_LEASE_ASSET_RECEIVED", payload: { amount: 20_000_000 } },
  { code: "FINANCE_LEASE_DEPRECIATION", payload: { amount: 500_000 } },
  { code: "FINANCE_LEASE_PAYMENT", payload: { amount: 1_000_000 } },
  { code: "FINANCE_LEASE_INTEREST", payload: { amount: 200_000 } },
  { code: "ROYALTY_INCOME", payload: { amount: 300_000 } },
  { code: "ROYALTY_PAYMENT", payload: { amount: 150_000 } },
  { code: "LETTER_OF_CREDIT_OPEN", payload: { amount: 5_000_000 } },
  { code: "LETTER_OF_CREDIT_EXECUTION", payload: { amount: 5_000_000 } },
  { code: "SALARY_DEPOSIT", payload: { amount: 800_000 } },
  { code: "SALARY_DEPOSIT_PAYMENT", payload: { amount: 800_000 } },
  { code: "DEPOSIT_INTEREST_ACCRUAL", payload: { amount: 100_000 } },
  { code: "GOODS_RETURNED_TO_SUPPLIER", payload: { amount: 200_000 } },
  { code: "LONG_TERM_TO_CURRENT_RECLASS", payload: { amount: 3_000_000 } },
  { code: "EXTRAORDINARY_GAIN_LOSS", payload: { gainAmount: 100_000, lossAmount: 0, accountCode: "5110" } },
  { code: "EXTRAORDINARY_GAIN_LOSS", payload: { gainAmount: 0, lossAmount: 80_000, accountCode: "0110" } },
];

beforeAll(async () => {
  await ensureBaseData();

  const user = await prisma.user.create({
    data: { email: `newtypes_${Date.now()}@test.local`, name: "New Types Test", passwordHash: "x" },
  });
  userId = user.id;

  const org = await prisma.organization.create({
    data: {
      name: "ООО Новые Типы Тест",
      inn: `NT${Date.now()}`.slice(0, 20),
      taxRegime: "VAT",
      isVatPayer: true,
      members: { create: { userId: user.id, role: "OWNER" } },
    },
  });
  orgId = org.id;

  const period = await prisma.period.create({
    data: { orgId, year: 2025, month: 9, mode: "ACTIVE", status: "OPEN" },
  });
  periodId = period.id;
}, 30_000);

afterAll(async () => {
  if (orgId) await prisma.organization.delete({ where: { id: orgId } }).catch(() => {});
  if (userId) await prisma.user.delete({ where: { id: userId } }).catch(() => {});
  await prisma.$disconnect();
});

describe("39 new NSBU-21 document types (2026-07-03) — post cleanly and balance", () => {
  for (const { code, payload } of cases) {
    it(`${code} posts with Σ Дт = Σ Кт (payload: ${JSON.stringify(payload)})`, async () => {
      const type = await prisma.documentType.findUnique({ where: { code } });
      expect(type, `${code}: document type not found in DB`).toBeTruthy();

      const doc = await prisma.document.create({
        data: {
          orgId, periodId, typeId: type!.id,
          date: new Date("2025-09-15"), status: "POSTED",
          payload: payload as any,
        },
      });

      const { journalEntries } = await postDocument(doc.id, prisma, "test");
      expect(journalEntries.length, `${code}: no journal entries created`).toBeGreaterThan(0);

      const totDr = journalEntries.reduce((s, e) => s.plus(e.debit.toString()), new Decimal(0));
      const totCr = journalEntries.reduce((s, e) => s.plus(e.credit.toString()), new Decimal(0));
      expect(totDr.equals(totCr), `${code}: Дт ${totDr} != Кт ${totCr}`).toBe(true);
      expect(totDr.gt(0), `${code}: zero-amount posting`).toBe(true);
    });
  }
});

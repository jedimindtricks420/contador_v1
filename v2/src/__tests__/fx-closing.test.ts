import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { finalizePeriod } from "@/lib/closing";
import { ensureBaseData } from "@/lib/ensureBaseData";
import Decimal from "decimal.js";

// Regression test for the FX closing fix: the backend used to ignore the
// user-entered `difference` and recompute its own implied value from account
// balances (wrong sign for liability accounts like 6010/6820). It now trusts
// whatever the user entered on Step 5 of the closing wizard and posts exactly
// that number against the USD bank account (5210).

const prisma = new PrismaClient();

let orgId: string;
let userId: string;

beforeAll(async () => {
  await ensureBaseData();

  const user = await prisma.user.create({
    data: { email: `fx_${Date.now()}@test.local`, name: "FX Test", passwordHash: "x" },
  });
  userId = user.id;

  const org = await prisma.organization.create({
    data: {
      name: "ООО FX Тест",
      inn: `FX${Date.now()}`.slice(0, 20),
      taxRegime: "VAT",
      isVatPayer: true,
      members: { create: { userId: user.id, role: "OWNER" } },
    },
  });
  orgId = org.id;
}, 30_000);

afterAll(async () => {
  if (orgId) await prisma.organization.delete({ where: { id: orgId } }).catch(() => {});
  if (userId) await prisma.user.delete({ where: { id: userId } }).catch(() => {});
  await prisma.$disconnect();
});

async function makePeriod(month: number, difference: number) {
  return prisma.period.create({
    data: {
      orgId, year: 2025, month,
      closingData: {
        currentStep: 7,
        accruals: { salaryAmount: 0, depreciationAmount: 0, rentAmount: 0 },
        fxDiff: { exchangeRate: 12800, difference },
        soliqMatched: { matched: 0, unmatched: 0 },
      },
    },
  });
}

describe("FX closing — posts the user-entered difference, not a recalculated one", () => {
  it("positive difference posts an income FX_DIFFERENCE document for exactly that amount", async () => {
    const period = await makePeriod(6, 250_000);
    await finalizePeriod(period.id, orgId, userId);

    const doc = await prisma.document.findFirst({
      where: { orgId, periodId: period.id, type: { code: "FX_DIFFERENCE" } },
      include: { journalEntries: { include: { account: true } } },
    });
    expect(doc).toBeTruthy();
    expect((doc!.payload as any).fxDifference).toBe(250_000);

    const totDr = doc!.journalEntries.reduce((s, e) => s.plus(e.debit.toString()), new Decimal(0));
    const totCr = doc!.journalEntries.reduce((s, e) => s.plus(e.credit.toString()), new Decimal(0));
    expect(totDr.equals(totCr)).toBe(true);

    const bankLine = doc!.journalEntries.find(e => e.account.code === "5210");
    expect(bankLine, "5210 line missing").toBeTruthy();
    expect(new Decimal(bankLine!.debit.toString()).toNumber()).toBe(250_000);
  });

  it("negative difference posts an expense FX_DIFFERENCE document for exactly that amount", async () => {
    const period = await makePeriod(7, -180_000);
    await finalizePeriod(period.id, orgId, userId);

    const doc = await prisma.document.findFirst({
      where: { orgId, periodId: period.id, type: { code: "FX_DIFFERENCE" } },
      include: { journalEntries: { include: { account: true } } },
    });
    expect(doc).toBeTruthy();
    expect((doc!.payload as any).fxDifference).toBe(-180_000);

    const bankLine = doc!.journalEntries.find(e => e.account.code === "5210");
    expect(bankLine, "5210 line missing").toBeTruthy();
    expect(new Decimal(bankLine!.credit.toString()).toNumber()).toBe(180_000);
  });

  it("zero difference posts no FX_DIFFERENCE document", async () => {
    const period = await makePeriod(8, 0);
    await finalizePeriod(period.id, orgId, userId);

    const doc = await prisma.document.findFirst({
      where: { orgId, periodId: period.id, type: { code: "FX_DIFFERENCE" } },
    });
    expect(doc).toBeNull();
  });
});

/**
 * Charter capital — end-to-end acceptance scenario (real DB, no mocks).
 *
 * Registers a fresh org, declares УК = 10,000,000 (NOT_PAID), then attempts to post
 * three "founder contribution" transactions as CAPITAL_CONTRIBUTION in sequence:
 *   06.04  8,000,000  → debt 10,000,000 → should POST, leaving debt = 2,000,000
 *   08.04  4,500,000  → debt  2,000,000 → amount > debt → must be REJECTED
 *   09.04 15,000,000  → debt  2,000,000 → amount > debt → must be REJECTED
 *
 * This is the scenario from the НСБУ-21 §344/§348 acceptance checklist: if either
 * of the last two posts succeeds, 4610 would go negative (overpaid "debt") and 8330
 * would be inflated beyond the declared 10,000,000 — exactly the bug class this
 * feature exists to prevent. Also asserts Форма №1 line 410 (8310-8330) stays at
 * exactly 10,000,000 and that 8890 (opening-balance plug account) stays untouched.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { postDocument } from "@/lib/posting/postingEngine";
import { ensureBaseData } from "@/lib/ensureBaseData";
import { getCharterCapitalDebt } from "@/lib/charterCapital";
import Decimal from "decimal.js";

const prisma = new PrismaClient();

let orgId: string;
let userId: string;
let periodId: string;
let capitalContributionTypeId: string;

async function postCapitalContribution(amount: number, date: string) {
  const doc = await prisma.document.create({
    data: {
      orgId,
      periodId,
      typeId: capitalContributionTypeId,
      date: new Date(date),
      status: "POSTED",
      payload: { amount, counterpartyHint: "Учредитель Тестов" } as any,
    },
  });
  try {
    await prisma.$transaction(async (tx) => {
      await postDocument(doc.id, tx, userId);
    });
    return { ok: true as const, documentId: doc.id };
  } catch (err: any) {
    // Mirror what the real API routes do on a thrown guard error: the failed
    // attempt's own Document row is voided so it doesn't linger as a phantom
    // POSTED doc with no journal entries (the $transaction above already rolled
    // back the journal entries themselves).
    await prisma.document.update({ where: { id: doc.id }, data: { status: "VOIDED" } });
    return { ok: false as const, error: err.message as string };
  }
}

describe("Charter capital — НСБУ-21 §344/§348 acceptance scenario", { timeout: 30_000 }, () => {
  beforeAll(async () => {
    await ensureBaseData();

    const user = await prisma.user.create({
      data: { email: `charter_e2e_${Date.now()}@test.local`, name: "Charter E2E", passwordHash: "x" },
    });
    userId = user.id;

    const org = await prisma.organization.create({
      data: {
        name: "ООО Тест Устав",
        inn: `CHE2E${Date.now()}`.slice(0, 20),
        taxRegime: "TURNOVER_TAX",
        members: { create: { userId: user.id, role: "OWNER" } },
      },
    });
    orgId = org.id;

    const period = await prisma.period.create({
      data: { orgId, year: 2026, month: 4, mode: "ACTIVE", status: "OPEN" },
    });
    periodId = period.id;

    const capitalType = await prisma.documentType.findUnique({ where: { code: "CAPITAL_CONTRIBUTION" } });
    if (!capitalType) throw new Error("CAPITAL_CONTRIBUTION document type not seeded");
    capitalContributionTypeId = capitalType.id;
  }, 30_000);

  afterAll(async () => {
    if (orgId) await prisma.organization.delete({ where: { id: orgId } }).catch(() => {});
    if (userId) await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    await prisma.$disconnect();
  });

  it("1. before declaration: any CAPITAL_CONTRIBUTION post is rejected", async () => {
    const result = await postCapitalContribution(8_000_000, "2026-04-06");
    expect(result.ok).toBe(false);
    expect((result as any).error).toMatch(/не задекларирован/);
  });

  it("2. declares УК = 10,000,000, NOT_PAID — creates OPENING_CAPITAL_DECLARATION, debt = 10,000,000", async () => {
    const declType = await prisma.documentType.findUnique({ where: { code: "OPENING_CAPITAL_DECLARATION" } });
    if (!declType) throw new Error("OPENING_CAPITAL_DECLARATION not seeded");

    const doc = await prisma.document.create({
      data: {
        orgId,
        periodId,
        typeId: declType.id,
        date: new Date("2026-04-01"),
        status: "POSTED",
        payload: { amount: 10_000_000, fundingType: "NOT_PAID" } as any,
      },
    });
    await prisma.$transaction(async (tx) => postDocument(doc.id, tx, userId));
    await prisma.organization.update({
      where: { id: orgId },
      data: { charterCapitalAmount: 10_000_000, charterCapitalFundingType: "NOT_PAID", charterCapitalDeclaredAt: new Date() },
    });

    const debt = await getCharterCapitalDebt(orgId);
    expect(debt.toNumber()).toBe(10_000_000);
  });

  it("3. 06.04 8,000,000 (≤ debt 10,000,000) → POSTS, debt drops to 2,000,000", async () => {
    const result = await postCapitalContribution(8_000_000, "2026-04-06");
    expect(result.ok).toBe(true);

    const debt = await getCharterCapitalDebt(orgId);
    expect(debt.toNumber()).toBe(2_000_000);
  });

  it("4. 08.04 4,500,000 (> remaining debt 2,000,000) → REJECTED, debt unchanged", async () => {
    const result = await postCapitalContribution(4_500_000, "2026-04-08");
    expect(result.ok).toBe(false);
    expect((result as any).error).toMatch(/превышает остаток долга/);

    const debt = await getCharterCapitalDebt(orgId);
    expect(debt.toNumber()).toBe(2_000_000); // unchanged — nothing posted
  });

  it("5. 09.04 15,000,000 (> remaining debt 2,000,000) → REJECTED, debt still unchanged", async () => {
    const result = await postCapitalContribution(15_000_000, "2026-04-09");
    expect(result.ok).toBe(false);
    expect((result as any).error).toMatch(/превышает остаток долга/);

    const debt = await getCharterCapitalDebt(orgId);
    expect(debt.toNumber()).toBe(2_000_000);
  });

  it("6. Форма №1: 8310-8330 (УК) = exactly 10,000,000; 4610 receivable = 2,000,000; 8890 untouched", async () => {
    const rows = await prisma.$queryRaw<{ code: string; total: string }[]>`
      SELECT a.code, COALESCE(SUM(je.debit - je.credit), 0)::text AS total
      FROM "JournalEntry" je
      JOIN "Document" d ON d.id = je."documentId"
      JOIN "Account" a ON a.id = je."accountId"
      WHERE d."orgId" = ${orgId} AND d.status = 'POSTED' AND a.code IN ('8310','8330','4610','8890')
      GROUP BY a.code
    `;
    const byCode: Record<string, number> = {};
    for (const r of rows) byCode[r.code] = Number(r.total);

    // 8330 balance is credit-normal (liability/equity) — stored as debit-credit, so it's negative here.
    const equity8330 = -(byCode["8330"] || 0);
    const equity8310 = -(byCode["8310"] || 0);
    expect(equity8310 + equity8330).toBe(10_000_000);

    const receivable4610 = byCode["4610"] || 0;
    expect(receivable4610).toBe(2_000_000);

    expect(byCode["8890"] ?? 0).toBe(0);
  });
});

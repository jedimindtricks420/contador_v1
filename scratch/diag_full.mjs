import { PrismaClient } from '@prisma/client';
import Decimal from 'decimal.js';

const prisma = new PrismaClient();

async function main() {
  const org = await prisma.organization.findFirst({ where: { name: 'GORGEOUS PARTNERS' } });
  if (!org) { console.log('Org not found'); return; }

  const accounts = await prisma.account.findMany({ where: { organization_id: org.id } });
  
  // =====================================================
  // 1. ВСЕ ТРАНЗАКЦИИ ХРОНОЛОГИЧЕСКИ
  // =====================================================
  console.log('\n========= ВСЕ ТРАНЗАКЦИИ =========');
  const txs = await prisma.transaction.findMany({
    where: { organization_id: org.id, is_deleted: false },
    include: { debit: true, credit: true },
    orderBy: { date: 'asc' }
  });
  for (const tx of txs) {
    console.log(`${new Date(tx.date).toISOString().split('T')[0]} | ${tx.debit.code} -> ${tx.credit.code} | ${tx.amount} | ${tx.description}`);
  }

  // =====================================================
  // 2. РЕАЛЬНЫЙ ОСТАТОК ПО СЧЕТУ 5110 (РАСЧЕТНЫЙ СЧЕТ)
  // =====================================================
  console.log('\n========= БАЛАНС СЧЕТА 5110 =========');
  const acc5110 = accounts.find(a => a.code === '5110');
  if (acc5110) {
    const dr = await prisma.transaction.aggregate({ _sum: { amount: true }, where: { organization_id: org.id, debit_id: acc5110.id, is_deleted: false } });
    const cr = await prisma.transaction.aggregate({ _sum: { amount: true }, where: { organization_id: org.id, credit_id: acc5110.id, is_deleted: false } });
    console.log(`5110 Дебет (поступления):  ${dr._sum.amount || 0}`);
    console.log(`5110 Кредит (расходы):     ${cr._sum.amount || 0}`);
    console.log(`5110 Остаток в базе:       ${new Decimal(dr._sum.amount || 0).minus(cr._sum.amount || 0)}`);
    console.log(`Реальный остаток в банке:  611 320`);
    console.log(`Разница (база - банк):     ${new Decimal(dr._sum.amount || 0).minus(cr._sum.amount || 0).minus(611320)}`);
  }

  // =====================================================
  // 3. КАК ДАШБОРД СЧИТАЕТ "ДЕНЬГИ В БАНКЕ"
  // =====================================================
  console.log('\n========= ДАШБОРД: ДЕНЬГИ В БАНКЕ =========');
  const bankPrefixes = ['50', '51', '52', '55', '56', '57', '58'];
  const bankAccCodes = accounts.filter(a => bankPrefixes.some(p => a.code.startsWith(p))).map(a => a.code);
  console.log('Счета банка:', bankAccCodes);
  
  const bankDr = await prisma.transaction.aggregate({ _sum: { amount: true }, where: { organization_id: org.id, debit: { code: { in: bankAccCodes } }, is_deleted: false } });
  const bankCr = await prisma.transaction.aggregate({ _sum: { amount: true }, where: { organization_id: org.id, credit: { code: { in: bankAccCodes } }, is_deleted: false } });
  console.log(`Банк Дебет:   ${bankDr._sum.amount || 0}`);
  console.log(`Банк Кредит:  ${bankCr._sum.amount || 0}`);
  console.log(`Банк Итого:   ${new Decimal(bankDr._sum.amount || 0).minus(bankCr._sum.amount || 0)}`);
  
  // =====================================================
  // 4. ЧТО ЕСТЬ НА СЧЕТЕ 5010 (ДЕНЕЖНЫЕ СРЕДСТВА)
  // =====================================================
  const acc5010 = accounts.find(a => a.code === '5010');
  if (acc5010) {
    console.log('\n========= СЧЕТ 5010 =========');
    const d = await prisma.transaction.aggregate({ _sum: { amount: true }, where: { organization_id: org.id, debit_id: acc5010.id, is_deleted: false } });
    const c = await prisma.transaction.aggregate({ _sum: { amount: true }, where: { organization_id: org.id, credit_id: acc5010.id, is_deleted: false } });
    console.log(`5010 Дебет:  ${d._sum.amount || 0}`);
    console.log(`5010 Кредит: ${c._sum.amount || 0}`);
    console.log(`5010 Остаток: ${new Decimal(d._sum.amount || 0).minus(c._sum.amount || 0)}`);
  }

  // =====================================================
  // 5. НАЧАЛЬНЫЙ ОСТАТОК (Счет 0000 -> 5110)
  // =====================================================
  console.log('\n========= ПРОВЕРКА НАЧАЛЬНОГО ОСТАТКА (0000->5110) =========');
  const acc0000 = accounts.find(a => a.code === '0000');
  if (acc0000 && acc5110) {
    const openTx = await prisma.transaction.findMany({
      where: { organization_id: org.id, OR: [{ debit_id: acc0000.id }, { credit_id: acc0000.id }] },
      include: { debit: true, credit: true }
    });
    for (const tx of openTx) {
      console.log(`${new Date(tx.date).toISOString().split('T')[0]} | ${tx.debit.code} -> ${tx.credit.code} | ${tx.amount} | ${tx.description}`);
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());

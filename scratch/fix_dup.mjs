import { PrismaClient } from '@prisma/client';
import Decimal from 'decimal.js';
const prisma = new PrismaClient();

async function main() {
  const org = await prisma.organization.findFirst({ where: { name: 'GORGEOUS PARTNERS' } });
  if (!org) { console.log('Org not found'); return; }
  const accounts = await prisma.account.findMany({ where: { organization_id: org.id } });
  const acc0000 = accounts.find(a => a.code === '0000');
  const acc5110 = accounts.find(a => a.code === '5110');

  // Найти и удалить ВСЕ дублирующие проводки 0000 -> 5110 (от апреля)
  const dupTxs = await prisma.transaction.findMany({
    where: {
      organization_id: org.id,
      debit_id: acc0000.id,
      credit_id: acc5110.id,
      is_deleted: false
    }
  });

  console.log(`Найдено дублирующих проводок 0000->5110: ${dupTxs.length}`);
  for (const tx of dupTxs) {
    await prisma.transaction.update({ where: { id: tx.id }, data: { is_deleted: true } });
    console.log(`✅ Удалена: ${new Date(tx.date).toISOString().split('T')[0]} | ${tx.amount} | ${tx.description}`);
  }

  // Итог
  const dr = await prisma.transaction.aggregate({ _sum: { amount: true }, where: { organization_id: org.id, debit_id: acc5110.id, is_deleted: false } });
  const cr = await prisma.transaction.aggregate({ _sum: { amount: true }, where: { organization_id: org.id, credit_id: acc5110.id, is_deleted: false } });
  const balance = new Decimal(dr._sum.amount || 0).minus(cr._sum.amount || 0);
  console.log(`\n5110 итоговый остаток: ${balance} (реальный: 611 320, разница: ${balance.minus(611320)})`);
}

main().catch(console.error).finally(() => prisma.$disconnect());

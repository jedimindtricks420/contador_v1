import { PrismaClient } from '@prisma/client';
import Decimal from 'decimal.js';
const prisma = new PrismaClient();

async function main() {
  const org = await prisma.organization.findFirst({ where: { name: 'GORGEOUS PARTNERS' } });
  const accounts = await prisma.account.findMany({ where: { organization_id: org.id } });
  
  const acc5110 = accounts.find(a => a.code === '5110');
  const acc5010 = accounts.find(a => a.code === '5010');
  const acc5710 = accounts.find(a => a.code === '5710');
  const acc9030 = accounts.find(a => a.code === '9030');

  // ФИX 1: Удалить дублирующую запись выручки через 5010 (апрель 30)
  // В базе есть 2 записи Payme по 392,000 — одна через 5710, другая через 5010
  // В банковской выписке было только ОДНО поступление от Payme
  const dup = await prisma.transaction.findFirst({
    where: { organization_id: org.id, debit_id: acc5010.id, credit_id: acc9030.id, amount: { gte: 390000, lte: 394000 } }
  });
  if (dup) {
    await prisma.transaction.update({ where: { id: dup.id }, data: { is_deleted: true } });
    console.log(`✅ ФИX 1: Удалена дублирующая запись выручки 5010->9030 на ${dup.amount}`);
  }

  // ФИX 2: Исправить 5710 -> 9030 на 5110 -> 9030
  // Деньги пришли реально на расчетный счет (5110), а не на транзитный (5710)
  const transit = await prisma.transaction.findFirst({
    where: { organization_id: org.id, debit_id: acc5710.id, credit_id: acc9030.id, amount: { gte: 390000, lte: 394000 } }
  });
  if (transit) {
    await prisma.transaction.update({ where: { id: transit.id }, data: { debit_id: acc5110.id } });
    console.log(`✅ ФИX 2: Исправлена выручка 5710->9030: теперь 5110->9030 (деньги на расч. счете)`);
  }

  // ИТОГ
  const dr = await prisma.transaction.aggregate({ _sum: { amount: true }, where: { organization_id: org.id, debit_id: acc5110.id, is_deleted: false } });
  const cr = await prisma.transaction.aggregate({ _sum: { amount: true }, where: { organization_id: org.id, credit_id: acc5110.id, is_deleted: false } });
  const bal = new Decimal(dr._sum.amount || 0).minus(cr._sum.amount || 0);
  console.log(`\n5110 итог: ${bal} | Реальный банк: 611 320 | Разница: ${bal.minus(611320)}`);
  console.log('Готово. Обновите страницу браузера.');
}

main().catch(console.error).finally(() => prisma.$disconnect());

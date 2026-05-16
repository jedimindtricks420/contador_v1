import { PrismaClient } from '@prisma/client';
import Decimal from 'decimal.js';
const prisma = new PrismaClient();

async function main() {
  const org = await prisma.organization.findFirst({ where: { name: 'GORGEOUS PARTNERS' } });
  const accounts = await prisma.account.findMany({ where: { organization_id: org.id } });

  const get = (code) => accounts.find(a => a.code === code);
  const acc5110 = get('5110');
  const acc6520 = get('6520');
  const acc6410 = get('6410');
  const acc6710 = get('6710');

  console.log('=== ДОБАВЛЯЕМ ПРОПУЩЕННЫЕ ОПЛАТЫ НАЛОГОВ ИЗ БАНКА (01.04.2026) ===\n');

  // 1. Оплата Социального налога (март 2026) - 240,000 списано с банка 01.04
  const tx1 = await prisma.transaction.create({
    data: {
      organization_id: org.id,
      date: new Date('2026-04-01T13:17:00Z'),
      period: '04.2026',
      debit_id: acc6520.id,
      credit_id: acc5110.id,
      amount: new Decimal('240000'),
      description: 'Оплата Социального налога за март 2026 (списание с р/с)'
    }
  });
  console.log(`✅ Создана: D 6520 - K 5110 | 240 000 | ${tx1.description}`);

  // 2. Оплата НДФЛ (март 2026) - 238,000 списано с банка 01.04
  // НДФЛ сначала удерживается из зарплаты (D 6710, C 6410), потом платится в бюджет (D 6410, C 5110)
  const tx2 = await prisma.transaction.create({
    data: {
      organization_id: org.id,
      date: new Date('2026-04-01T13:17:00Z'),
      period: '04.2026',
      debit_id: acc6410.id,
      credit_id: acc5110.id,
      amount: new Decimal('238000'),
      description: 'Оплата НДФЛ за март 2026 (списание с р/с)'
    }
  });
  console.log(`✅ Создана: D 6410 - K 5110 | 238 000 | ${tx2.description}`);

  // ИТОГОВАЯ ПРОВЕРКА
  console.log('\n=== ИТОГОВЫЙ БАЛАНС 5110 ===');
  const dr = await prisma.transaction.aggregate({ _sum: { amount: true }, where: { organization_id: org.id, debit_id: acc5110.id, is_deleted: false } });
  const cr = await prisma.transaction.aggregate({ _sum: { amount: true }, where: { organization_id: org.id, credit_id: acc5110.id, is_deleted: false } });
  const bal = new Decimal(dr._sum.amount || 0).minus(cr._sum.amount || 0);
  console.log(`5110 Дебет:   ${dr._sum.amount}`);
  console.log(`5110 Кредит:  ${cr._sum.amount}`);
  console.log(`5110 Остаток: ${bal}`);
  console.log(`Реальный банк: 611 320`);
  console.log(`Разница:       ${bal.minus(611320)}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());

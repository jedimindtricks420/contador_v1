import { PrismaClient } from '@prisma/client';
import Decimal from 'decimal.js';

const prisma = new PrismaClient();

async function main() {
  const org = await prisma.organization.findFirst({ where: { name: 'GORGEOUS PARTNERS' } });
  if (!org) { console.log('Org not found'); return; }

  const accounts = await prisma.account.findMany({ where: { organization_id: org.id } });
  const acc0000 = accounts.find(a => a.code === '0000');
  const acc5010 = accounts.find(a => a.code === '5010');
  const acc5110 = accounts.find(a => a.code === '5110');
  const acc4730 = accounts.find(a => a.code === '4730');

  // ============================================================
  // ИСПРАВЛЕНИЕ №1: Удалить дублированную проводку 0000 -> 5110
  // Это проводка от 01.04.2026 на 15 128 953.49
  // (Обратная к начальному остатку, которая ошибочно задвоила деньги)
  // ============================================================
  console.log('\n--- ИСПРАВЛЕНИЕ №1: Удаление дублированного начального остатка ---');
  
  const dupTx = await prisma.transaction.findFirst({
    where: {
      organization_id: org.id,
      debit_id: acc0000.id,
      credit_id: acc5110.id,
      amount: { gte: 15000000, lte: 15200000 }
    }
  });

  if (dupTx) {
    await prisma.transaction.update({
      where: { id: dupTx.id },
      data: { is_deleted: true }
    });
    console.log(`✅ Удалена дублированная проводка ID: ${dupTx.id} на сумму ${dupTx.amount}`);
  } else {
    console.log('ℹ️  Дублированная проводка не найдена (возможно уже удалена)');
  }

  // ============================================================
  // ИСПРАВЛЕНИЕ №2: Исправить проводку 4730 -> 5010 на 4730 -> 5110
  // Деньги реально ушли с расчетного счета (5110), а не с 5010
  // ============================================================
  console.log('\n--- ИСПРАВЛЕНИЕ №2: Исправление счета списания ссуды ---');

  const loanTx = await prisma.transaction.findFirst({
    where: {
      organization_id: org.id,
      debit_id: acc4730.id,
      credit_id: acc5010.id,
      amount: { gte: 9000000, lte: 11000000 }
    }
  });

  if (loanTx) {
    await prisma.transaction.update({
      where: { id: loanTx.id },
      data: { 
        credit_id: acc5110.id,
        description: `${loanTx.description} [исправлено: списано с 5110]`
      }
    });
    console.log(`✅ Исправлена проводка ID: ${loanTx.id}. Теперь: 4730 -> 5110 (вместо 5010)`);
  } else {
    console.log('ℹ️  Проводка ссуды 4730->5010 не найдена');
  }

  // ============================================================
  // ИТОГОВАЯ ПРОВЕРКА: Какой теперь остаток на 5110?
  // ============================================================
  console.log('\n--- ИТОГОВЫЙ БАЛАНС СЧЕТА 5110 ---');
  const drAfter = await prisma.transaction.aggregate({
    _sum: { amount: true },
    where: { organization_id: org.id, debit_id: acc5110.id, is_deleted: false }
  });
  const crAfter = await prisma.transaction.aggregate({
    _sum: { amount: true },
    where: { organization_id: org.id, credit_id: acc5110.id, is_deleted: false }
  });

  const balance = new Decimal(drAfter._sum.amount || 0).minus(crAfter._sum.amount || 0);
  console.log(`5110 Дебет:    ${drAfter._sum.amount || 0}`);
  console.log(`5110 Кредит:   ${crAfter._sum.amount || 0}`);
  console.log(`5110 Остаток:  ${balance}`);
  console.log(`Реальный банк: 611 320`);
  console.log(`Разница:       ${balance.minus(611320)}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());

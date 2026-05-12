import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const org = await prisma.organization.findFirst({
    where: { name: 'GORGEOUS PARTNERS' }
  });

  if (!org) {
    console.log('Organization not found');
    return;
  }

  console.log('--- Начинаем исправление дат (перенос в 2026 год) ---');
  const transactions = await prisma.transaction.findMany({
    where: { organization_id: org.id }
  });

  let updatedDatesCount = 0;
  for (const tx of transactions) {
    const date = new Date(tx.date);
    const year = date.getFullYear();
    
    if (year === 2024 || year === 2025) {
      date.setFullYear(2026);
      const monthStr = String(date.getMonth() + 1).padStart(2, '0');
      const newPeriod = `${monthStr}.2026`;
      
      await prisma.transaction.update({
        where: { id: tx.id },
        data: {
          date: date,
          period: newPeriod
        }
      });
      updatedDatesCount++;
      console.log(`Транзакция ${tx.id} обновлена: год изменен на 2026.`);
    }
  }
  console.log(`Исправлено дат: ${updatedDatesCount}`);

  console.log('\n--- Начинаем исправление возврата налога ---');
  const refundTx = await prisma.transaction.findFirst({
    where: {
      organization_id: org.id,
      amount: 26952871
    }
  });

  if (refundTx) {
    let targetAccount = await prisma.account.findFirst({
      where: { organization_id: org.id, code: '9390' }
    });

    if (!targetAccount) {
      targetAccount = await prisma.account.findFirst({
        where: { organization_id: org.id, code: '8710' }
      });
    }

    if (!targetAccount) {
        targetAccount = await prisma.account.findFirst({
            where: { organization_id: org.id, code: '0000' }
        });
    }

    if (targetAccount) {
      await prisma.transaction.update({
        where: { id: refundTx.id },
        data: {
          credit_id: targetAccount.id,
          description: '(Исправлено) Возврат ошибочно списанных средств (не налог)'
        }
      });
      console.log(`Транзакция возврата (26 952 871) успешно отвязана от налогового счета.`);
      console.log(`Новый счет кредита: ${targetAccount.code} - ${targetAccount.name}`);
    } else {
      console.log('Не удалось найти подходящий счет для возврата.');
    }
  } else {
    console.log('Транзакция на сумму 26 952 871 не найдена.');
  }

  console.log('\nПатч успешно завершен.');
}

main()
  .catch(e => {
    console.error('Ошибка выполнения патча:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

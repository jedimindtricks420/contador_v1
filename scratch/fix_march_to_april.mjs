import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const org = await prisma.organization.findFirst({
    where: { name: 'GORGEOUS PARTNERS' }
  });

  if (!org) {
    console.log('Org not found');
    return;
  }

  const transactions = await prisma.transaction.findMany({
    where: {
      organization_id: org.id,
      date: {
        gte: new Date('2026-03-31T00:00:00Z'),
        lt: new Date('2026-04-01T00:00:00Z')
      }
    },
    include: {
      debit: true,
      credit: true
    }
  });

  console.log(`Found ${transactions.length} transactions on 31.03.2026`);

  for (const tx of transactions) {
    // Если это ввод остатков (счет 0000), оставляем на 31 марта.
    // Все остальное - в Апрель.
    const isOpeningBalance = tx.debit.code === '0000' || tx.credit.code === '0000';
    
    if (!isOpeningBalance) {
      console.log(`Moving TX ${tx.id} ("${tx.description}") to 01.04.2026`);
      await prisma.transaction.update({
        where: { id: tx.id },
        data: {
          date: new Date('2026-04-01T10:00:00Z'),
          period: '04.2026'
        }
      });
    } else {
      console.log(`Keeping Opening Balance TX ${tx.id} on 31.03.2026`);
    }
  }

  console.log('Cleanup finished.');
}

main().catch(console.error).finally(() => prisma.$disconnect());

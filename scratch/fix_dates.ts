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
    where: { organization_id: org.id }
  });

  console.log(`Found ${transactions.length} transactions. Correcting dates...`);

  for (const tx of transactions) {
    const date = new Date(tx.date);
    const oldYear = date.getFullYear();
    
    if (oldYear === 2024 || oldYear === 2025) {
      date.setFullYear(2026);
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const newPeriod = `${month}.2026`;
      
      console.log(`Updating TX ${tx.id}: ${tx.date.toISOString()} -> ${date.toISOString()}, Period: ${tx.period} -> ${newPeriod}`);
      
      await prisma.transaction.update({
        where: { id: tx.id },
        data: {
          date: date,
          period: newPeriod
        }
      });
    }
  }

  console.log('Correction complete.');
}

main().catch(console.error).finally(() => prisma.$disconnect());

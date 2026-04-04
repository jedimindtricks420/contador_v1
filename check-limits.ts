import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    include: {
      organizations: {
        include: {
          subscription: true
        }
      }
    }
  });

  console.log("=== ПРОВЕРКА ЛИМИТОВ ОРГАНИЗАЦИЙ ===");
  
  for (const user of users) {
    console.log(`Пользователь: ${user.email}`);
    const orgCount = user.organizations.length;
    console.log(`  Организаций: ${orgCount}`);

    user.organizations.forEach(org => {
      const plan = org.subscription?.plan || "FREE";
      console.log(`    - ${org.name} [ПЛАН: ${plan}]`);
    });

    // Проверка логики
    const isFree = user.organizations.some(o => (o.subscription?.plan || "FREE") === "FREE") || orgCount === 0;
    
    if (orgCount >= 1 && isFree) {
      console.log(`  [РЕЗУЛЬТАТ]: Создание второй компании ЗАБЛОКИРОВАНО. Лимит 1/1 для FREE.`);
    } else {
      console.log(`  [РЕЗУЛЬТАТ]: Создание компании РАЗРЕШЕНО. Лимит PRO/MYAPI снят.`);
    }
    console.log("-----------------------------------");
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});

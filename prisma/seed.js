const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient();

async function main() {
  const accounts = [
    { code: '0100', name: 'Основные средства', type: 'ACTIVE' },
    { code: '0200', name: 'Износ основных средств', type: 'PASSIVE' },
    { code: '1000', name: 'Материалы', type: 'ACTIVE' },
    { code: '2800', name: 'Готовая продукция', type: 'ACTIVE' },
    { code: '4010', name: 'Дебиторская задолженность (клиенты)', type: 'ACTIVE' },
    { code: '4300', name: 'Авансы выданные', type: 'ACTIVE' },
    { code: '5110', name: 'Расчетный счет', type: 'ACTIVE' },
    { code: '6010', name: 'Кредиторская задолженность (поставщики)', type: 'PASSIVE' },
    { code: '6400', name: 'Задолженность по налогам', type: 'PASSIVE' },
    { code: '6520', name: 'Задолженность по соцстраху', type: 'PASSIVE' },
    { code: '6710', name: 'Задолженность перед персоналом', type: 'PASSIVE' },
    { code: '8300', name: 'Уставный капитал', type: 'PASSIVE' },
    { code: '8700', name: 'Нераспределенная прибыль', type: 'PASSIVE' },
    { code: '9010', name: 'Выручка от реализации', type: 'PASSIVE' },
    { code: '9410', name: 'Расходы на маркетинг', type: 'ACTIVE' },
    { code: '9420', name: 'Административные расходы', type: 'ACTIVE' },
    { code: '9430', name: 'Прочие операционные расходы', type: 'ACTIVE' },
    { code: '9440', name: 'Расходы по страхованию', type: 'ACTIVE' },
    { code: '000', name: 'Вспомогательный счет (начальный баланс)', type: 'ACTIVE' },
    { code: '9490', name: 'Другие операционные расходы', type: 'ACTIVE' },
  ];

  console.log('Seeding accounts...');
  for (const account of accounts) {
    await prisma.account.upsert({
      where: { code: account.code },
      update: {},
      create: account,
    });
  }

  await prisma.systemSettings.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      closed_period_date: new Date('2024-01-01'),
    },
  });

  console.log('Seeding finished.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

import 'dotenv/config'
import { PrismaClient, AccountType } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('Starting seed...')

  // 1. Create Default User
  const hashedPassword = await bcrypt.hash('securepassword', 10)
  const user = await prisma.user.upsert({
    where: { email: 'admin' },
    update: {},
    create: {
      email: 'admin',
      password_hash: hashedPassword,
      name: 'Администратор',
    },
  })
  console.log(`User created: ${user.email}`)

  // 2. Create Default Organization
  const org = await prisma.organization.upsert({
    where: { id: 'default-org-id' },
    update: {},
    create: {
      id: 'default-org-id',
      name: 'Основная организация',
      inn: '000000000',
      user_id: user.id
    },
  })
  console.log(`Organization created: ${org.name}`)

  const accounts = [
    { code: '000', name: 'Вспомогательный счет (начальный баланс)', type: AccountType.ACTIVE },
    { code: '0100', name: 'Основные средства', type: AccountType.ACTIVE },
    { code: '0200', name: 'Износ основных средств', type: AccountType.PASSIVE },
    { code: '1000', name: 'Материалы', type: AccountType.ACTIVE },
    { code: '2800', name: 'Готовая продукция', type: AccountType.ACTIVE },
    { code: '4010', name: 'Дебиторская задолженность (клиенты)', type: AccountType.ACTIVE },
    { code: '4300', name: 'Авансы выданные', type: AccountType.ACTIVE },
    { code: '5110', name: 'Расчетный счет', type: AccountType.ACTIVE },
    { code: '6010', name: 'Кредиторская задолженность (поставщики)', type: AccountType.PASSIVE },
    { code: '6400', name: 'Задолженность по налогам', type: AccountType.PASSIVE },
    { code: '6520', name: 'Задолженность по соцстраху', type: AccountType.PASSIVE },
    { code: '6710', name: 'Задолженность перед персоналом', type: AccountType.PASSIVE },
    { code: '8300', name: 'Уставный капитал', type: AccountType.PASSIVE },
    { code: '8700', name: 'Нераспределенная прибыль', type: AccountType.PASSIVE },
    { code: '9010', name: 'Выручка от реализации', type: AccountType.PASSIVE },
    { code: '9410', name: 'Расходы на маркетинг', type: AccountType.ACTIVE },
    { code: '9420', name: 'Административные расходы', type: AccountType.ACTIVE },
    { code: '9430', name: 'Прочие операционные расходы', type: AccountType.ACTIVE },
    { code: '9440', name: 'Расходы по страхованию', type: AccountType.ACTIVE },
    { code: '9490', name: 'Другие операционные расходы', type: AccountType.ACTIVE },
  ]

  console.log('Seeding accounts...')
  for (const account of accounts) {
    await prisma.account.upsert({
      where: { 
        code_organization_id: {
          code: account.code,
          organization_id: org.id
        }
      },
      update: {},
      create: {
        ...account,
        organization_id: org.id
      },
    })
  }

  // Initial system settings
  await prisma.systemSettings.upsert({
    where: { organization_id: org.id },
    update: {},
    create: {
      closed_period_date: new Date('2024-01-01'),
      organization_id: org.id
    },
  })

  console.log('Seeding finished successfully.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

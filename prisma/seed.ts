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

  // 3. Seed Accounts and Settings using shared utility
  const { seedDefaultDataForOrg } = await import('../src/lib/seed-utils');
  await seedDefaultDataForOrg(org.id);

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

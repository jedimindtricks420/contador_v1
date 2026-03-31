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

  // 3. Seed MasterAccounts from shared utility
  const { defaultAccounts, seedDefaultDataForOrg } = await import('../src/lib/seed-utils');
  console.log('Seeding MasterAccounts...');
  for (const acc of defaultAccounts) {
    await prisma.masterAccount.upsert({
      where: { code: acc.code },
      update: { name: acc.name, type: acc.type },
      create: {
        code: acc.code,
        name: acc.name,
        type: acc.type,
        description: "",
        section: "",
        is_system: acc.code === '0000' || acc.code === '9910'
      }
    });
  }

  // 4. Update User's active_org_id
  await prisma.user.update({
    where: { id: user.id },
    data: { active_org_id: org.id }
  });
  console.log(`Updated user ${user.email} with active_org_id: ${org.id}`);

  // 5. Seed Accounts and Settings for the organization
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

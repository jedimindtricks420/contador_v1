import { PrismaClient } from '@prisma/client'
import { seedDefaultDataForOrg } from '../src/lib/seed-utils'

const prisma = new PrismaClient()

async function main() {
  console.log('Fetching all organizations...')
  const orgs = await prisma.organization.findMany()

  for (const org of orgs) {
    console.log(`Resetting accounts for: ${org.name} (${org.id})...`)
    
    // Safety check for existing transactions (Postgres will block if needed, but we checked)
    const txCount = await prisma.transaction.count({ where: { organization_id: org.id } })
    if (txCount > 0) {
      console.warn(`Org ${org.name} has ${txCount} transactions. Skipping deletion! Use merge instead.`)
      continue
    }

    // Full deletion
    await prisma.account.deleteMany({
      where: { organization_id: org.id }
    })
    console.log(`Accounts deleted. Seeding full NSBU chart (339 accounts)...`)

    // Repopulate with the 339 accounts
    await seedDefaultDataForOrg(org.id)
    console.log(`Org ${org.name} successfully reset.`)
  }

  const totalAccounts = await prisma.account.count()
  console.log(`Total accounts across all orgs: ${totalAccounts}`)
  console.log('RESET COMPLETE')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

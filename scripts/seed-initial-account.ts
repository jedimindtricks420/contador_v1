import { PrismaClient } from '@prisma/client'
import { seedDefaultDataForOrg } from '../src/lib/seed-utils'

const prisma = new PrismaClient()

async function main() {
  const organizations = await prisma.organization.findMany()
  console.log(`Found ${organizations.length} organizations.`)

  for (const org of organizations) {
    console.log(`Updating accounts for organization: ${org.name} (${org.id})`)
    await seedDefaultDataForOrg(org.id)
  }

  console.log('Successfully added auxiliary account 0000 to all organizations.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

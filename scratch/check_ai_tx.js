const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const aiLogs = await prisma.auditLog.findMany({
    where: { action: 'AI_TRANSACTION_AUTO_CREATE' },
    orderBy: { created_at: 'desc' },
    take: 10
  })

  console.log('Last 10 AI Creations:')
  if (aiLogs.length === 0) {
    console.log('No AI logs found.')
  }
  for (const log of aiLogs) {
    const tx = await prisma.transaction.findUnique({
      where: { id: log.entity_id },
      include: { debit: true, credit: true }
    })
    console.log(`Log ID: ${log.id}, Tx ID: ${tx?.id}, Desc: ${tx?.description}, Deleted: ${tx?.is_deleted}`)
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())

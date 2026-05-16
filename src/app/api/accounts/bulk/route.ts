import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getActiveOrganizationId } from '@/lib/context'

export async function POST(request: Request) {
  try {
    const organizationId = await getActiveOrganizationId()
    const { master_account_ids } = await request.json()

    if (!Array.isArray(master_account_ids) || master_account_ids.length === 0) {
      return NextResponse.json({ error: 'Укажите массив master_account_ids' }, { status: 400 })
    }

    // Get all master accounts
    const masterAccounts = await prisma.masterAccount.findMany({
      where: { id: { in: master_account_ids } }
    })

    const accountsToCreate = masterAccounts.map(master => ({
      code: master.code,
      name: master.name,
      type: master.type,
      organization_id: organizationId,
      master_account_id: master.id,
      is_active: true,
      is_custom: false,
    }))

    // Use upsert-like logic via createMany (PostgreSQL supported)
    // For simplicity, we'll do them in a loop or use skipDuplicates if supported
    // Since we have a unique constraint, we'll use a transaction with multiple upserts
    
    const results = await prisma.$transaction(
      accountsToCreate.map(data => 
        prisma.account.upsert({
          where: {
            code_organization_id: {
              code: data.code,
              organization_id: organizationId
            }
          },
          create: data,
          update: { is_active: true }
        })
      )
    )

    return NextResponse.json({ success: true, count: results.length })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Ошибка сервера' }, { status: 500 })
  }
}

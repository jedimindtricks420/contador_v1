import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getActiveOrganizationId } from '@/lib/context'

// GET MasterAccounts not yet in this org (for "add from NSBU" block)
export async function GET() {
  try {
    const organizationId = await getActiveOrganizationId()

    // Get codes already in org
    const existing = await prisma.account.findMany({
      where: { organization_id: organizationId },
      select: { master_account_id: true }
    })
    const existingMasterIds = existing
      .map(a => a.master_account_id)
      .filter(Boolean) as string[]

    // Return MasterAccounts not in this org
    const masterAccounts = await prisma.masterAccount.findMany({
      where: {
        id: { notIn: existingMasterIds }
      },
      orderBy: { code: 'asc' },
    })

    return NextResponse.json(masterAccounts)
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Unauthorized' }, { status: 401 })
  }
}

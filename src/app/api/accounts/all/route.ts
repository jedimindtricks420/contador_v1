import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getActiveOrganizationId } from '@/lib/context'

// GET all accounts (including inactive) — for settings page only
export async function GET() {
  try {
    const organizationId = await getActiveOrganizationId()

    const accounts = await prisma.account.findMany({
      where: { organization_id: organizationId },
      orderBy: { code: 'asc' },
    })

    return NextResponse.json(accounts)
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Unauthorized' }, { status: 401 })
  }
}

import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getActiveOrganizationId } from '@/lib/context'

export async function GET() {
  try {
    const orgId = await getActiveOrganizationId();
    const settings = await prisma.systemSettings.findUnique({
      where: { organization_id: orgId }
    })
    return NextResponse.json(settings)
  } catch (error: any) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}

export async function POST(request: Request) {
  try {
    const orgId = await getActiveOrganizationId();
    const { closed_period_date, opening_balance_date, is_initial_balance_fixed } = await request.json()
    
    const settings = await prisma.systemSettings.upsert({
      where: { organization_id: orgId },
      update: { 
        closed_period_date: closed_period_date ? new Date(closed_period_date) : undefined,
        opening_balance_date: opening_balance_date ? new Date(opening_balance_date) : undefined,
        is_initial_balance_fixed: is_initial_balance_fixed
      },
      create: { 
        closed_period_date: new Date(closed_period_date || '2024-01-01'),
        opening_balance_date: new Date(opening_balance_date || '2025-01-01'),
        is_initial_balance_fixed: is_initial_balance_fixed || false,
        organization_id: orgId
      },
    })

    return NextResponse.json(settings)
  } catch (error: any) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}

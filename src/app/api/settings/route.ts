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
    const { closed_period_date } = await request.json()
    
    const settings = await prisma.systemSettings.upsert({
      where: { organization_id: orgId },
      update: { closed_period_date: new Date(closed_period_date) },
      create: { 
        closed_period_date: new Date(closed_period_date),
        organization_id: orgId
      },
    })

    return NextResponse.json(settings)
  } catch (error: any) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}

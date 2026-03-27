import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getActiveOrganizationId } from '@/lib/context'

export async function GET() {
  try {
    const organizationId = await getActiveOrganizationId();
    
    const counterparties = await prisma.counterparty.findMany({
      where: { organization_id: organizationId },
      orderBy: { name: 'asc' },
    })
    return NextResponse.json(counterparties)
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Unauthorized' }, { status: 401 })
  }
}

export async function POST(request: Request) {
  try {
    const organizationId = await getActiveOrganizationId();
    const { name, inn } = await request.json()
    
    if (!name) {
      return NextResponse.json({ error: 'Наименование обязательно' }, { status: 400 })
    }

    const counterparty = await prisma.counterparty.create({
      data: {
        name,
        inn,
        organization_id: organizationId
      },
    })

    return NextResponse.json(counterparty)
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Unauthorized' }, { status: 401 })
  }
}

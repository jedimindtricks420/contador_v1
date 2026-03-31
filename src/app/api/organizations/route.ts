import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getUser } from '@/lib/context'

export async function GET() {
  try {
    const { id: userId } = await getUser()

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { active_org_id: true }
    })

    const organizations = await prisma.organization.findMany({
      where: { user_id: userId },
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true, inn: true, onboarding_state: true }
    })

    const result = organizations.map(org => ({
      ...org,
      is_active: org.id === user?.active_org_id,
    }))

    return NextResponse.json(result)
  } catch (error: any) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}

export async function POST(request: Request) {
  try {
    const { id: userId } = await getUser()
    const { name, inn } = await request.json()

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Название организации обязательно' }, { status: 400 })
    }

    const result = await prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: {
          name: name.trim(),
          inn: inn?.trim() || null,
          user_id: userId,
          onboarding_state: 'COMPLETED',
        },
      })

      const { seedDefaultDataForOrg } = await import('@/lib/seed-utils')
      await seedDefaultDataForOrg(organization.id)

      return organization
    })

    return NextResponse.json(result)
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Ошибка сервера' }, { status: 500 })
  }
}

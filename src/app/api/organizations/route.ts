import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getUser } from '@/lib/context'
import { z } from 'zod'

const organizationSchema = z.object({
  name: z.string().min(2, "Название организации должно быть не менее 2 символов").max(100),
  inn: z.string().optional().nullable(),
})

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
    console.error('[API_ORGANIZATIONS_GET]', error);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}

export async function POST(request: Request) {
  try {
    const { id: userId } = await getUser()
    const body = await request.json()
    const validated = organizationSchema.parse(body)

    const result = await prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: {
          name: validated.name.trim(),
          inn: validated.inn?.trim() || null,
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
    console.error('[API_ORGANIZATIONS_POST]', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten().fieldErrors }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getUser } from '@/lib/context'

export async function GET() {
  try {
    const user = await getUser();
    const organizations = await prisma.organization.findMany({
      where: { user_id: user.id },
      orderBy: { name: 'asc' },
    })
    return NextResponse.json(organizations)
  } catch (error: any) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}

export async function POST(request: Request) {
  try {
    const user = await getUser();
    const { name, inn } = await request.json()
    
    if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 })

    const result = await prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: {
          name,
          inn,
          user_id: user.id
        },
      });

      // Seed default accounts and settings for the new organization
      const { seedDefaultDataForOrg } = await import('@/lib/seed-utils');
      await seedDefaultDataForOrg(organization.id);

      return organization;
    });

    return NextResponse.json(result)
  } catch (error: any) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}

import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

// Public endpoint — no auth required (used on onboarding page)
export async function GET() {
  try {
    const templates = await prisma.industryTemplate.findMany({
      where: { is_active: true },
      orderBy: { sort_order: 'asc' },
      select: {
        id: true,
        key: true,
        name: true,
        description: true,
        sort_order: true,
      }
    })
    return NextResponse.json(templates)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getUser } from '@/lib/context'

export async function POST(request: Request) {
  try {
    const { id: userId } = await getUser()
    
    // Support both old (organizationId) and new (org_id) field names
    const body = await request.json()
    const orgId = body.org_id || body.organizationId

    if (!orgId) {
      return NextResponse.json({ error: 'org_id обязателен' }, { status: 400 })
    }

    // Verify org belongs to this user
    const org = await prisma.organization.findFirst({
      where: { id: orgId, user_id: userId }
    })

    if (!org) {
      return NextResponse.json({ error: 'Организация не найдена или нет доступа' }, { status: 403 })
    }

    // Update active_org_id in DB — no JWT reissue needed
    await prisma.user.update({
      where: { id: userId },
      data: { active_org_id: orgId }
    })

    // Update the readable cookie for frontend state
    const response = NextResponse.json({ success: true })
    response.cookies.set('organizationId', orgId, {
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000),
      httpOnly: false,
      secure: false,
    })

    return response
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Ошибка сервера' }, { status: 500 })
  }
}

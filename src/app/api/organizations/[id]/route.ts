import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getUser } from '@/lib/context'

// PATCH /api/organizations/[id] — Update name/inn
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: userId } = await getUser()
    const { id } = await context.params
    const { name, inn } = await request.json()

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Название обязательно' }, { status: 400 })
    }

    // Verify ownership
    const org = await prisma.organization.findFirst({
      where: { id, user_id: userId }
    })

    if (!org) {
      return NextResponse.json({ error: 'Организация не найдена' }, { status: 404 })
    }

    const updated = await prisma.organization.update({
      where: { id },
      data: {
        name: name.trim(),
        inn: inn?.trim() || null
      }
    })

    return NextResponse.json(updated)
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Ошибка сервера' }, { status: 500 })
  }
}

// DELETE /api/organizations/[id] — Delete organization and all related data
export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: userId } = await getUser()
    const { id } = await context.params

    // Verify ownership
    const org = await prisma.organization.findFirst({
      where: { id, user_id: userId }
    })

    if (!org) {
      return NextResponse.json({ error: 'Организация не найдена' }, { status: 404 })
    }

    // Atomic delete
    await prisma.$transaction(async (tx) => {
      // 1. Delete all related data (if not cascaded in schema)
      // Transaction will handle all relations for this org_id
      await tx.transaction.deleteMany({ where: { organization_id: id } })
      await tx.account.deleteMany({ where: { organization_id: id } })
      await tx.counterparty.deleteMany({ where: { organization_id: id } })
      await tx.systemSettings.deleteMany({ where: { organization_id: id } })
      
      // 2. Delete the organization itself
      await tx.organization.delete({ where: { id } })

      // 3. If it was active_org_id for the user, reset it
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { active_org_id: true }
      })

      if (user?.active_org_id === id) {
        // Find another organization to make active, or set to null
        const anotherOrg = await tx.organization.findFirst({
          where: { user_id: userId }
        })
        await tx.user.update({
          where: { id: userId },
          data: { active_org_id: anotherOrg?.id || null }
        })
      }
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Delete org error:', error)
    return NextResponse.json({ error: error.message || 'Ошибка сервера' }, { status: 500 })
  }
}

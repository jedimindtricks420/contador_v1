import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getUser } from '@/lib/context'
import { getActiveOrganizationId } from '@/lib/context'

export async function POST(request: Request) {
  try {
    const { id: userId } = await getUser()
    const orgId = await getActiveOrganizationId()
    const body = await request.json()

    // Mode: 'full' — apply all MasterAccounts
    if (body.mode === 'full') {
      const allMasterAccounts = await prisma.masterAccount.findMany({
        orderBy: { code: 'asc' }
      })

      await prisma.$transaction(
        allMasterAccounts.map(master =>
          prisma.account.upsert({
            where: { code_organization_id: { code: master.code, organization_id: orgId } },
            create: {
              code: master.code,
              name: master.name,
              type: master.type,
              organization_id: orgId,
              master_account_id: master.id,
              is_active: true,
              is_custom: false,
            },
            update: {}
          })
        )
      )

      await prisma.organization.update({
        where: { id: orgId },
        data: { template_id: null, onboarding_state: 'COMPLETED', onboarding_step: 3 }
      })

      return NextResponse.json({ success: true })
    }

    // Mode: by template key
    const { template_key } = body
    if (!template_key) {
      return NextResponse.json({ error: 'template_key обязателен' }, { status: 400 })
    }

    const template = await prisma.industryTemplate.findUnique({
      where: { key: template_key },
      include: {
        items: { include: { master_account: true } }
      }
    })

    if (!template) {
      return NextResponse.json({ error: 'Шаблон не найден' }, { status: 404 })
    }

    await prisma.$transaction(
      template.items.map(item =>
        prisma.account.upsert({
          where: {
            code_organization_id: {
              code: item.master_account.code,
              organization_id: orgId,
            }
          },
          create: {
            code: item.master_account.code,
            name: item.master_account.name,
            type: item.master_account.type,
            organization_id: orgId,
            master_account_id: item.master_account.id,
            is_active: true,
            is_custom: false,
          },
          update: {}
        })
      )
    )

    await prisma.organization.update({
      where: { id: orgId },
      data: {
        template_id: template.id,
        onboarding_state: 'COMPLETED',
        onboarding_step: 3,
      }
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Apply template error:', error)
    return NextResponse.json({ error: error.message || 'Ошибка сервера' }, { status: 500 })
  }
}

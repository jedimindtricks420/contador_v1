import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getActiveOrganizationId } from '@/lib/context'

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> } // Params is now a Promise in Next.js 15+
) {
  try {
    const orgId = await getActiveOrganizationId()
    const { id } = await context.params // Await the params

    // 1. Verify account belongs to this org
    const account = await prisma.account.findFirst({
      where: { id, organization_id: orgId }
    })

    if (!account) {
      return NextResponse.json({ error: 'Счёт не найден' }, { status: 404 })
    }

    // 2. If deactivating — check for transactions
    if (account.is_active) {
      const txCount = await prisma.transaction.count({
        where: {
          organization_id: orgId,
          is_deleted: false,
          OR: [{ debit_id: id }, { credit_id: id }]
        }
      })
      if (txCount > 0) {
        return NextResponse.json(
          { error: `Нельзя деактивировать: счёт используется в ${txCount} проводках` },
          { status: 409 }
        )
      }
    }

    // 3. Check is_required in template
    if (account.is_active && account.master_account_id) {
      const org = await prisma.organization.findUnique({
        where: { id: orgId },
        select: { template_id: true }
      })

      if (org?.template_id) {
        const requiredItem = await prisma.industryTemplateItem.findFirst({
          where: {
            master_account_id: account.master_account_id,
            template_id: org.template_id,
            is_required: true,
          }
        })
        if (requiredItem) {
          return NextResponse.json(
            { error: 'Обязательный счёт шаблона — нельзя деактивировать' },
            { status: 409 }
          )
        }
      }
    }

    // 4. Toggle
    const updated = await prisma.account.update({
      where: { id },
      data: { is_active: !account.is_active }
    })

    return NextResponse.json(updated)
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Ошибка сервера' }, { status: 500 })
  }
}

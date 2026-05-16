import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getActiveOrganizationId } from '@/lib/context'

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const orgId = await getActiveOrganizationId();
    const { id } = await params

    const result = await prisma.$transaction(async (tx) => {
        // Проверяем что транзакция существует и принадлежит организации
        const transaction = await tx.transaction.findFirst({
            where: { id, organization_id: orgId }
        })
        if (!transaction) {
          throw Object.assign(new Error('Операция не найдена'), { status: 404 })
        }

        const settings = await tx.systemSettings.findUnique({
            where: { organization_id: orgId }
        })
        if (settings && transaction.date <= settings.closed_period_date) {
            throw Object.assign(new Error('Период закрыт для редактирования (закрыт до ' + settings.closed_period_date.toLocaleDateString() + ')'), { status: 403 })
        }

        const updated = await tx.transaction.update({
            where: { id },
            data: { is_deleted: true }
        })

        await tx.auditLog.create({
            data: {
                organization_id: orgId,
                user_id: "user", // В идеале тут должен быть реальный ID пользователя
                action: "TRANSACTION_DELETE",
                entity_type: "Transaction",
                entity_id: id,
                payload: {
                    description: transaction.description,
                    amount: transaction.amount.toString(),
                    date: transaction.date
                }
            }
        })

        return updated
    })

    return NextResponse.json(result)
  } catch (error: any) {
    const status = error.status ?? 400
    return NextResponse.json({ error: error.message }, { status })
  }
}


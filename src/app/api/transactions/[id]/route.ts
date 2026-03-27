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
        // Validation check
        const transaction = await tx.transaction.findFirst({
            where: { id, organization_id: orgId }
        })
        if (!transaction) throw new Error('Transaction not found')

        const settings = await tx.systemSettings.findUnique({
            where: { organization_id: orgId }
        })
        if (settings && transaction.date <= settings.closed_period_date) {
            throw new Error('Period is closed')
        }

        return await tx.transaction.update({
            where: { id },
            data: { is_deleted: true }
        })
    })

    return NextResponse.json(result)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 401 })
  }
}

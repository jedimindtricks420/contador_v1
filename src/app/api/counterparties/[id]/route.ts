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

    const transactionCount = await prisma.transaction.count({
      where: { counterparty_id: id, organization_id: orgId },
    })

    if (transactionCount > 0) {
      return NextResponse.json({ 
        error: 'Нельзя удалить контрагента, так как по нему есть проведенные операции.' 
      }, { status: 400 })
    }

    await prisma.counterparty.delete({
      where: { id, organization_id: orgId },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 401 })
  }
}

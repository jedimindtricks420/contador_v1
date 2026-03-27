import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getActiveOrganizationId } from '@/lib/context'
import Decimal from 'decimal.js'

export async function GET(request: Request) {
  try {
    const orgId = await getActiveOrganizationId();
    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period')

    if (!period) return NextResponse.json({ error: 'Period required' }, { status: 400 })

    const accounts = await prisma.account.findMany({
        where: { organization_id: orgId },
        orderBy: { code: 'asc' }
    })

    const osv = await Promise.all(accounts.map(async (acc) => {
        const dr = await prisma.transaction.aggregate({
            _sum: { amount: true },
            where: { organization_id: orgId, period, debit_id: acc.id, is_deleted: false }
        })
        const cr = await prisma.transaction.aggregate({
            _sum: { amount: true },
            where: { organization_id: orgId, period, credit_id: acc.id, is_deleted: false }
        })

        const debitAmount = dr._sum.amount || new Decimal(0)
        const creditAmount = cr._sum.amount || new Decimal(0)

        const debitBal = acc.type === 'ACTIVE' ? debitAmount.minus(creditAmount) : new Decimal(0)
        const creditBal = acc.type === 'PASSIVE' ? creditAmount.minus(debitAmount) : new Decimal(0)

        return {
            code: acc.code,
            name: acc.name,
            type: acc.type,
            debitTurnover: Number(debitAmount),
            creditTurnover: Number(creditAmount),
            balanceDebit: Number(debitBal.isNegative() ? 0 : debitBal),
            balanceCredit: Number(creditBal.isNegative() ? 0 : creditBal)
        }
    }))

    return NextResponse.json(osv)
  } catch (error: any) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}

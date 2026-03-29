import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getActiveOrganizationId } from '@/lib/context'
import Decimal from 'decimal.js'

export async function GET() {
  try {
    const orgId = await getActiveOrganizationId();
    
    const accounts = await prisma.account.findMany({
        where: { organization_id: orgId, code: { not: '0000' } },
    })

    const getTurnover = async (codes: string[]) => {
        let total = new Decimal(0)
        for (const code of codes) {
            const acc = accounts.find(a => a.code === code)
            if (!acc) continue

            const dr = await prisma.transaction.aggregate({
                _sum: { amount: true },
                where: { organization_id: orgId, debit_id: acc.id, is_deleted: false }
            })
            const cr = await prisma.transaction.aggregate({
                _sum: { amount: true },
                where: { organization_id: orgId, credit_id: acc.id, is_deleted: false }
            })

            const debit = dr._sum.amount || new Decimal(0)
            const credit = cr._sum.amount || new Decimal(0)
            
            // For P&L turnover is usually Dr items
            total = total.plus(debit.minus(credit).abs())
        }
        return total
    }

    const revenueRes = await prisma.transaction.aggregate({
        _sum: { amount: true },
        where: { organization_id: orgId, credit: { code: '9010' }, is_deleted: false }
    })
    const revenue = revenueRes._sum.amount || new Decimal(0)

    const expenses = {
        marketing: await getTurnover(['9410']),
        admin: await getTurnover(['9420']),
        other: await getTurnover(['9430']),
        insurance: await getTurnover(['9440']),
        misc: await getTurnover(['9450']),
    }

    const totalExpenses = Object.values(expenses).reduce((a, b) => a.plus(b), new Decimal(0))
    const netProfit = revenue.minus(totalExpenses)

    return NextResponse.json({
        revenue: Number(revenue),
        expenses: {
            ...Object.fromEntries(Object.entries(expenses).map(([k, v]) => [k, Number(v)])),
            total: Number(totalExpenses)
        },
        netProfit: Number(netProfit)
    })
  } catch (error: any) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}

import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getActiveOrganizationId } from '@/lib/context'
import Decimal from 'decimal.js'

export async function GET() {
  try {
    const orgId = await getActiveOrganizationId();
    
    // Revenue (Sum of Creditor turnover of 9010)
    const revenueRes = await prisma.transaction.aggregate({
      _sum: { amount: true },
      where: { organization_id: orgId, credit: { code: '9010' }, is_deleted: false }
    })
    const revenue = revenueRes._sum.amount || new Decimal(0)

    // Expenses (Sum of Debit turnover of 94*)
    const expensesRes = await prisma.transaction.aggregate({
      _sum: { amount: true },
      where: { organization_id: orgId, debit: { code: { startsWith: '94' } }, is_deleted: false }
    })
    const expenses = expensesRes._sum.amount || new Decimal(0)

    // Bank (Dr 5110 - Cr 5110)
    const bankDr = await prisma.transaction.aggregate({
      _sum: { amount: true },
      where: { organization_id: orgId, debit: { code: '5110' }, is_deleted: false }
    })
    const bankCr = await prisma.transaction.aggregate({
      _sum: { amount: true },
      where: { organization_id: orgId, credit: { code: '5110' }, is_deleted: false }
    })
    const bank = (bankDr._sum.amount || new Decimal(0)).minus(bankCr._sum.amount || new Decimal(0))

    // AR (Dr 4010 - Cr 4010)
    const arDr = await prisma.transaction.aggregate({
      _sum: { amount: true },
      where: { organization_id: orgId, debit: { code: '4010' }, is_deleted: false }
    })
    const arCr = await prisma.transaction.aggregate({
      _sum: { amount: true },
      where: { organization_id: orgId, credit: { code: '4010' }, is_deleted: false }
    })
    const ar = (arDr._sum.amount || new Decimal(0)).minus(arCr._sum.amount || new Decimal(0))

    // Margin
    const margin = revenue.isZero() ? 0 : Number(revenue.minus(expenses).div(revenue).mul(100))

    // Expenses By Account (94*)
    const accounts = await prisma.account.findMany({
        where: { organization_id: orgId, code: { startsWith: '94' } }
    })
    const expensesByAccount = await Promise.all(accounts.map(async (acc) => {
        const aggr = await prisma.transaction.aggregate({
            _sum: { amount: true },
            where: { organization_id: orgId, debit_id: acc.id, is_deleted: false }
        })
        return {
            code: acc.code,
            name: acc.name,
            amount: Number(aggr._sum.amount || 0)
        }
    }))

    // Chart Data (Last 6 months)
    const months = []
    for (let i = 5; i >= 0; i--) {
        const d = new Date()
        d.setMonth(d.getMonth() - i)
        months.push(`${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`)
    }

    const chartData = await Promise.all(months.map(async (m) => {
        const rev = await prisma.transaction.aggregate({
            _sum: { amount: true },
            where: { organization_id: orgId, period: m, credit: { code: '9010' }, is_deleted: false }
        })
        const exp = await prisma.transaction.aggregate({
            _sum: { amount: true },
            where: { organization_id: orgId, period: m, debit: { code: { startsWith: '94' } }, is_deleted: false }
        })
        return {
            period: m,
            revenue: Number(rev._sum.amount || 0),
            expenses: Number(exp._sum.amount || 0)
        }
    }))

    return NextResponse.json({
      metrics: {
        revenue: Number(revenue),
        expenses: Number(expenses),
        profit: Number(revenue.minus(expenses)),
        margin: Number(margin),
        bank: Number(bank),
        ar: Number(ar),
      },
      expensesByAccount: expensesByAccount.filter(e => e.amount > 0).sort((a,b) => b.amount - a.amount),
      chartData
    })
  } catch (error: any) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}

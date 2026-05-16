import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getActiveOrganizationId } from '@/lib/context'
import Decimal from 'decimal.js'

export async function GET() {
  try {
    const orgId = await getActiveOrganizationId();
    
    // 1. Revenue (Credit turnover of 9010, 9020, 9030 - Debit 9040, 9050)
    const getTurnover = async (prefixes: string[], side: 'debit' | 'credit', period?: string) => {
        const dr = await prisma.transaction.aggregate({
            _sum: { amount: true },
            where: { 
                organization_id: orgId, 
                debit: { code: { in: prefixes.flatMap(p => accounts_all.filter(a => a.code.startsWith(p)).map(a => a.code)) } },
                is_deleted: false,
                ...(period ? { period } : {})
            }
        })
        const cr = await prisma.transaction.aggregate({
            _sum: { amount: true },
            where: { 
                organization_id: orgId, 
                credit: { code: { in: prefixes.flatMap(p => accounts_all.filter(a => a.code.startsWith(p)).map(a => a.code)) } },
                is_deleted: false,
                ...(period ? { period } : {})
            }
        })
        const totalDr = dr._sum.amount || new Decimal(0)
        const totalCr = cr._sum.amount || new Decimal(0)
        return side === 'debit' ? totalDr.minus(totalCr) : totalCr.minus(totalDr)
    }

    const accounts_all = await prisma.account.findMany({ where: { organization_id: orgId } })

    const revenue = await getTurnover(['901', '902', '903'], 'credit')
    const returns = await getTurnover(['904', '905'], 'debit')
    const netRevenue = revenue.minus(returns)
    
    const expenses = await getTurnover(['91', '94'], 'debit')

    // Bank: только реальный остаток расчетного счета 5110
    const acc5110 = accounts_all.find(a => a.code === '5110')
    let bank = new Decimal(0)
    if (acc5110) {
      const b_dr = await prisma.transaction.aggregate({ _sum: { amount: true }, where: { organization_id: orgId, debit_id: acc5110.id, is_deleted: false } })
      const b_cr = await prisma.transaction.aggregate({ _sum: { amount: true }, where: { organization_id: orgId, credit_id: acc5110.id, is_deleted: false } })
      bank = (b_dr._sum.amount || new Decimal(0)).minus(b_cr._sum.amount || new Decimal(0))
    }

    // Cash: остаток кассы 5010 (нацвалюта)
    const acc5010 = accounts_all.find(a => a.code === '5010')
    let cash = new Decimal(0)
    if (acc5010) {
      const c_dr = await prisma.transaction.aggregate({ _sum: { amount: true }, where: { organization_id: orgId, debit_id: acc5010.id, is_deleted: false } })
      const c_cr = await prisma.transaction.aggregate({ _sum: { amount: true }, where: { organization_id: orgId, credit_id: acc5010.id, is_deleted: false } })
      cash = (c_dr._sum.amount || new Decimal(0)).minus(c_cr._sum.amount || new Decimal(0))
    }

    // AR (Net balance of 40-48)
    const ar = await getTurnover(['40', '41', '42', '45', '46', '47', '48'], 'debit')

    // Margin
    const margin = netRevenue.isZero() ? 0 : Number(netRevenue.minus(expenses).div(netRevenue).mul(100))

    // Expenses By Account (94*)
    const expensesByAccount = await Promise.all(accounts_all.filter(a => a.code.startsWith('94')).map(async (acc) => {
        const aggrDr = await prisma.transaction.aggregate({
            _sum: { amount: true },
            where: { organization_id: orgId, debit_id: acc.id, is_deleted: false }
        })
        const aggrCr = await prisma.transaction.aggregate({
            _sum: { amount: true },
            where: { organization_id: orgId, credit_id: acc.id, is_deleted: false }
        })
        return {
            code: acc.code,
            name: acc.name,
            amount: Number((aggrDr._sum.amount || new Decimal(0)).minus(aggrCr._sum.amount || 0))
        }
    }))

    // Chart Data (Last 6 months)
    const months = []
    const d = new Date()
    d.setDate(1) // Avoid month-end overflow bugs
    for (let i = 5; i >= 0; i--) {
        const target = new Date(d)
        target.setMonth(d.getMonth() - i)
        months.push(`${String(target.getMonth() + 1).padStart(2, '0')}.${target.getFullYear()}`)
    }

    const chartData = await Promise.all(months.map(async (m) => {
        const revBase = await getTurnover(['901', '902', '903'], 'credit', m)
        const revRet  = await getTurnover(['904', '905'], 'debit', m)
        const exp = await getTurnover(['91', '94'], 'debit', m)
        return {
            period: m,
            revenue: Number(revBase.minus(revRet)),
            expenses: Number(exp)
        }
    }))

    return NextResponse.json({
      metrics: {
        revenue: Number(netRevenue),
        expenses: Number(expenses),
        profit: Number(netRevenue.minus(expenses)),
        margin: Number(margin),
        bank: Number(bank),
        cash: Number(cash),
        ar: Number(ar),
      },
      expensesByAccount: expensesByAccount.filter(e => e.amount > 0).sort((a,b) => b.amount - a.amount),
      chartData
    })
  } catch (error: any) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}

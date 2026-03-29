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
        where: { organization_id: orgId, code: { not: '0000' } },
        orderBy: { code: 'asc' }
    })

    // Parse period (Format: MM.YYYY) to get date range
    const [month, year] = period.split('.').map(Number)
    const startDate = new Date(year, month - 1, 1)
    const endDate = new Date(year, month, 0, 23, 59, 59)

    const osv = await Promise.all(accounts.map(async (acc) => {
        // 1. Initial Balance (S1) - sum of everything BEFORE the current period
        const s1_dr = await prisma.transaction.aggregate({
            _sum: { amount: true },
            where: { organization_id: orgId, debit_id: acc.id, date: { lt: startDate }, is_deleted: false }
        })
        const s1_cr = await prisma.transaction.aggregate({
            _sum: { amount: true },
            where: { organization_id: orgId, credit_id: acc.id, date: { lt: startDate }, is_deleted: false }
        })

        const s1_debit = s1_dr._sum.amount || new Decimal(0)
        const s1_credit = s1_cr._sum.amount || new Decimal(0)

        // Calculate S1 balance based on account type
        let balanceStartDebit = new Decimal(0)
        let balanceStartCredit = new Decimal(0)
        if (acc.type === 'ACTIVE') {
            const net = s1_debit.minus(s1_credit)
            balanceStartDebit = net.isPositive() ? net : new Decimal(0)
        } else if (acc.type === 'PASSIVE') {
            const net = s1_credit.minus(s1_debit)
            balanceStartCredit = net.isPositive() ? net : new Decimal(0)
        } else { // ACTIVE_PASSIVE
            const net = s1_debit.minus(s1_credit)
            if (net.isPositive()) balanceStartDebit = net
            else balanceStartCredit = net.abs()
        }

        // 2. Turnovers
        const dr = await prisma.transaction.aggregate({
            _sum: { amount: true },
            where: { organization_id: orgId, date: { gte: startDate, lte: endDate }, debit_id: acc.id, is_deleted: false }
        })
        const cr = await prisma.transaction.aggregate({
            _sum: { amount: true },
            where: { organization_id: orgId, date: { gte: startDate, lte: endDate }, credit_id: acc.id, is_deleted: false }
        })

        const debitTurnover = dr._sum.amount || new Decimal(0)
        const creditTurnover = cr._sum.amount || new Decimal(0)

        // 3. Closing Balance (S2)
        const totalDebit = s1_debit.plus(debitTurnover)
        const totalCredit = s1_credit.plus(creditTurnover)

        let balanceEndDebit = new Decimal(0)
        let balanceEndCredit = new Decimal(0)
        if (acc.type === 'ACTIVE') {
            const net = totalDebit.minus(totalCredit)
            balanceEndDebit = net.isPositive() ? net : new Decimal(0)
        } else if (acc.type === 'PASSIVE') {
            const net = totalCredit.minus(totalDebit)
            balanceEndCredit = net.isPositive() ? net : new Decimal(0)
        } else { // ACTIVE_PASSIVE
            const net = totalDebit.minus(totalCredit)
            if (net.isPositive()) balanceEndDebit = net
            else balanceEndCredit = net.abs()
        }

        return {
            code: acc.code,
            name: acc.name,
            type: acc.type,
            balanceStartDebit: Number(balanceStartDebit),
            balanceStartCredit: Number(balanceStartCredit),
            debitTurnover: Number(debitTurnover),
            creditTurnover: Number(creditTurnover),
            balanceEndDebit: Number(balanceEndDebit),
            balanceEndCredit: Number(balanceEndCredit)
        }
    }))

    return NextResponse.json(osv)
  } catch (error: any) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}

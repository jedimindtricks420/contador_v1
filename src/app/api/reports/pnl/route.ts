import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getActiveOrganizationId } from '@/lib/context'
import Decimal from 'decimal.js'

export async function GET(request: Request) {
  try {
    const orgId = await getActiveOrganizationId();
    const { searchParams } = new URL(request.url)

    // Фильтр по году (формат: YYYY). Если не указан — текущий год.
    const yearParam = searchParams.get('year')
    const year = yearParam ? parseInt(yearParam) : new Date().getFullYear()

    const startDate = new Date(year, 0, 1)           // 01.01.year 00:00:00
    const endDate   = new Date(year, 11, 31, 23, 59, 59, 999) // 31.12.year 23:59:59

    // Дополнительный фильтр по месяцу (формат: MM.YYYY)
    const periodParam = searchParams.get('period')
    let filterStart = startDate
    let filterEnd   = endDate

    if (periodParam) {
      const [mon, yr] = periodParam.split('.').map(Number)
      if (!isNaN(mon) && !isNaN(yr)) {
        filterStart = new Date(yr, mon - 1, 1)
        filterEnd   = new Date(yr, mon, 0, 23, 59, 59, 999)
      }
    }

    const accounts = await prisma.account.findMany({
        where: {
          organization_id: orgId,
          code: { not: '0000' },
          type: { not: 'OFF_BALANCE' },
        },
    })

    // Расходы по конкретному счёту: Дт оборот - Кт оборот (без abs!)
    const getExpenseTurnover = async (code: string): Promise<Decimal> => {
        const acc = accounts.find(a => a.code === code)
        if (!acc) return new Decimal(0)

        const dr = await prisma.transaction.aggregate({
            _sum: { amount: true },
            where: {
              organization_id: orgId,
              debit_id: acc.id,
              is_deleted: false,
              date: { gte: filterStart, lte: filterEnd }
            }
        })
        const cr = await prisma.transaction.aggregate({
            _sum: { amount: true },
            where: {
              organization_id: orgId,
              credit_id: acc.id,
              is_deleted: false,
              date: { gte: filterStart, lte: filterEnd }
            }
        })

        const debit  = dr._sum.amount || new Decimal(0)
        const credit = cr._sum.amount || new Decimal(0)

        // Для расходных счетов: дебет больше кредита = расход
        // Если кредит больше (сторнирование) — возвращаем отрицательное значение (уменьшает расходы)
        return debit.minus(credit)
    }

    // Функция для получения чистого оборота группы счетов за период
    const getGroupTurnover = async (prefixes: string[], side: 'debit' | 'credit'): Promise<Decimal> => {
        const targetAccounts = accounts.filter(acc =>
            prefixes.some(pref => acc.code.startsWith(pref))
        )
        if (targetAccounts.length === 0) return new Decimal(0)

        const ids = targetAccounts.map(a => a.id)

        const dr = await prisma.transaction.aggregate({
            _sum: { amount: true },
            where: {
              organization_id: orgId,
              debit_id: { in: ids },
              is_deleted: false,
              date: { gte: filterStart, lte: filterEnd }
            }
        })
        const cr = await prisma.transaction.aggregate({
            _sum: { amount: true },
            where: {
              organization_id: orgId,
              credit_id: { in: ids },
              is_deleted: false,
              date: { gte: filterStart, lte: filterEnd }
            }
        })

        const totalDr = dr._sum.amount || new Decimal(0)
        const totalCr = cr._sum.amount || new Decimal(0)

        return side === 'debit' ? totalDr.minus(totalCr) : totalCr.minus(totalDr)
    }

    // 1. Выручка (9010, 9020, 9030) минус возвраты и скидки (9040, 9050)
    const revenue = await getGroupTurnover(['901', '902', '903'], 'credit')
    const salesReturns = await getGroupTurnover(['904', '905'], 'debit')
    const netRevenue = revenue.minus(salesReturns)

    // 2. Себестоимость (91**)
    const costOfSales = await getGroupTurnover(['91'], 'debit')

    // 3. Расходы периода (94**)
    const marketing = await getGroupTurnover(['941'], 'debit')
    const admin = await getGroupTurnover(['942'], 'debit')
    const otherOperExpenses = await getGroupTurnover(['943'], 'debit')
    const periodExpenses = marketing.plus(admin).plus(otherOperExpenses)

    // 4. Прочие доходы и расходы (93**, 95**, 96**)
    const otherIncome = await getGroupTurnover(['93', '95'], 'credit')
    const otherExpenses = await getGroupTurnover(['96'], 'debit')

    const netProfit = netRevenue.minus(costOfSales).minus(periodExpenses).plus(otherIncome).minus(otherExpenses)

    const expenseMap = {
        costOfSales: costOfSales,
        marketing: marketing,
        admin: admin,
        otherOper: otherOperExpenses,
        otherFin: otherExpenses,
    }

    const totalExpenses = costOfSales.plus(periodExpenses).plus(otherExpenses)

    return NextResponse.json({
        year,
        period: periodParam || null,
        filterStart: filterStart.toISOString(),
        filterEnd:   filterEnd.toISOString(),
        revenue:  Number(netRevenue),
        expenses: {
            ...Object.fromEntries(Object.entries(expenseMap).map(([k, v]) => [k, Number(v)])),
            total: Number(totalExpenses)
        },
        netProfit: Number(netProfit)
    })
  } catch (error: any) {
    console.error('[P&L Report Error]', error)
    return NextResponse.json({ error: error.message || 'Unauthorized' }, { status: 401 })
  }
}

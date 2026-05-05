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

    // Выручка: кредитовый оборот счёта 9010 за период
    const revenueRes = await prisma.transaction.aggregate({
        _sum: { amount: true },
        where: {
          organization_id: orgId,
          credit: { code: '9010' },
          is_deleted: false,
          date: { gte: filterStart, lte: filterEnd }
        }
    })
    const revenue = revenueRes._sum.amount || new Decimal(0)

    const expenseMap = {
        marketing: await getExpenseTurnover('9410'),
        admin:     await getExpenseTurnover('9420'),
        other:     await getExpenseTurnover('9430'),
        insurance: await getExpenseTurnover('9440'),
        misc:      await getExpenseTurnover('9450'),
    }

    const totalExpenses = Object.values(expenseMap).reduce((a, b) => a.plus(b), new Decimal(0))
    const netProfit = revenue.minus(totalExpenses)

    return NextResponse.json({
        year,
        period: periodParam || null,
        filterStart: filterStart.toISOString(),
        filterEnd:   filterEnd.toISOString(),
        revenue:  Number(revenue),
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

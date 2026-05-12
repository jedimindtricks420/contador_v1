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
        where: {
          organization_id: orgId,
          code: { not: '0000' },
          // Забалансовые счета не включаются в ОСВ основного учёта
          type: { not: 'OFF_BALANCE' },
        },
        orderBy: { code: 'asc' }
    })

    // Parse period (Format: MM.YYYY) to get date range
    const [month, year] = period.split('.').map(Number)
    const startDate = new Date(year, month - 1, 1)
    const endDate = new Date(year, month, 0, 23, 59, 59, 999)

    // Вспомогательная функция: определить сторону сальдо по типу счёта
    // ACTIVE, CONTRA_PASSIVE → сальдо дебетовое (Дт - Кт)
    // PASSIVE, CONTRA_ACTIVE → сальдо кредитовое (Кт - Дт)
    // ACTIVE_PASSIVE, TRANSIT → определяется знаком (куда net > 0)
    function calcBalance(
      totalDebit: Decimal,
      totalCredit: Decimal,
      type: string
    ): { balanceDebit: Decimal; balanceCredit: Decimal } {
      const isActiveNature = type === 'ACTIVE' || type === 'CONTRA_PASSIVE'
      const isPassiveNature = type === 'PASSIVE' || type === 'CONTRA_ACTIVE'

      if (isActiveNature) {
        const net = totalDebit.minus(totalCredit)
        return {
          balanceDebit: net.isPositive() ? net : new Decimal(0),
          balanceCredit: new Decimal(0),
        }
      } else if (isPassiveNature) {
        const net = totalCredit.minus(totalDebit)
        return {
          balanceDebit: new Decimal(0),
          balanceCredit: net.isPositive() ? net : new Decimal(0),
        }
      } else {
        // ACTIVE_PASSIVE, TRANSIT — сальдо определяется знаком оборота
        const net = totalDebit.minus(totalCredit)
        if (net.isPositive()) {
          return { balanceDebit: net, balanceCredit: new Decimal(0) }
        } else if (net.isNegative()) {
          return { balanceDebit: new Decimal(0), balanceCredit: net.abs() }
        }
        return { balanceDebit: new Decimal(0), balanceCredit: new Decimal(0) }
      }
    }

    const osv = await Promise.all(accounts.map(async (acc) => {
        // 1. Суммы ДО начала периода (для начального сальдо S1)
        const s1_dr = await prisma.transaction.aggregate({
            _sum: { amount: true },
            where: { organization_id: orgId, debit_id: acc.id, date: { lt: startDate }, is_deleted: false }
        })
        const s1_cr = await prisma.transaction.aggregate({
            _sum: { amount: true },
            where: { organization_id: orgId, credit_id: acc.id, date: { lt: startDate }, is_deleted: false }
        })

        const s1TotalDebit = s1_dr._sum.amount || new Decimal(0)
        const s1TotalCredit = s1_cr._sum.amount || new Decimal(0)

        // Начальное сальдо (S1)
        let { balanceDebit: balanceStartDebit, balanceCredit: balanceStartCredit } =
          calcBalance(s1TotalDebit, s1TotalCredit, acc.type)

        // Исправление: Счета 90-99 (доходы и расходы) всегда закрываются ежемесячно.
        // Поэтому их сальдо на начало месяца всегда должно быть равно 0 в ОСВ.
        if (acc.code.startsWith('9')) {
          balanceStartDebit = new Decimal(0)
          balanceStartCredit = new Decimal(0)
        }

        // 2. Обороты за период
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

        // 3. Конечное сальдо (S2) = все обороты от начала учёта до конца периода
        const s2TotalDebit = s1TotalDebit.plus(debitTurnover)
        const s2TotalCredit = s1TotalCredit.plus(creditTurnover)

        const { balanceDebit: balanceEndDebit, balanceCredit: balanceEndCredit } =
          calcBalance(s2TotalDebit, s2TotalCredit, acc.type)

        return {
            code: acc.code,
            name: acc.name,
            type: acc.type,
            // Начальное сальдо
            balanceStartDebit: Number(balanceStartDebit),
            balanceStartCredit: Number(balanceStartCredit),
            // Обороты
            debitTurnover: Number(debitTurnover),
            creditTurnover: Number(creditTurnover),
            // Конечное сальдо
            balanceEndDebit: Number(balanceEndDebit),
            balanceEndCredit: Number(balanceEndCredit),
        }
    }))

    // Фильтруем строки без движения (нет ни сальдо, ни оборотов)
    const nonEmpty = osv.filter(row =>
      row.balanceStartDebit !== 0 ||
      row.balanceStartCredit !== 0 ||
      row.debitTurnover !== 0 ||
      row.creditTurnover !== 0 ||
      row.balanceEndDebit !== 0 ||
      row.balanceEndCredit !== 0
    )

    return NextResponse.json(nonEmpty)
  } catch (error: any) {
    console.error('[OSV Report Error]', error)
    return NextResponse.json({ error: error.message || 'Unauthorized' }, { status: 401 })
  }
}

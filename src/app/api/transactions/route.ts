import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getActiveOrganizationId } from '@/lib/context'
import { z } from 'zod'
import Decimal from 'decimal.js'
import { validateTransaction } from '@/lib/accounting-logic'

const transactionSchema = z.object({
  date: z.string(),
  period: z.string(),
  description: z.string(),
  amount: z.number().positive(),
  debit_id: z.string(),
  credit_id: z.string(),
  counterparty_id: z.string().optional().nullable(),
})

export async function GET(request: Request) {
  try {
    const organizationId = await getActiveOrganizationId();
    const { searchParams } = new URL(request.url)
    const accountCode = searchParams.get('account')

    const transactions = await prisma.transaction.findMany({
      where: {
        organization_id: organizationId,
        is_deleted: false,
        ...(accountCode ? {
          OR: [
            { debit: { code: accountCode } },
            { credit: { code: accountCode } }
          ]
        } : {})
      },
      include: {
        debit: true,
        credit: true,
        counterparty: true,
      },
      orderBy: { date: 'desc' },
    })
    return NextResponse.json(transactions)
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Unauthorized' }, { status: 401 })
  }
}

export async function POST(request: Request) {
  try {
    const organizationId = await getActiveOrganizationId();
    const body = await request.json()
    const validated = transactionSchema.parse(body)

    const settings = await prisma.systemSettings.findUnique({
      where: { organization_id: organizationId }
    })

    if (settings && new Date(validated.date) <= settings.closed_period_date) {
      return NextResponse.json({ error: 'Период закрыт для редактирования' }, { status: 400 })
    }

    try {
      await validateTransaction({
        date: new Date(validated.date),
        debit_id: validated.debit_id,
        credit_id: validated.credit_id,
        organization_id: organizationId
      });
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      return await tx.transaction.create({
        data: {
          date: new Date(validated.date),
          period: validated.period,
          description: validated.description,
          amount: new Decimal(validated.amount),
          debit_id: validated.debit_id,
          credit_id: validated.credit_id,
          counterparty_id: validated.counterparty_id,
          organization_id: organizationId
        },
      })
    })

    return NextResponse.json(result)
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten().fieldErrors }, { status: 400 })
    }
    return NextResponse.json({ error: error.message || 'Unauthorized' }, { status: 401 })
  }
}

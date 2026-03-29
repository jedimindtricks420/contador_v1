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

    const getBalance = async (codes: string[]) => {
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
            
            if (acc.type === 'ACTIVE') {
                total = total.plus(debit.minus(credit))
            } else {
                total = total.plus(credit.minus(debit))
            }
        }
        return total
    }

    const assets = {
        fixed: await getBalance(['1010']),
        inventory: await getBalance(['2910']),
        receivables: await getBalance(['4010']),
        advances: await getBalance(['4310']),
        cash: await getBalance(['5110', '5010']),
        finished: await getBalance(['2810']),
    }

    const passives = {
        payables: await getBalance(['6010']),
        taxes: await getBalance(['6410']),
        social: await getBalance(['6520']),
        salary: await getBalance(['6710']),
        equity: await getBalance(['8330']),
        retained: await getBalance(['8710']),
    }

    const totalAssets = Object.values(assets).reduce((a, b) => a.plus(b), new Decimal(0))
    const totalPassives = Object.values(passives).reduce((a, b) => a.plus(b), new Decimal(0))

    return NextResponse.json({
        assets: {
            items: Object.fromEntries(Object.entries(assets).map(([k, v]) => [k, Number(v)])),
            total: Number(totalAssets)
        },
        passives: {
            items: Object.fromEntries(Object.entries(passives).map(([k, v]) => [k, Number(v)])),
            total: Number(totalPassives)
        }
    })
  } catch (error: any) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}

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

    const getBalance = async (prefixes: string[]) => {
        let total = new Decimal(0)
        
        // Find all accounts that start with the given prefixes
        const targetAccounts = accounts.filter(acc => 
            prefixes.some(pref => acc.code.startsWith(pref))
        )

        for (const acc of targetAccounts) {
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
            
            if (acc.type === 'ACTIVE' || acc.type === 'CONTRA_PASSIVE') {
                total = total.plus(debit.minus(credit))
            } else if (acc.type === 'PASSIVE' || acc.type === 'CONTRA_ACTIVE') {
                total = total.plus(credit.minus(debit))
            } else { // ACTIVE_PASSIVE
                const net = debit.minus(credit)
                // For balance sheet, active-passive accounts are treated 
                // based on their net outcome or as assets if positive.
                // Here we categorize them by their natural placement in the report.
                total = total.plus(net)
            }
        }
        return total
    }

    const assets = {
        fixed: await getBalance(['01', '02', '03', '04', '07', '08']),
        inventory: await getBalance(['10', '11', '15', '16', '20', '21', '23', '25', '26', '29']),
        receivables: await getBalance(['40', '41', '42', '45', '46', '47', '48']),
        advances: await getBalance(['43']),
        cash: await getBalance(['50', '51', '52', '55', '56', '57', '58']),
        finished: await getBalance(['28']),
    }

    const passives = {
        payables: await getBalance(['60', '61', '63', '66', '68', '69', '70', '78', '79']),
        taxes: await getBalance(['64']),
        social: await getBalance(['65']),
        salary: await getBalance(['67']),
        equity: await getBalance(['80', '81', '83', '84', '85']),
        retained: await getBalance(['87', '99']),
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

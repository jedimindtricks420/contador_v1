import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getActiveOrganizationId } from '@/lib/context'
import Decimal from 'decimal.js'

export async function GET() {
  try {
    const orgId = await getActiveOrganizationId();

    // Исключаем счёт 0000 (ввод остатков) и забалансовые счета (OFF_BALANCE)
    const accounts = await prisma.account.findMany({
        where: {
          organization_id: orgId,
          code: { not: '0000' },
          type: { not: 'OFF_BALANCE' },
        },
    })

    // Вспомогательная функция: рассчитать сумму для стороны баланса
    // по типу счёта с учётом полярности сальдо
    const getAccountBalance = async (acc: typeof accounts[0]): Promise<Decimal> => {
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

        // ACTIVE, CONTRA_PASSIVE → сальдо дебетовое
        if (acc.type === 'ACTIVE' || acc.type === 'CONTRA_PASSIVE') {
            return debit.minus(credit)
        }
        // PASSIVE, CONTRA_ACTIVE → сальдо кредитовое
        if (acc.type === 'PASSIVE' || acc.type === 'CONTRA_ACTIVE') {
            return credit.minus(debit)
        }
        // ACTIVE_PASSIVE, TRANSIT → возвращаем чистое значение (знак важен)
        // Вызывающий код сам решит, в какую сторону баланса отнести
        return debit.minus(credit)
    }

    // Группируем счета по разделам баланса по первым двум цифрам кода
    const getGroupBalance = async (prefixes: string[]): Promise<{ assets: Decimal; liabilities: Decimal }> => {
        const targetAccounts = accounts.filter(acc =>
            prefixes.some(pref => acc.code.startsWith(pref))
        )

        let assets = new Decimal(0)
        let liabilities = new Decimal(0)

        for (const acc of targetAccounts) {
            const net = await getAccountBalance(acc)

            if (acc.type === 'ACTIVE' || acc.type === 'CONTRA_PASSIVE') {
                if (net.isPositive()) {
                    assets = assets.plus(net)
                }
            } else if (acc.type === 'PASSIVE' || acc.type === 'CONTRA_ACTIVE') {
                if (net.isPositive()) {
                    liabilities = liabilities.plus(net)
                }
            } else {
                // ACTIVE_PASSIVE, TRANSIT
                if (net.isPositive()) {
                    assets = assets.plus(net)
                } else if (net.isNegative()) {
                    liabilities = liabilities.plus(net.abs())
                }
            }
        }

        return { assets, liabilities }
    }

    // === АКТИВЫ ===
    const fixed        = await getGroupBalance(['01', '02', '03', '04', '07', '08'])
    const inventory    = await getGroupBalance(['10', '11', '15', '16', '20', '21', '23', '25', '26', '29'])
    const receivables  = await getGroupBalance(['40', '41', '42', '45', '46', '47', '48'])
    const advances     = await getGroupBalance(['43', '31', '32', '33']) // + Предоплаты (31-33)
    const cash         = await getGroupBalance(['51', '52', '55', '56', '57', '58']) // Только реальные банк. счета (без 50xx транзитных)
    const finished     = await getGroupBalance(['28'])

    // === ПАССИВЫ ===
    const payables     = await getGroupBalance(['60', '61', '63', '66', '68', '69', '70', '78', '79', '88']) // + Краткосрочные кредиты банка (88)
    const taxes        = await getGroupBalance(['64'])
    const social       = await getGroupBalance(['65'])
    const salary       = await getGroupBalance(['67'])
    const equity       = await getGroupBalance(['80', '81', '83', '84', '85'])
    
    // Прибыль текущего периода (счета 90-98) + Нераспределенная прибыль прошлых лет (87, 99)
    const reGroup = await getGroupBalance(['87', '90', '91', '92', '93', '94', '95', '96', '97', '98', '99'])
    
    // Чистая прибыль = Кредит (liabilities) - Дебет (assets)
    const netRetained = reGroup.liabilities.minus(reGroup.assets)
    
    const retained = {
        assets: new Decimal(0),
        liabilities: netRetained
    }

    // Для активных групп берём assets сторону, для пассивных — liabilities
    const assetItems = {
        fixed:       fixed.assets,
        inventory:   inventory.assets,
        receivables: receivables.assets,
        advances:    advances.assets,
        cash:        cash.assets,
        finished:    finished.assets,
    }

    const passiveItems = {
        payables:  payables.liabilities,
        taxes:     taxes.liabilities,
        social:    social.liabilities,
        salary:    salary.liabilities,
        equity:    equity.liabilities,
        retained:  retained.liabilities,
    }

    // Добавляем кредитовые остатки ACTIVE_PASSIVE счетов из групп активов в пассивы
    const activeSidePassives = new Decimal(0)
      .plus(fixed.liabilities)
      .plus(inventory.liabilities)
      .plus(receivables.liabilities)
      .plus(advances.liabilities)
      .plus(cash.liabilities)
      .plus(finished.liabilities)

    // Добавляем дебетовые остатки ACTIVE_PASSIVE счетов из групп пассивов в активы
    const passiveSideAssets = new Decimal(0)
      .plus(payables.assets)
      .plus(taxes.assets)
      .plus(social.assets)
      .plus(salary.assets)
      .plus(equity.assets)
      .plus(retained.assets)

    const totalAssets = Object.values(assetItems)
      .reduce((a, b) => a.plus(b), new Decimal(0))
      .plus(passiveSideAssets)

    const totalPassives = Object.values(passiveItems)
      .reduce((a, b) => a.plus(b), new Decimal(0))
      .plus(activeSidePassives)

    return NextResponse.json({
        assets: {
            items: Object.fromEntries(Object.entries(assetItems).map(([k, v]) => [k, Number(v)])),
            total: Number(totalAssets)
        },
        passives: {
            items: Object.fromEntries(Object.entries(passiveItems).map(([k, v]) => [k, Number(v)])),
            total: Number(totalPassives)
        }
    })
  } catch (error: any) {
    console.error('[Balance Report Error]', error)
    return NextResponse.json({ error: error.message || 'Unauthorized' }, { status: 401 })
  }
}

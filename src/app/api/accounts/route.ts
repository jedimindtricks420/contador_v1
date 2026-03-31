import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getActiveOrganizationId } from '@/lib/context'

// GET — returns only active accounts (for SearchableSelect in journal/transactions)
export async function GET() {
  try {
    const organizationId = await getActiveOrganizationId()

    const accounts = await prisma.account.findMany({
      where: { organization_id: organizationId, is_active: true },
      orderBy: { code: 'asc' },
    })
    return NextResponse.json(accounts)
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Unauthorized' }, { status: 401 })
  }
}

// POST — add account from MasterAccount or create custom
export async function POST(request: Request) {
  try {
    const organizationId = await getActiveOrganizationId()
    const body = await request.json()

    let accountData: any

    if (body.master_account_id) {
      // Add from MasterAccount reference
      const master = await prisma.masterAccount.findUnique({
        where: { id: body.master_account_id }
      })
      if (!master) {
        return NextResponse.json({ error: 'Счёт не найден в плане НСБУ' }, { status: 404 })
      }
      accountData = {
        code: master.code,
        name: master.name,
        type: master.type,
        organization_id: organizationId,
        master_account_id: master.id,
        is_active: true,
        is_custom: false,
      }
    } else if (body.code && body.name && body.type) {
      // Fully custom account
      accountData = {
        code: body.code,
        name: body.name,
        type: body.type,
        organization_id: organizationId,
        is_active: true,
        is_custom: true,
      }
    } else {
      return NextResponse.json(
        { error: 'Укажите master_account_id или {code, name, type}' },
        { status: 400 }
      )
    }

    const account = await prisma.account.upsert({
      where: {
        code_organization_id: {
          code: accountData.code,
          organization_id: organizationId,
        }
      },
      create: accountData,
      update: { is_active: true }, // re-activate if previously deactivated
    })

    return NextResponse.json(account)
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Ошибка сервера' }, { status: 500 })
  }
}

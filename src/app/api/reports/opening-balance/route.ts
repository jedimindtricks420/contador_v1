import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getActiveOrganizationId } from '@/lib/context'
import { getOpeningBalanceStatus } from '@/lib/accounting-logic'

export async function GET() {
  try {
    const orgId = await getActiveOrganizationId();
    const status = await getOpeningBalanceStatus(orgId);
    
    // Also get settings to know if it is fixed
    const settings = await prisma.systemSettings.findUnique({
      where: { organization_id: orgId }
    });

    return NextResponse.json({
      debit: Number(status.debit),
      credit: Number(status.credit),
      difference: Number(status.difference),
      isFixed: settings?.is_initial_balance_fixed || false,
      openingDate: settings?.opening_balance_date
    })
  } catch (error: any) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}

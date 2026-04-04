import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getActiveOrganizationId } from '@/lib/context'

export async function GET() {
  try {
    const orgId = await getActiveOrganizationId();
    
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [subscription, usageCount] = await Promise.all([
      prisma.subscription.findUnique({
        where: { organization_id: orgId }
      }),
      prisma.aiUsage.count({
        where: {
          organization_id: orgId,
          created_at: { gte: startOfMonth }
        }
      })
    ]);

    return NextResponse.json({
      subscription,
      usageCount,
      limit: subscription?.plan === 'PRO' ? 300 : subscription?.plan === 'MYAPI' ? Infinity : 10
    });
  } catch (error: any) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}

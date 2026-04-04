import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getUser } from '@/lib/context'

export async function POST(request: Request) {
  try {
    const { id: userId } = await getUser()
    const { name, inn } = await request.json()

    // 1. Проверка лимитов на количество организаций (FREE = 1)
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        organizations: {
          include: { subscription: true }
        }
      }
    })

    const hasFreePlan = user?.organizations.some(o => o.subscription?.plan === 'FREE') || user?.organizations.length === 0;
    
    if (hasFreePlan && user?.organizations.length! >= 1) {
      return NextResponse.json({ 
        error: 'Достигнут лимит: Бесплатный тариф позволяет создать только одну организацию. Для управления несколькими компаниями обновите подписку до PRO.'
      }, { status: 403 })
    }

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Название организации обязательно' }, { status: 400 })
    }

    const org = await prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: {
          name: name.trim(),
          inn: inn?.trim() || null,
          user_id: userId,
          onboarding_state: 'IN_PROGRESS',
          onboarding_step: 2,
          // Автоматически создаём FREE подписку при регистрации организации
          subscription: {
            create: {
              plan: 'FREE'
            }
          }
        }
      })

      await tx.systemSettings.create({
        data: {
          organization_id: organization.id,
          opening_balance_date: new Date('2025-01-01'),
          closed_period_date: new Date('2024-12-31'),
          is_initial_balance_fixed: false,
        }
      })

      await tx.user.update({
        where: { id: userId },
        data: { active_org_id: organization.id }
      })

      return organization
    })

    return NextResponse.json({ success: true, org_id: org.id })
  } catch (error: any) {
    console.error('Onboarding org error:', error)
    return NextResponse.json({ error: error.message || 'Ошибка сервера' }, { status: 500 })
  }
}

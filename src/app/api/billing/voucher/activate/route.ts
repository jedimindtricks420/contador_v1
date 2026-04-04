import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getActiveOrganizationId } from "@/lib/context";

export async function POST(req: Request) {
  try {
    const organizationId = await getActiveOrganizationId();
    const { code } = await req.json();

    if (!code?.trim()) {
      return NextResponse.json({ error: "Код ваучера не указан" }, { status: 400 });
    }

    const voucher = await prisma.voucher.findUnique({
      where: { code: code.trim().toUpperCase() }
    });

    if (!voucher) {
      return NextResponse.json({ error: "Ваучер не найден" }, { status: 404 });
    }

    if (voucher.is_used) {
      return NextResponse.json({ error: "Ваучер уже был использован" }, { status: 409 });
    }

    // Получаем текущую подписку для корректного продления
    const subscription = await prisma.subscription.findUnique({
      where: { organization_id: organizationId }
    });

    // Считаем дату окончания: плюсуем дни от текущей даты или от существующей valid_until
    const baseDate =
      subscription?.plan === "PRO" &&
      subscription.valid_until &&
      subscription.valid_until > new Date()
        ? subscription.valid_until  // Продлеваем к текущей дате окончания
        : new Date();               // Начинаем с сегодня

    const newValidUntil = new Date(baseDate);
    newValidUntil.setDate(newValidUntil.getDate() + voucher.days_granted);

    // Транзакция: пометить ваучер использованным + обновить подписку
    await prisma.$transaction([
      prisma.voucher.update({
        where: { id: voucher.id },
        data: {
          is_used: true,
          used_by_org_id: organizationId,
          activated_at: new Date()
        }
      }),
      prisma.subscription.upsert({
        where: { organization_id: organizationId },
        update: { plan: "PRO", valid_until: newValidUntil },
        create: {
          organization_id: organizationId,
          plan: "PRO",
          valid_until: newValidUntil
        }
      }),
      prisma.payment.create({
        data: {
          organization_id: organizationId,
          amount: 0,
          provider: "VOUCHER",
          external_id: voucher.code,
          status: "SUCCESS"
        }
      })
    ]);

    return NextResponse.json({
      success: true,
      plan: "PRO",
      valid_until: newValidUntil,
      days_granted: voucher.days_granted
    });
  } catch (error: any) {
    console.error("VOUCHER ACTIVATE ERROR:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

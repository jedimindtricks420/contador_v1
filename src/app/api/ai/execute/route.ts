import prisma from "@/lib/prisma";
import { getActiveOrganizationId } from "@/lib/context";
import { NextResponse } from "next/server";
import Decimal from "decimal.js";
import { validateTransaction } from "@/lib/accounting-logic";

export async function POST(req: Request) {
  try {
    const organizationId = await getActiveOrganizationId();
    const { data, transactions } = await req.json();

    // Поддержка обоих форматов: одна транзакция (data) или массив (transactions)
    const txList = transactions || (data ? [data] : []);

    if (!txList.length) {
      return NextResponse.json({ error: "Нет данных для записи" }, { status: 400 });
    }

    // ── BUG-2: Проверка суммы > 0 ──────────────────────────────────────
    for (const item of txList) {
      const amount = Number(item.amount);
      if (!item.amount || isNaN(amount) || amount <= 0) {
        return NextResponse.json({
          error: `Сумма должна быть больше нуля. Получено: ${item.amount} для операции "${item.description}". Уточните сумму и попробуйте снова.`
        }, { status: 400 });
      }
    }

    const results = await prisma.$transaction(async (tx) => {
      const getOrCreateAccount = async (accInfo: any) => {
        if (accInfo.is_missing) {
          const master = await tx.masterAccount.findFirst({ where: { code: accInfo.code } });
          if (!master) throw new Error(`Счет ${accInfo.code} не найден в НСБУ`);
          
          if (master.type === 'OFF_BALANCE') {
            throw new Error(
              `Счёт ${accInfo.code} (${master.name}) — забалансовый. ` +
              `Забалансовые счета не используются в двойных проводках. ` +
              `Для учёта используйте только запись по дебету (без кредита) вручную в журнале.`
            );
          }

          return await tx.account.upsert({
            where: { code_organization_id: { code: master.code, organization_id: organizationId } },
            create: { code: master.code, name: master.name, type: master.type, organization_id: organizationId, master_account_id: master.id, is_active: true },
            update: { is_active: true }
          });
        }
        
        const existing = await tx.account.findUnique({
          where: { code_organization_id: { code: accInfo.code, organization_id: organizationId } }
        });
        
        if (!existing) throw new Error(`Счет ${accInfo.code} не активирован для вашей компании.`);
        
        if (existing.type === 'OFF_BALANCE') {
          throw new Error(
            `Счёт ${existing.code} (${existing.name}) — забалансовый. ` +
            `Забалансовые счета не используются в двойных проводках.`
          );
        }

        return existing;
      };

      const created = [];
      for (const item of txList) {
        const dateObj = new Date(item.date);
        // Период: берём из item.period если передан и соответствует дате, иначе вычисляем
        const computedPeriod = `${(dateObj.getMonth() + 1).toString().padStart(2, "0")}.${dateObj.getFullYear()}`;
        const period = item.period || computedPeriod;

        // BUG-10: Логируем несоответствие period если AI передал нечто иное
        if (item.period && item.period !== computedPeriod) {
          console.warn(`[AI Execute] Period mismatch: AI sent "${item.period}", computed "${computedPeriod}" from date "${item.date}". Using computed.`);
        }

        const debitAcc  = await getOrCreateAccount(item.debit);
        const creditAcc = await getOrCreateAccount(item.credit);

        // ── BUG-3: Проверка что дебет ≠ кредит ──────────────────────────
        if (debitAcc.id === creditAcc.id) {
          throw new Error(
            `Ошибка: дебет и кредит указывают на один счёт (${debitAcc.code} — ${debitAcc.name}). ` +
            `Проводка не имеет бухгалтерского смысла.`
          );
        }

        // ── BUG-1: Полная валидация как при ручном вводе ─────────────────
        await validateTransaction({
          date: dateObj,
          debit_id: debitAcc.id,
          credit_id: creditAcc.id,
          organization_id: organizationId
        });

        const transaction = await tx.transaction.create({
          data: {
            date: dateObj,
            period: computedPeriod, // Всегда используем вычисленный период (из даты)
            description: `(AI) ${item.description}`,
            amount: new Decimal(item.amount),
            debit_id: debitAcc.id,
            credit_id: creditAcc.id,
            organization_id: organizationId
          }
        });

        await tx.auditLog.create({
          data: {
            organization_id: organizationId,
            user_id: "system-ai",
            action: "AI_TRANSACTION_AUTO_CREATE",
            entity_type: "Transaction",
            entity_id: transaction.id,
            payload: {
              ...item,
              computed_period: computedPeriod,
              period_mismatch: item.period && item.period !== computedPeriod
            }
          }
        });

        created.push(transaction);
      }

      return created;
    });

    return NextResponse.json({ success: true, count: results.length, transactions: results });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
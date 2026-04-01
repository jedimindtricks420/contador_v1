import prisma from "@/lib/prisma";
import { getActiveOrganizationId } from "@/lib/context";
import { NextResponse } from "next/server";
import Decimal from "decimal.js";

export async function POST(req: Request) {
  try {
    const organizationId = await getActiveOrganizationId();
    const { data } = await req.json(); 

    const dateObj = new Date(data.date);
    // Робастный расчет периода MM.YYYY в бэкенде
    const period = `${(dateObj.getMonth() + 1).toString().padStart(2, "0")}.${dateObj.getFullYear()}`;

    const result = await prisma.$transaction(async (tx) => {
      const getOrCreateAccount = async (accInfo: any) => {
        if (accInfo.is_missing) {
          const master = await tx.masterAccount.findFirst({ where: { code: accInfo.code } });
          if (!master) throw new Error(`Счет ${accInfo.code} не найден в НСБУ`);
          
          return await tx.account.upsert({
            where: { code_organization_id: { code: master.code, organization_id: organizationId } },
            create: {
              code: master.code,
              name: master.name,
              type: master.type,
              organization_id: organizationId,
              master_account_id: master.id,
              is_active: true
            },
            update: { is_active: true }
          });
        }
        
        const existing = await tx.account.findUnique({
          where: { code_organization_id: { code: accInfo.code, organization_id: organizationId } }
        });
        
        if (!existing) {
          throw new Error(`Счет ${accInfo.code} не активирован для вашей компании.`);
        }
        
        return existing;
      };

      const debitAcc = await getOrCreateAccount(data.debit);
      const creditAcc = await getOrCreateAccount(data.credit);

      // Создание транзакции
      const transaction = await tx.transaction.create({
        data: {
          date: dateObj,
          period, 
          description: `(AI) ${data.description}`,
          amount: new Decimal(data.amount),
          debit_id: debitAcc.id,
          credit_id: creditAcc.id,
          organization_id: organizationId
        }
      });

      // Запись в AuditLog
      await tx.auditLog.create({
        data: {
          organization_id: organizationId,
          user_id: "system-ai", 
          action: "AI_TRANSACTION_AUTO_CREATE",
          entity_type: "Transaction",
          entity_id: transaction.id,
          payload: data
        }
      });

      return transaction;
    });

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
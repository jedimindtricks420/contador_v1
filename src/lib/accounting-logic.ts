import prisma from './prisma';
import Decimal from 'decimal.js';

export async function getOpeningBalanceStatus(organizationId: string) {
  const account0000 = await prisma.account.findFirst({
    where: { organization_id: organizationId, code: '0000' }
  });

  if (!account0000) {
    return { debit: new Decimal(0), credit: new Decimal(0), difference: new Decimal(0) };
  }

  const dr = await prisma.transaction.aggregate({
    _sum: { amount: true },
    where: { organization_id: organizationId, debit_id: account0000.id, is_deleted: false }
  });

  const cr = await prisma.transaction.aggregate({
    _sum: { amount: true },
    where: { organization_id: organizationId, credit_id: account0000.id, is_deleted: false }
  });

  const debit = dr._sum.amount || new Decimal(0);
  const credit = cr._sum.amount || new Decimal(0);

  return {
    debit,
    credit,
    difference: debit.minus(credit)
  };
}

export async function validateTransaction(
  data: { date: Date; debit_id: string; credit_id: string; organization_id: string }
) {
  const settings = await prisma.systemSettings.findUnique({
    where: { organization_id: data.organization_id }
  });

  const [debitAcc, creditAcc] = await Promise.all([
    prisma.account.findUnique({ where: { id: data.debit_id } }),
    prisma.account.findUnique({ where: { id: data.credit_id } })
  ]);

  const isDebit0000 = debitAcc?.code === '0000';
  const isCredit0000 = creditAcc?.code === '0000';

  // 1. Block 0000 vs 0000
  if (isDebit0000 && isCredit0000) {
    throw new Error('Проводка между счетами 0000 и 0000 запрещена');
  }

  // 2. Strict Date for 0000
  if (isDebit0000 || isCredit0000) {
    if (!settings?.opening_balance_date) {
      throw new Error('Дата начала учета не установлена');
    }

    const txDateObj = new Date(data.date);
    const openingDateObj = new Date(settings.opening_balance_date);
    
    // Сбрасываем время для честного сравнения дат
    txDateObj.setHours(0, 0, 0, 0);
    openingDateObj.setHours(0, 0, 0, 0);

    if (txDateObj > openingDateObj) {
      const openingDateStr = openingDateObj.toISOString().split('T')[0];
      throw new Error(`Счет 0000 (Ввод остатков) нельзя использовать после даты начала учета (${openingDateStr}).`);
    }

    if (settings.is_initial_balance_fixed) {
      throw new Error('Ввод начальных остатков зафиксирован и закрыт для редактирования');
    }
  }

  // 3. Block regular transactions before opening date (optional but good for consistency)
  if (!isDebit0000 && !isCredit0000 && settings?.opening_balance_date) {
    const txDateObj = new Date(data.date);
    const openingDateObj = new Date(settings.opening_balance_date);
    
    txDateObj.setHours(0, 0, 0, 0);
    openingDateObj.setHours(0, 0, 0, 0);

    // Разрешаем вводить обычные операции начиная с 1 числа месяца начала учета, 
    // но если пользователь вводит на пару дней раньше, не блокируем жестко, чтобы избежать путаницы с 31/1 числом.
    // Оставим проверку только если дата совсем старая (например, меньше на 30 дней)
    const thirtyDaysBefore = new Date(openingDateObj);
    thirtyDaysBefore.setDate(thirtyDaysBefore.getDate() - 30);

    if (txDateObj < thirtyDaysBefore) {
      throw new Error('Нельзя вводить обычные операции так далеко до даты начала учета. Для старых долгов используйте счет 0000.');
    }
  }

  return true;
}

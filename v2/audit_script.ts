import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function runAudit() {
  console.log('=== AUDIT START ===\n');

  // 1.1 План счетов
  const accountCount = await prisma.account.count();
  // MASTER_COA has 267 entries: 39 CORE + 183 EXTENSION + 45 INDUSTRY (comment "214" refers to official НСБУ plan)
  console.log(`1.1.1 Account count: ${accountCount} (MASTER_COA size: 267)`);

  const acc6010 = await prisma.account.findUnique({ where: { code: '6010' } });
  console.log(`1.1.2 Account 6010 type: ${acc6010?.type} (Expected: ACTIVE_PASSIVE)`);

  const acc6310 = await prisma.account.findUnique({ where: { code: '6310' } });
  console.log(`1.1.3 Account 6310 exists: ${!!acc6310}`);

  const acc9210 = await prisma.account.findUnique({ where: { code: '9210' } });
  console.log(`1.1.4 Account 9210 (Выбытие ОС) exists: ${!!acc9210}`);

  const acc9610 = await prisma.account.findUnique({ where: { code: '9610' } });
  console.log(`1.1.5 Account 9610 (Расходы по процентам) exists: ${!!acc9610}`);

  // 1.2 Каталог типов документов
  const docTypes = await prisma.documentType.findMany();
  console.log(`\n1.2.1 DocumentTypes total: ${docTypes.length}`);

  const modes = new Set(docTypes.map(d => d.mode));
  console.log(`1.2.2 Used modes: ${Array.from(modes).join(', ')}`);

  // Накопительный метод — ключевые типы
  const accrualTypes = [
    'ADVANCE_RECEIVED', 'INVOICE_CONFIRMED', 'INVOICE_CONFIRMED_PREPAID',
    'GOODS_RECEIVED', 'GOODS_RECEIVED_PREPAID',
    'SERVICE_RECEIVED', 'SERVICE_RECEIVED_PREPAID',
    'REVENUE_COLLECTION',
  ];
  console.log('\n--- Накопительный метод ---');
  for (const t of accrualTypes) {
    const dt = docTypes.find(d => d.code === t);
    const tmpl = dt?.postingTemplate as any;
    console.log(`1.3 ${t}: ${dt ? 'OK' : 'MISSING'} | mode: ${dt?.mode ?? '-'} | lines: ${tmpl?.lines?.length ?? 0}`);
  }

  // ОС
  const assetTypes = ['FIXED_ASSET_PURCHASE', 'FIXED_ASSET_DISPOSAL', 'FIXED_ASSET_SALE'];
  console.log('\n--- Основные средства ---');
  for (const t of assetTypes) {
    const dt = docTypes.find(d => d.code === t);
    const tmpl = dt?.postingTemplate as any;
    console.log(`1.4 ${t}: ${dt ? 'OK' : 'MISSING'} | lines: ${tmpl?.lines?.length ?? 0}`);
    if (t === 'FIXED_ASSET_DISPOSAL' && dt) {
      console.log(`    template: ${JSON.stringify(tmpl?.lines)}`);
    }
  }

  // Новые расходные типы
  const newExpenseTypes = [
    'INTEREST_PAYMENT', 'DIVIDEND_PAYMENT', 'FINE_PENALTY',
    'INSURANCE_PAYMENT', 'UTILITY_PAYMENT', 'SUBSCRIPTION', 'CUSTOMS_DUTY',
  ];
  console.log('\n--- Новые расходные типы ---');
  for (const t of newExpenseTypes) {
    const dt = docTypes.find(d => d.code === t);
    console.log(`1.5 ${t}: ${dt ? 'OK' : 'MISSING'}`);
  }

  // Маркетплейс — проверяем что MARKETPLACE_INCOME теперь идёт через 6310
  const mpType = docTypes.find(d => d.code === 'MARKETPLACE_INCOME');
  const mpTmpl = mpType?.postingTemplate as any;
  const mpCredit = mpTmpl?.lines?.find((l: any) => l.side === 'credit')?.accountCode;
  console.log(`\n1.6 MARKETPLACE_INCOME credit account: ${mpCredit} (Expected: 6310)`);
  console.log(`    opensItem: ${mpTmpl?.opensItem} (Expected: true)`);

  // Поставщики — проверяем что закрывают 6010
  const suppTypes = ['SUPPLIER_PAYMENT_GOODS', 'SUPPLIER_PAYMENT_SERVICES', 'SUPPLIER_PAYMENT_OTHER'];
  console.log('\n--- Оплаты поставщикам (должны дебетовать 6010) ---');
  for (const t of suppTypes) {
    const dt = docTypes.find(d => d.code === t);
    const tmpl = dt?.postingTemplate as any;
    const debitAcc = tmpl?.lines?.find((l: any) => l.side === 'debit')?.accountCode;
    console.log(`1.7 ${t} debit: ${debitAcc} (Expected: 6010)`);
  }

  // 1.8 Итоги
  const bankAutoCount = docTypes.filter(d => d.mode === 'BANK_AUTO').length;
  const manualCount = docTypes.filter(d => d.mode === 'MANUAL_ONLY').length;
  const hybridCount = docTypes.filter(d => d.mode === 'HYBRID').length;
  console.log(`\n1.8 Modes breakdown: BANK_AUTO=${bankAutoCount}, MANUAL_ONLY=${manualCount}, HYBRID=${hybridCount}`);

  console.log('\n=== AUDIT END ===');
}

runAudit().catch(console.error).finally(() => prisma.$disconnect());

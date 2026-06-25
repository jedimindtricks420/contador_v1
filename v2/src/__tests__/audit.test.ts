import { expect, test } from 'vitest';
import prisma from '@/lib/prisma';
import fs from 'fs';

test('Audit Check', async () => {
  let output = '=== AUDIT START ===\n\n';

  // 1.1
  const accountCount = await prisma.account.count();
  output += `1.1.1 Account count: ${accountCount} (Expected: 214)\n`;
  const acc6010 = await prisma.account.findUnique({ where: { code: '6010' } });
  output += `1.1.2 Account 6010 type: ${acc6010?.type} (Expected: ACTIVE_PASSIVE)\n`;

  // 1.2
  const docTypes = await prisma.documentType.findMany();
  output += `\n1.2.1 DocumentTypes total: ${docTypes.length}\n`;
  const modes = new Set(docTypes.map(d => d.mode));
  output += `1.2.2 Used modes: ${Array.from(modes).join(', ')}\n`;

  const expectedTypes = ['GOODS_RECEIVED', 'SERVICE_RECEIVED', 'FIXED_ASSET_DISPOSAL', 'SUPPLIER_PAYMENT_GOODS', 'SUPPLIER_PAYMENT_SERVICES', 'SUPPLIER_PAYMENT_OTHER'];
  for (const t of expectedTypes) {
    const dt = docTypes.find(d => d.code === t);
    output += `1.2.3 Found ${t}: ${!!dt}\n`;
    if (t === 'FIXED_ASSET_DISPOSAL' && dt) {
        output += `1.2.4 FIXED_ASSET_DISPOSAL template: ${JSON.stringify(dt.postingTemplate)}\n`;
    }
    if (t.startsWith('SUPPLIER_PAYMENT') && dt) {
        output += `1.2.5 ${t} template: ${JSON.stringify(dt.postingTemplate)}\n`;
    }
  }

  // 1.3
  const acc6310 = await prisma.account.findUnique({ where: { code: '6310' } });
  output += `\n1.3.1 Account 6310 exists: ${!!acc6310}\n`;

  output += '\n=== AUDIT END ===';
  fs.writeFileSync('/home/admin1/contador/v2/audit_results.txt', output);
  expect(true).toBe(true);
});

import { test, expect } from 'vitest';
import prisma from '@/lib/prisma';
import fs from 'fs';

test('Count Document Types', async () => {
  const all = await prisma.documentType.findMany();
  const available = all.filter(d => d.mode !== 'MANUAL_ONLY');
  
  const output = `Total: ${all.length}\nAvailable for Bank/Classifier: ${available.length}`;
  fs.writeFileSync('/home/admin1/contador/v2/doc_count.txt', output);
  
  await prisma.$disconnect();
  expect(true).toBe(true);
});

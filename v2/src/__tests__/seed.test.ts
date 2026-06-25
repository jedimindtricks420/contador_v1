import { test, expect } from 'vitest';
import { ensureBaseData } from '@/lib/ensureBaseData';
import prisma from '@/lib/prisma';

test('Run ensureBaseData', async () => {
    await ensureBaseData();
    await prisma.$disconnect();
    expect(true).toBe(true);
});

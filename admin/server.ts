import express, { Request, Response, NextFunction } from "express";
import { PrismaClient } from "@prisma/client";
import { randomBytes } from "crypto";
import path from "path";

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.ADMIN_PORT || 3031;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "supersecretadmin";

app.use(express.json());

// Отдача статики (Админка UI)
app.use(express.static(path.join(__dirname, "public")));

// ─────────────────────────────────────────────
// ADMIN MIDDLEWARE — защита по паролю
// ─────────────────────────────────────────────
function adminAuth(req: Request, res: Response, next: NextFunction) {
  // Пропускаем GET на корень (интерфейс)
  if (req.method === 'GET' && req.path === '/') return next();

  const authHeader = req.headers["x-admin-password"];
  const queryPassword = req.query.admin_password as string;

  if (authHeader === ADMIN_PASSWORD || queryPassword === ADMIN_PASSWORD) {
    return next();
  }
  res.status(401).json({ error: "Unauthorized. Provide correct credentials." });
}

app.use(adminAuth);

// ─────────────────────────────────────────────
// DASHBOARD — сводная статистика
// ─────────────────────────────────────────────
app.get("/api/dashboard", async (_req: Request, res: Response) => {
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  
  const [userCount, orgCount, totalPayments, aiTransactions, avgLatency] = await Promise.all([
    prisma.user.count(),
    prisma.organization.count(),
    prisma.payment.aggregate({
      where: { status: "SUCCESS" },
      _sum: { amount: true }
    }),
    prisma.aiUsage.count(),
    (prisma.aiUsage.aggregate({
      where: { created_at: { gte: yesterday }, duration_ms: { not: null } },
      _avg: { duration_ms: true }
    }) as any)
  ]);

  res.json({
    users: userCount,
    organizations: orgCount,
    total_payments_usd: Number(totalPayments._sum.amount || 0),
    ai_transactions: aiTransactions,
    avg_latency_ms: (avgLatency as any)?._avg?.duration_ms || 0
  });
});

// МОДУЛЬ «ВОРОНКА КОНВЕРСИИ»
app.get("/api/admin/analytics/funnel", async (_req: Request, res: Response) => {
  const [totalUsers, orgUsers, activeOrgs, proSubscriptions] = await Promise.all([
    prisma.user.count(),
    prisma.organization.groupBy({ by: ['user_id'] }).then(res => res.length),
    prisma.transaction.groupBy({ 
      by: ['organization_id'],
      where: { is_deleted: false }
    }).then(res => res.length),
    prisma.subscription.count({ where: { plan: 'PRO' } })
  ]);

  res.json([
    { label: 'Регистрация', count: totalUsers },
    { label: 'Создание организации', count: orgUsers },
    { label: 'Первая проводка', count: activeOrgs },
    { label: 'Оплата PRO', count: proSubscriptions }
  ]);
});

// ─────────────────────────────────────────────
// USERS — поиск и управление подписками
// ─────────────────────────────────────────────
app.get("/api/users", async (req: Request, res: Response) => {
  const search = req.query.search as string;
  const users = await prisma.user.findMany({
    where: search
      ? { OR: [{ email: { contains: search, mode: 'insensitive' } }, { name: { contains: search, mode: 'insensitive' } }] }
      : {},
    include: {
      organizations: {
        include: { 
          subscription: true,
          transactions: { where: { is_deleted: false }, take: 1, orderBy: { createdAt: 'desc' } }
        }
      }
    },
    take: 50
  });

  // Добавляем инфо о последнем платеже для каждой организации
  const enrichedUsers = await Promise.all(users.map(async (u) => {
    const orgsWithPayments = await Promise.all(u.organizations.map(async (o) => {
      const lastPayment = await prisma.payment.findFirst({
        where: { organization_id: o.id, status: 'SUCCESS' },
        orderBy: { created_at: 'desc' }
      });
      return { ...o, lastPayment };
    }));
    return { ...u, organizations: orgsWithPayments };
  }));

  res.json(enrichedUsers);
});

// Апгрейд подписки
app.post("/api/users/:orgId/upgrade", async (req: Request, res: Response) => {
  const { orgId } = req.params;
  const { days } = req.body;
  const daysToAdd = parseInt(days) || 30;

  const sub = await prisma.subscription.findUnique({ where: { organization_id: orgId } });
  const baseDate = (sub?.plan === "PRO" && sub.valid_until && sub.valid_until > new Date())
    ? sub.valid_until
    : new Date();

  const newValidUntil = new Date(baseDate);
  newValidUntil.setDate(newValidUntil.getDate() + daysToAdd);

  const updated = await prisma.subscription.upsert({
    where: { organization_id: orgId },
    update: { plan: "PRO", valid_until: newValidUntil },
    create: { organization_id: orgId, plan: "PRO", valid_until: newValidUntil }
  });

  res.json({ success: true, subscription: updated });
});

// Сброс лимитов
app.post("/api/users/:orgId/reset-ai", async (req: Request, res: Response) => {
  const { orgId } = req.params;
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  await prisma.aiUsage.deleteMany({
    where: { organization_id: orgId, created_at: { gte: startOfMonth } }
  });

  res.json({ success: true });
});

// Смена тарифа (FREE, PRO, MYAPI)
app.patch("/api/users/:orgId/plan", async (req: Request, res: Response) => {
  const { orgId } = req.params;
  const { plan } = req.body;

  if (!["FREE", "PRO", "MYAPI"].includes(plan)) {
    return res.status(400).json({ error: "Invalid plan type" });
  }

  const updated = await prisma.subscription.upsert({
    where: { organization_id: orgId },
    update: { plan },
    create: { organization_id: orgId, plan }
  });

  res.json({ success: true, subscription: updated });
});

// Управление API ключом
app.patch("/api/users/:orgId/api-key", async (req: Request, res: Response) => {
  const { orgId } = req.params;
  const { apiKey } = req.body;

  const updated = await prisma.subscription.upsert({
    where: { organization_id: orgId },
    update: { custom_api_key: apiKey || null },
    create: { organization_id: orgId, plan: "FREE", custom_api_key: apiKey || null }
  });

  res.json({ success: true, subscription: updated });
});

// ─────────────────────────────────────────────
// AI USAGE — мониторинг расходов
// ─────────────────────────────────────────────
app.get("/api/ai-usage", async (_req: Request, res: Response) => {
  const usage = await prisma.aiUsage.groupBy({
    by: ["organization_id"],
    _sum: { tokens_input: true, tokens_output: true, cost_usd: true },
    _count: { id: true },
    orderBy: { _sum: { cost_usd: "desc" } },
    take: 50
  });

  // Дополняем названиями организаций
  const enriched = await Promise.all(usage.map(async (u) => {
    const org = await prisma.organization.findUnique({ where: { id: u.organization_id }, select: { name: true } });
    return { ...u, org_name: org?.name || "Unknown" };
  }));

  res.json(enriched);
});

// ─────────────────────────────────────────────
// PAYMENTS — список транзакций
// ─────────────────────────────────────────────
app.get("/api/payments", async (_req: Request, res: Response) => {
  const payments = await prisma.payment.findMany({
    orderBy: { created_at: "desc" },
    take: 100
  });

  const enriched = await Promise.all(payments.map(async (p) => {
    const org = await prisma.organization.findUnique({ where: { id: p.organization_id }, select: { name: true } });
    return { ...p, org_name: org?.name || "Unknown" };
  }));

  res.json(enriched);
});

// ─────────────────────────────────────────────
// VOUCHERS — генерация и управление
// ─────────────────────────────────────────────
app.get("/api/vouchers", async (_req: Request, res: Response) => {
  const vouchers = await prisma.voucher.findMany({
    orderBy: { created_at: "desc" },
    take: 100
  });
  res.json(vouchers);
});

app.post("/api/vouchers/generate", async (req: Request, res: Response) => {
  const { count = 10, days = 30 } = req.body;
  
  const vouchers = [];
  for (let i = 0; i < count; i++) {
    vouchers.push({
      code: `CONT-${randomBytes(3).toString('hex').toUpperCase()}-${randomBytes(3).toString('hex').toUpperCase()}`,
      days_granted: parseInt(days)
    });
  }

  await prisma.voucher.createMany({ data: vouchers });
  res.json({ success: true, count: vouchers.length });
});

app.listen(PORT, () => {
  console.log(`✅ Admin Portal running at http://localhost:${PORT}`);
});

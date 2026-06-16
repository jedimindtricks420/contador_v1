import express, { Request, Response, NextFunction } from "express";
import { PrismaClient } from "@prisma/client";
import { randomBytes } from "crypto";
import path from "path";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

const app = express();
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "cdn.tailwindcss.com", "unpkg.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "fonts.googleapis.com"],
      fontSrc: ["'self'", "fonts.gstatic.com"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'"]
    }
  }
})); // Configured security headers for Admin Portal

const prisma = new PrismaClient();

// ─── V2 DATABASE CLIENT ──────────────────────────────────────────────────────
// Uses the v2 Prisma client generated from the v2 schema (contador_v2 DB)
const { PrismaClient: PrismaClientV2 } = require("../v2/node_modules/.prisma/client");
const V2_DATABASE_URL = process.env.V2_DATABASE_URL || "postgresql://user:password@172.26.0.2:5432/contador_v2";
const prismaV2 = new PrismaClientV2({ datasources: { db: { url: V2_DATABASE_URL } } });
const PORT = process.env.ADMIN_PORT || 3031;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "supersecretadmin";

app.use(express.json());

// ─────────────────────────────────────────────
// PAYMENT UTILS & HELPERS
// ─────────────────────────────────────────────

const PAYME_ERRORS = {
  AUTH_ERROR: { code: -32504, message: { ru: 'Ошибка авторизации', uz: 'Avtorizatsiya xatosi', en: 'Auth error' } },
  ORDER_NOT_FOUND: { code: -31050, message: { ru: 'Заказ не найден', uz: 'Buyurtma topilmadi', en: 'Order not found' } },
  ORDER_ALREADY_PAID: { code: -31051, message: { ru: 'Заказ уже оплачен', uz: 'Buyurtma to\'landgan', en: 'Already paid' } },
  TRANSACTION_NOT_FOUND: { code: -31003, message: { ru: 'Транзакция не найдена', uz: 'Tranzaksiya topilmadi', en: 'Transaction not found' } },
  WRONG_AMOUNT: { code: -31001, message: { ru: 'Неверная сумма', uz: 'Noto\'g\'ri summa', en: 'Wrong amount' } },
  CANNOT_PERFORM: { code: -31008, message: { ru: 'Невозможно выполнить', uz: 'Bajarib bo\'lmaydi', en: 'Cannot perform' } },
  METHOD_NOT_FOUND: { code: -32601, message: { ru: 'Метод не найден', uz: 'Metod topilmadi', en: 'Method not found' } },
  SYSTEM_ERROR: { code: -32400, message: { ru: 'Системная ошибка', uz: 'Tizim xatosi', en: 'System error' } }
};

const CLICK_ERRORS = {
  SUCCESS: 0,
  SIGN_CHECK_FAILED: -1,
  WRONG_AMOUNT: -2,
  ALREADY_PAID: -4,
  USER_NOT_FOUND: -5,
  TRANSACTION_NOT_FOUND: -6,
  CANCELLED: -9
};

function checkPaymeAuth(authHeader: string | undefined, config: any) {
  if (!authHeader || !authHeader.startsWith("Basic ")) return false;
  const key = config.payme_env === "prod" ? config.payme_key : config.payme_test_key;
  if (!key) return false;
  const expected = Buffer.from(`Paycom:${key}`).toString("base64");
  return authHeader.slice(6) === expected;
}

function verifyClickSignature(p: any, type: number, secret: string) {
  const str = type === 0 
    ? `${p.click_trans_id}${p.service_id}${secret}${p.merchant_trans_id}${p.amount}${p.action}${p.sign_time}`
    : `${p.click_trans_id}${p.service_id}${secret}${p.merchant_trans_id}${p.merchant_prepare_id}${p.amount}${p.action}${p.sign_time}`;
  const mySign = crypto.createHash('md5').update(str).digest('hex');
  return mySign === p.sign_string;
}

function generatePaymeUrl(orderId: string, amountTiyin: number, config: any) {
  const merchantId = config.payme_merchant_id;
  const baseUrl = config.payme_env === "prod" ? "https://checkout.paycom.uz" : "https://test.paycom.uz";
  const params = `m=${merchantId};ac.order_id=${orderId};a=${amountTiyin}`;
  const base64 = Buffer.from(params).toString("base64");
  return `${baseUrl}/${base64}`;
}

function generateClickUrl(orderId: string, amount: number, config: any) {
  const merchantId = config.click_merchant_id;
  const serviceId = config.click_service_id;
  return `https://my.click.uz/services/pay?service_id=${serviceId}&merchant_id=${merchantId}&amount=${amount}&transaction_param=${orderId}`;
}

async function fulfillSubscription(paymentId: string, externalId: string) {
  const payment = await prisma.payment.update({
    where: { id: paymentId },
    data: {
      status: "SUCCESS",
      external_id: externalId,
      paid_at: new Date()
    }
  });

  const now = new Date();
  const validUntil = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());

  await prisma.subscription.upsert({
    where: { organization_id: payment.organization_id },
    update: { plan: "PRO", valid_until: validUntil },
    create: { organization_id: payment.organization_id, plan: "PRO", valid_until: validUntil }
  });

  console.log(`[Payment] Fulfilled PRO subscription for Org: ${payment.organization_id}`);
}

async function getPaymentConfig() {
  return await prisma.paymentConfig.findUnique({ where: { id: "default" } });
}

// ─────────────────────────────────────────────
// CLIENT & WEBHOOK API (Public)
// ─────────────────────────────────────────────

const publicRouter = express.Router();

// Rate limiting for public endpoints (50 requests per 15 minutes)
const publicLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: { error: "Too many requests from this IP, please try again after 15 minutes" }
});
// Initiate Payment
publicRouter.post("/payments/initiate", publicLimiter, async (req: Request, res: Response) => {
  const { orgId, provider } = req.body;
  if (!orgId || !["PAYME", "CLICK"].includes(provider)) {
    return res.status(400).json({ error: "Invalid orgId or provider" });
  }

  const config = await getPaymentConfig();
  if (!config) return res.status(500).json({ error: "Payment system not configured" });

  const amount = config.pro_price_yearly;
  
  const payment = await prisma.payment.create({
    data: {
      organization_id: orgId,
      amount: amount,
      amount_tiyin: BigInt(amount * 100),
      provider: provider as any,
      status: "PENDING"
    }
  });

  let url = "";
  if (provider === "PAYME") {
    url = generatePaymeUrl(payment.id, amount * 100, config);
  } else {
    url = generateClickUrl(payment.id, amount, config);
  }

  res.json({ success: true, url, paymentId: payment.id });
});

publicRouter.get("/payment-info", publicLimiter, async (_req: Request, res: Response) => {
  const config = await getPaymentConfig();
  res.json({ pro_price_yearly: config?.pro_price_yearly || 299000 });
});

// Payme Webhook
publicRouter.post("/payments/payme", publicLimiter, async (req: Request, res: Response) => {
  const { method, params, id } = req.body;
  const config = await getPaymentConfig();
  if (!checkPaymeAuth(req.headers.authorization, config)) {
    return res.json({ error: PAYME_ERRORS.AUTH_ERROR, id });
  }

  try {
    switch (method) {
      case "CheckPerformTransaction": {
        const paymentId = params.account.order_id;
        const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
        if (!payment) throw PAYME_ERRORS.ORDER_NOT_FOUND;
        if (Number(payment.amount_tiyin) !== params.amount) throw PAYME_ERRORS.WRONG_AMOUNT;
        if (payment.status === "SUCCESS") throw PAYME_ERRORS.ORDER_ALREADY_PAID;
        return res.json({ result: { allow: true }, id });
      }
      case "CreateTransaction": {
        const paymentId = params.account.order_id;
        let payment = await prisma.payment.findUnique({ where: { id: paymentId } });
        if (!payment) throw PAYME_ERRORS.ORDER_NOT_FOUND;
        if (payment.external_id && payment.external_id !== params.id) throw PAYME_ERRORS.CANNOT_PERFORM;
        if (payment.status === "SUCCESS") throw PAYME_ERRORS.ORDER_ALREADY_PAID;

        payment = await prisma.payment.update({
          where: { id: paymentId },
          data: { external_id: params.id, processing_status: "PROCESSING" }
        });
        return res.json({ result: { create_time: payment.created_at.getTime(), transaction: payment.id, state: 1 }, id });
      }
      case "PerformTransaction": {
        const payment = await prisma.payment.findFirst({ where: { external_id: params.id } });
        if (!payment) throw PAYME_ERRORS.TRANSACTION_NOT_FOUND;
        if (payment.status === "SUCCESS") {
          return res.json({ result: { transaction: payment.id, perform_time: payment.paid_at?.getTime(), state: 2 }, id });
        }
        await fulfillSubscription(payment.id, params.id);
        const updated = await prisma.payment.findUnique({ where: { id: payment.id } });
        return res.json({ result: { transaction: updated!.id, perform_time: updated!.paid_at?.getTime(), state: 2 }, id });
      }
      case "CancelTransaction": {
        const payment = await prisma.payment.findFirst({ where: { external_id: params.id } });
        if (!payment) throw PAYME_ERRORS.TRANSACTION_NOT_FOUND;
        if (payment.status === "SUCCESS") return res.json({ result: { transaction: payment.id, cancel_time: Date.now(), state: -2 }, id });
        
        const now = new Date();
        await prisma.payment.update({
          where: { id: payment.id },
          data: { status: "FAILED", cancel_time: now, cancel_reason: String(params.reason) }
        });
        return res.json({ result: { transaction: payment.id, cancel_time: now.getTime(), state: -1 }, id });
      }
      case "CheckTransaction": {
        const payment = await prisma.payment.findFirst({ where: { external_id: params.id } });
        if (!payment) throw PAYME_ERRORS.TRANSACTION_NOT_FOUND;
        return res.json({
          result: {
            create_time: payment.created_at.getTime(),
            perform_time: payment.paid_at?.getTime() || 0,
            cancel_time: payment.cancel_time?.getTime() || 0,
            transaction: payment.id,
            state: payment.status === "SUCCESS" ? 2 : (payment.status === "FAILED" ? -1 : 1),
            reason: payment.cancel_reason ? Number(payment.cancel_reason) : null
          },
          id
        });
      }
      default: return res.json({ error: PAYME_ERRORS.METHOD_NOT_FOUND, id });
    }
  } catch (err: any) {
    return res.json({ error: err.code ? err : PAYME_ERRORS.SYSTEM_ERROR, id });
  }
});

// Click Callback
publicRouter.post("/payments/click/prepare", publicLimiter, async (req: Request, res: Response) => {
  const p = req.body;
  const config = await getPaymentConfig();
  if (!verifyClickSignature(p, 0, config?.click_secret_key || "")) {
    return res.json({ error: CLICK_ERRORS.SIGN_CHECK_FAILED, error_note: "Sign failed" });
  }

  const payment = await prisma.payment.findUnique({ where: { id: p.merchant_trans_id } });
  if (!payment) return res.json({ error: CLICK_ERRORS.USER_NOT_FOUND, error_note: "Order not found" });
  if (parseFloat(String(payment.amount)) !== parseFloat(p.amount)) return res.json({ error: CLICK_ERRORS.WRONG_AMOUNT, error_note: "Wrong amount" });
  if (payment.status === "SUCCESS") return res.json({ error: CLICK_ERRORS.ALREADY_PAID, error_note: "Already paid" });

  await prisma.payment.update({
    where: { id: payment.id },
    data: { external_id: String(p.click_trans_id), processing_status: "PROCESSING" }
  });

  res.json({ click_trans_id: p.click_trans_id, merchant_trans_id: p.merchant_trans_id, merchant_prepare_id: payment.id, error: 0, error_note: "Success" });
});

publicRouter.post("/payments/click/complete", publicLimiter, async (req: Request, res: Response) => {
  const p = req.body;
  const config = await getPaymentConfig();
  if (!verifyClickSignature(p, 1, config?.click_secret_key || "")) {
    return res.json({ error: CLICK_ERRORS.SIGN_CHECK_FAILED, error_note: "Sign failed" });
  }

  const payment = await prisma.payment.findUnique({ where: { id: p.merchant_trans_id } });
  if (!payment || p.merchant_prepare_id !== payment.id) return res.json({ error: CLICK_ERRORS.TRANSACTION_NOT_FOUND, error_note: "Invalid prepare id" });

  if (parseInt(p.error) < 0) {
    await prisma.payment.update({ where: { id: payment.id }, data: { status: "FAILED" } });
    return res.json({ error: CLICK_ERRORS.CANCELLED, error_note: "Cancelled" });
  }

  if (payment.status === "SUCCESS") {
    return res.json({ click_trans_id: p.click_trans_id, merchant_trans_id: p.merchant_trans_id, merchant_confirm_id: payment.id, error: 0 });
  }

  await fulfillSubscription(payment.id, String(p.click_trans_id));
  res.json({ click_trans_id: p.click_trans_id, merchant_trans_id: p.merchant_trans_id, merchant_confirm_id: payment.id, error: 0, error_note: "Success" });
});

// Mount Public Router
app.use("/admin/api", publicRouter);

// ─────────────────────────────────────────────
// ADMIN API (Protected)
// ─────────────────────────────────────────────

const router = express.Router();

// Rate limiting for admin API (brute force protection)
const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: "Too many attempts, please try again later" }
});
router.use(adminLimiter);

// ─────────────────────────────────────────────
// ADMIN MIDDLEWARE — защита по паролю
// ─────────────────────────────────────────────
function adminAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers["x-admin-password"];
  const queryPassword = req.query.admin_password as string;

  if (authHeader === ADMIN_PASSWORD || queryPassword === ADMIN_PASSWORD) {
    return next();
  }
  res.status(401).json({ error: "Unauthorized. Provide correct credentials." });
}

// Применяем middleware только к API роутам
router.use(adminAuth);

// Dashboard
router.get("/dashboard", async (_req: Request, res: Response) => {
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [userCount, orgCount, totalPayments, aiTransactions, avgLatency] = await Promise.all([
    prisma.user.count(),
    prisma.organization.count(),
    prisma.payment.aggregate({ where: { status: "SUCCESS" }, _sum: { amount: true } }),
    prisma.aiUsage.count(),
    (prisma.aiUsage.aggregate({ where: { created_at: { gte: yesterday }, duration_ms: { not: null } }, _avg: { duration_ms: true } }) as any)
  ]);
  res.json({ users: userCount, organizations: orgCount, total_payments_usd: Number(totalPayments._sum.amount || 0), ai_transactions: aiTransactions, avg_latency_ms: (avgLatency as any)?._avg?.duration_ms || 0 });
});

// Analytics Funnel
router.get("/admin/analytics/funnel", async (_req: Request, res: Response) => {
  const [totalUsers, orgUsers, activeOrgs, proSubscriptions] = await Promise.all([
    prisma.user.count(),
    prisma.organization.groupBy({ by: ['user_id'] }).then(res => res.length),
    prisma.transaction.groupBy({ by: ['organization_id'], where: { is_deleted: false } }).then(res => res.length),
    prisma.subscription.count({ where: { plan: 'PRO' } })
  ]);
  res.json([{ label: 'Регистрация', count: totalUsers }, { label: 'Создание организации', count: orgUsers }, { label: 'Первая проводка', count: activeOrgs }, { label: 'Оплата PRO', count: proSubscriptions }]);
});

// Users
router.get("/users", async (req: Request, res: Response) => {
  const search = req.query.search as string;
  const users = await prisma.user.findMany({ where: search ? { OR: [{ email: { contains: search, mode: 'insensitive' } }, { name: { contains: search, mode: 'insensitive' } }] } : {}, include: { organizations: { include: { subscription: true, transactions: { where: { is_deleted: false }, take: 1, orderBy: { createdAt: 'desc' } } } } }, take: 50 });
  const enrichedUsers = await Promise.all(users.map(async (u) => {
    const orgsWithPayments = await Promise.all(u.organizations.map(async (o) => {
      const lastPayment = await prisma.payment.findFirst({ where: { organization_id: o.id, status: 'SUCCESS' }, orderBy: { created_at: 'desc' } });
      return { ...o, lastPayment };
    }));
    return { ...u, organizations: orgsWithPayments };
  }));
  res.json(enrichedUsers);
});

router.post("/users/:orgId/upgrade", async (req: Request, res: Response) => {
  const { orgId } = req.params;
  const { days } = req.body;
  const daysToAdd = parseInt(days) || 30;
  const sub = await prisma.subscription.findUnique({ where: { organization_id: orgId } });
  const baseDate = (sub?.plan === "PRO" && sub.valid_until && sub.valid_until > new Date()) ? sub.valid_until : new Date();
  const newValidUntil = new Date(baseDate);
  newValidUntil.setDate(newValidUntil.getDate() + daysToAdd);
  const updated = await prisma.subscription.upsert({ where: { organization_id: orgId }, update: { plan: "PRO", valid_until: newValidUntil }, create: { organization_id: orgId, plan: "PRO", valid_until: newValidUntil } });
  res.json({ success: true, subscription: updated });
});

router.post("/users/:orgId/reset-ai", async (req: Request, res: Response) => {
  const { orgId } = req.params;
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  await prisma.aiUsage.deleteMany({ where: { organization_id: orgId, created_at: { gte: startOfMonth } } });
  res.json({ success: true });
});

router.patch("/users/:orgId/plan", async (req: Request, res: Response) => {
  const { orgId } = req.params;
  const { plan } = req.body;
  if (!["FREE", "PRO", "MYAPI"].includes(plan)) return res.status(400).json({ error: "Invalid plan type" });
  const updated = await prisma.subscription.upsert({ where: { organization_id: orgId }, update: { plan }, create: { organization_id: orgId, plan } });
  res.json({ success: true, subscription: updated });
});

router.patch("/users/:orgId/api-key", async (req: Request, res: Response) => {
  const { orgId } = req.params;
  const { apiKey } = req.body;
  const updated = await prisma.subscription.upsert({ where: { organization_id: orgId }, update: { custom_api_key: apiKey || null }, create: { organization_id: orgId, plan: "FREE", custom_api_key: apiKey || null } });
  res.json({ success: true, subscription: updated });
});

// AI Usage
router.get("/ai-usage", async (_req: Request, res: Response) => {
  const usage = await prisma.aiUsage.groupBy({ by: ["organization_id"], _sum: { tokens_input: true, tokens_output: true, cost_usd: true }, _count: { id: true }, orderBy: { _sum: { cost_usd: "desc" } }, take: 50 });
  const enriched = await Promise.all(usage.map(async (u) => {
    const org = await prisma.organization.findUnique({ where: { id: u.organization_id }, select: { name: true } });
    return { ...u, org_name: org?.name || "Unknown" };
  }));
  res.json(enriched);
});

// Payments
router.get("/payments", async (_req: Request, res: Response) => {
  const payments = await prisma.payment.findMany({ orderBy: { created_at: "desc" }, take: 100 });
  const enriched = await Promise.all(payments.map(async (p) => {
    const org = await prisma.organization.findUnique({ where: { id: p.organization_id }, select: { name: true } });
    return { ...p, org_name: org?.name || "Unknown" };
  }));
  res.json(enriched);
});

// Vouchers
router.get("/vouchers", async (_req: Request, res: Response) => {
  const vouchers = await prisma.voucher.findMany({ orderBy: { created_at: "desc" }, take: 100 });
  res.json(vouchers);
});

router.post("/vouchers/generate", async (req: Request, res: Response) => {
  const { count = 10, days = 30 } = req.body;
  const vouchers = [];
  for (let i = 0; i < count; i++) {
    vouchers.push({ code: `CONT-${randomBytes(3).toString('hex').toUpperCase()}-${randomBytes(3).toString('hex').toUpperCase()}`, days_granted: parseInt(days) });
  }
  await prisma.voucher.createMany({ data: vouchers });
  res.json({ success: true, count: vouchers.length });
});

router.delete("/users/:userId", async (req: Request, res: Response) => {
  const { userId } = req.params;
  try { await prisma.user.delete({ where: { id: userId } }); res.json({ success: true }); } catch (error) { res.status(500).json({ error: "Failed to delete user" }); }
});

router.delete("/organizations/:orgId", async (req: Request, res: Response) => {
  const { orgId } = req.params;
  try { await prisma.organization.delete({ where: { id: orgId } }); res.json({ success: true }); } catch (error) { res.status(500).json({ error: "Failed to delete organization" }); }
});

// Create User
router.post("/users", async (req: Request, res: Response) => {
  const { email, password, name, orgName } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Email and password required" });

  try {
    const password_hash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email,
        password_hash,
        name: name || null,
        organizations: orgName ? {
          create: {
            name: orgName,
            onboarding_state: 'COMPLETED'
          }
        } : undefined
      }
    });
    res.json({ success: true, user });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to create user" });
  }
});

// Update User Credentials
router.patch("/users/:userId/credentials", async (req: Request, res: Response) => {
  const { userId } = req.params;
  const { email, password } = req.body;
  
  const updateData: any = {};
  if (email) updateData.email = email;
  if (password) {
    updateData.password_hash = await bcrypt.hash(password, 10);
  }

  try {
    await prisma.user.update({
      where: { id: userId },
      data: updateData
    });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to update user" });
  }
});

// Payment Settings
router.get("/payment-settings", async (_req: Request, res: Response) => {
  const config = await getPaymentConfig();
  if (!config) {
    res.json({ payme_merchant_id: "", payme_env: "test", click_merchant_id: "", click_service_id: "", click_env: "test", pro_price_yearly: 299000 });
  } else {
    const scrubbed = { ...config } as any;
    if (scrubbed.payme_key) scrubbed.payme_key = "********";
    if (scrubbed.payme_test_key) scrubbed.payme_test_key = "********";
    if (scrubbed.click_secret_key) scrubbed.click_secret_key = "********";
    res.json(scrubbed);
  }
});

router.post("/payment-settings", async (req: Request, res: Response) => {
  const data = req.body;
  const current = await getPaymentConfig();
  if (data.payme_key === "********") data.payme_key = current?.payme_key;
  if (data.payme_test_key === "********") data.payme_test_key = current?.payme_test_key;
  if (data.click_secret_key === "********") data.click_secret_key = current?.click_secret_key;
  if (data.pro_price_yearly) data.pro_price_yearly = parseInt(data.pro_price_yearly);
  const config = await prisma.paymentConfig.upsert({ where: { id: "default" }, update: data, create: { id: "default", ...data } });
  res.json({ success: true, config });
});

// ─────────────────────────────────────────────
// V2 ROUTES — управление contador v2 (contador_v2 DB)
// ─────────────────────────────────────────────

router.get("/v2/dashboard", async (_req: Request, res: Response) => {
  const [userCount, orgCount, proCount, freeCount, txStats] = await Promise.all([
    prismaV2.user.count(),
    prismaV2.organization.count(),
    prismaV2.subscription.count({ where: { plan: "PRO" } }),
    prismaV2.subscription.count({ where: { plan: "FREE" } }),
    prismaV2.stagedTransaction.groupBy({
      by: ["status"],
      _count: { id: true }
    })
  ]);
  const txByStatus: Record<string, number> = {};
  for (const r of txStats) txByStatus[r.status] = r._count.id;
  res.json({ users: userCount, organizations: orgCount, pro_count: proCount, free_count: freeCount, tx_by_status: txByStatus });
});

router.get("/v2/users", async (req: Request, res: Response) => {
  const search = req.query.search as string;
  const users = await prismaV2.user.findMany({
    where: search
      ? { OR: [{ email: { contains: search, mode: "insensitive" } }, { name: { contains: search, mode: "insensitive" } }] }
      : {},
    include: {
      memberships: {
        include: {
          org: { include: { subscription: true } }
        }
      }
    },
    orderBy: { createdAt: "desc" },
    take: 50
  });
  res.json(users);
});

router.post("/v2/users", async (req: Request, res: Response) => {
  const { email, password, name, orgName } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Email and password required" });
  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prismaV2.user.create({
      data: {
        email,
        passwordHash,
        name: name || null,
        ...(orgName ? {
          memberships: {
            create: {
              role: "OWNER",
              org: { create: { name: orgName } }
            }
          }
        } : {})
      }
    });
    res.json({ success: true, user });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to create user" });
  }
});

router.delete("/v2/users/:userId", async (req: Request, res: Response) => {
  try {
    await prismaV2.user.delete({ where: { id: req.params.userId } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete user" });
  }
});

router.patch("/v2/users/:userId/credentials", async (req: Request, res: Response) => {
  const { userId } = req.params;
  const { email, password } = req.body;
  const updateData: any = {};
  if (email) updateData.email = email;
  if (password) updateData.passwordHash = await bcrypt.hash(password, 10);
  try {
    await prismaV2.user.update({ where: { id: userId }, data: updateData });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to update user" });
  }
});

router.patch("/v2/orgs/:orgId/plan", async (req: Request, res: Response) => {
  const { orgId } = req.params;
  const { plan } = req.body;
  if (!["FREE", "PRO"].includes(plan)) return res.status(400).json({ error: "Invalid plan. Use FREE or PRO." });
  const updated = await prismaV2.subscription.upsert({
    where: { orgId },
    update: { plan },
    create: { orgId, plan }
  });
  res.json({ success: true, subscription: updated });
});

router.patch("/v2/orgs/:orgId/api-key", async (req: Request, res: Response) => {
  const { orgId } = req.params;
  const { apiKey } = req.body;
  const updated = await prismaV2.subscription.upsert({
    where: { orgId },
    update: { customApiKey: apiKey || null },
    create: { orgId, plan: "FREE", customApiKey: apiKey || null }
  });
  res.json({ success: true, subscription: updated });
});

router.post("/v2/orgs/:orgId/upgrade", async (req: Request, res: Response) => {
  const { orgId } = req.params;
  const { days } = req.body;
  const daysToAdd = parseInt(days) || 30;
  const sub = await prismaV2.subscription.findUnique({ where: { orgId } });
  const baseDate = (sub?.plan === "PRO" && sub.validUntil && sub.validUntil > new Date()) ? sub.validUntil : new Date();
  const newValidUntil = new Date(baseDate);
  newValidUntil.setDate(newValidUntil.getDate() + daysToAdd);
  const updated = await prismaV2.subscription.upsert({
    where: { orgId },
    update: { plan: "PRO", validUntil: newValidUntil },
    create: { orgId, plan: "PRO", validUntil: newValidUntil }
  });
  res.json({ success: true, subscription: updated });
});

router.delete("/v2/orgs/:orgId", async (req: Request, res: Response) => {
  try {
    await prismaV2.organization.delete({ where: { id: req.params.orgId } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete organization" });
  }
});

// ─── V2 EXTENDED ROUTES ───────────────────────────────────────────────────────

// Enhanced stats: registration dynamics, transaction backlog, risk items
router.get("/v2/stats", async (req: Request, res: Response) => {
  const days = parseInt(req.query.days as string) || 30;
  const since = new Date();
  since.setDate(since.getDate() - days);

  const [rawRegs, backlogCount, riskCount, orgCount, proCount] = await Promise.all([
    prismaV2.user.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } }),
    prismaV2.stagedTransaction.count({ where: { status: { in: ["IMPORTED", "NEEDS_CLARIFICATION"] } } }),
    prismaV2.openItem.count({ where: { status: "RISK" } }),
    prismaV2.organization.count(),
    prismaV2.subscription.count({ where: { plan: "PRO" } })
  ]);

  const regsByDay: Record<string, number> = {};
  for (const u of rawRegs) {
    const day = new Date(u.createdAt).toISOString().slice(0, 10);
    regsByDay[day] = (regsByDay[day] || 0) + 1;
  }
  const regsSeries = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    regsSeries.push({ date: key, count: regsByDay[key] || 0 });
  }

  res.json({ backlog: backlogCount, riskItems: riskCount, freeOrgs: orgCount - proCount, regsSeries });
});

// List all V2 orgs with search, plan and tax regime filter, pagination
router.get("/v2/orgs", async (req: Request, res: Response) => {
  const { search, plan, taxRegime, page = "1" } = req.query;
  const take = 50;
  const skip = (parseInt(page as string) - 1) * take;

  const where: any = {};
  if (search) where.OR = [
    { name: { contains: search as string, mode: "insensitive" } },
    { inn: { contains: search as string } }
  ];
  if (taxRegime) where.taxRegime = taxRegime;

  if (plan === "PRO") {
    const ids = await prismaV2.subscription.findMany({ where: { plan: "PRO" }, select: { orgId: true } });
    where.id = { in: ids.map((s: any) => s.orgId) };
  } else if (plan === "FREE") {
    const ids = await prismaV2.subscription.findMany({ where: { plan: "PRO" }, select: { orgId: true } });
    where.NOT = { id: { in: ids.map((s: any) => s.orgId) } };
  }

  const [orgs, total] = await Promise.all([
    prismaV2.organization.findMany({
      where,
      include: { subscription: { select: { plan: true, validUntil: true } }, _count: { select: { members: true } } },
      orderBy: { createdAt: "desc" },
      take, skip
    }),
    prismaV2.organization.count({ where })
  ]);

  const orgIds = orgs.map((o: any) => o.id);
  const txStats = await prismaV2.stagedTransaction.groupBy({
    by: ["orgId", "status"],
    where: { orgId: { in: orgIds }, status: { in: ["IMPORTED", "NEEDS_CLARIFICATION"] } },
    _count: { id: true }
  });
  const backlogByOrg: Record<string, number> = {};
  for (const r of txStats) backlogByOrg[r.orgId] = (backlogByOrg[r.orgId] || 0) + r._count.id;

  res.json({
    orgs: orgs.map((o: any) => ({ ...o, txBacklog: backlogByOrg[o.id] || 0 })),
    total,
    page: parseInt(page as string),
    pages: Math.ceil(total / take)
  });
});

// Full org detail: members, bank accounts, periods, tx stats, recent audit
router.get("/v2/orgs/:orgId/detail", async (req: Request, res: Response) => {
  const { orgId } = req.params;
  const [org, periods, txStats, auditLogs] = await Promise.all([
    prismaV2.organization.findUnique({
      where: { id: orgId },
      include: {
        subscription: true,
        members: { include: { user: { select: { id: true, email: true, name: true, createdAt: true } } } },
        bankAccounts: true
      }
    }),
    prismaV2.period.findMany({
      where: { orgId },
      orderBy: [{ year: "desc" }, { month: "desc" }],
      include: { _count: { select: { stagedTransactions: true, documents: true } } }
    }),
    prismaV2.stagedTransaction.groupBy({ by: ["status"], where: { orgId }, _count: { id: true } }),
    prismaV2.auditLog.findMany({ where: { orgId }, orderBy: { createdAt: "desc" }, take: 10 })
  ]);

  if (!org) return res.status(404).json({ error: "Org not found" });

  const txByStatus: Record<string, number> = {};
  for (const r of txStats) txByStatus[r.status] = r._count.id;

  res.json({ org, periods, txByStatus, auditLogs });
});

// Edit org core settings
router.patch("/v2/orgs/:orgId/settings", async (req: Request, res: Response) => {
  const { orgId } = req.params;
  const { name, inn, taxRegime, isVatPayer, aiConfidenceThreshold, maxClarificationQuestions } = req.body;
  const data: any = {};
  if (name !== undefined) data.name = name;
  if (inn !== undefined) data.inn = inn;
  if (taxRegime !== undefined) data.taxRegime = taxRegime;
  if (isVatPayer !== undefined) data.isVatPayer = Boolean(isVatPayer);
  if (aiConfidenceThreshold !== undefined) data.aiConfidenceThreshold = parseInt(aiConfidenceThreshold);
  if (maxClarificationQuestions !== undefined) data.maxClarificationQuestions = parseInt(maxClarificationQuestions);
  const org = await prismaV2.organization.update({ where: { id: orgId }, data });
  res.json({ success: true, org });
});

// Remove user from org (OrgMember only, user account stays)
router.delete("/v2/orgs/:orgId/members/:userId", async (req: Request, res: Response) => {
  const { orgId, userId } = req.params;
  try {
    await prismaV2.orgMember.delete({ where: { userId_orgId: { userId, orgId } } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to remove member" });
  }
});

// Delete bank account (admin override)
router.delete("/v2/bank-accounts/:accountId", async (req: Request, res: Response) => {
  try {
    await prismaV2.bankAccount.delete({ where: { id: req.params.accountId } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete bank account" });
  }
});

// List PRO subscriptions expiring within N days
router.get("/v2/subscriptions/expiring", async (req: Request, res: Response) => {
  const days = parseInt(req.query.days as string) || 30;
  const now = new Date();
  const until = new Date(); until.setDate(until.getDate() + days);
  const subs = await prismaV2.subscription.findMany({
    where: { plan: "PRO", validUntil: { gte: now, lte: until } },
    include: { org: true },
    orderBy: { validUntil: "asc" }
  });
  res.json(subs);
});

// List classification rules for an org
router.get("/v2/orgs/:orgId/rules", async (req: Request, res: Response) => {
  const rules = await prismaV2.rule.findMany({
    where: { orgId: req.params.orgId },
    include: { documentType: { select: { name: true, code: true } } },
    orderBy: { order: "asc" }
  });
  res.json(rules);
});

// Delete a classification rule
router.delete("/v2/rules/:ruleId", async (req: Request, res: Response) => {
  try {
    await prismaV2.rule.delete({ where: { id: req.params.ruleId } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete rule" });
  }
});

// Audit log with optional org filter and pagination
router.get("/v2/audit-logs", async (req: Request, res: Response) => {
  const { orgId, from, to, page = "1" } = req.query;
  const take = 50;
  const skip = (parseInt(page as string) - 1) * take;
  const where: any = {};
  if (orgId) where.orgId = orgId;
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = new Date(from as string);
    if (to) where.createdAt.lte = new Date(to as string);
  }
  const [logs, total] = await Promise.all([
    prismaV2.auditLog.findMany({ where, include: { org: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take, skip }),
    prismaV2.auditLog.count({ where })
  ]);
  res.json({ logs, total, page: parseInt(page as string), pages: Math.ceil(total / take) });
});

// Force-set period status (admin override)
router.patch("/v2/periods/:periodId/status", async (req: Request, res: Response) => {
  const { status } = req.body;
  if (!["OPEN", "CLOSED"].includes(status)) return res.status(400).json({ error: "Invalid status" });
  try {
    const period = await prismaV2.period.update({
      where: { id: req.params.periodId },
      data: { status, lockDate: status === "CLOSED" ? new Date() : null }
    });
    res.json({ success: true, period });
  } catch (error: any) {
    res.status(404).json({ error: "Period not found" });
  }
});

app.use("/admin/api", router);
app.use("/admin", express.static(path.join(__dirname, "public")));
app.use("/", express.static(path.join(__dirname, "public")));

app.listen(PORT, () => { console.log(`✅ Admin Portal running at http://localhost:${PORT}`); });

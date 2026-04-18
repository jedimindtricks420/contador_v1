import express, { Request, Response, NextFunction } from "express";
import { PrismaClient } from "@prisma/client";
import { randomBytes } from "crypto";
import path from "path";
import crypto from "crypto";
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
publicRouter.use(publicLimiter);

// Initiate Payment
publicRouter.post("/payments/initiate", async (req: Request, res: Response) => {
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

publicRouter.get("/payment-info", async (_req: Request, res: Response) => {
  const config = await getPaymentConfig();
  res.json({ pro_price_yearly: config?.pro_price_yearly || 299000 });
});

// Payme Webhook
publicRouter.post("/payments/payme", async (req: Request, res: Response) => {
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
publicRouter.post("/payments/click/prepare", async (req: Request, res: Response) => {
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

publicRouter.post("/payments/click/complete", async (req: Request, res: Response) => {
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

// Payment Settings
router.get("/payment-settings", async (_req: Request, res: Response) => {
  let config = await getPaymentConfig();
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

app.use("/admin/api", router);
app.use("/admin", express.static(path.join(__dirname, "public")));
app.use("/", express.static(path.join(__dirname, "public")));

app.listen(PORT, () => { console.log(`✅ Admin Portal running at http://localhost:${PORT}`); });

import express, { Request, Response, NextFunction } from "express";
import { PrismaClient } from "@prisma/client";
import { randomBytes } from "crypto";
import path from "path";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

const app = express();
app.set("trust proxy", 1);
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "cdn.tailwindcss.com", "unpkg.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "fonts.googleapis.com"],
      fontSrc: ["'self'", "fonts.gstatic.com"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'", "https://unpkg.com"]
    }
  }
})); // Configured security headers for Admin Portal

const prisma = new PrismaClient();

// ─── V2 DATABASE CLIENT ──────────────────────────────────────────────────────
// Uses the v2 Prisma client generated from the v2 schema (contador_v2 DB)
const { PrismaClient: PrismaClientV2 } = require("../v2/node_modules/.prisma/client");
if (!process.env.V2_DATABASE_URL) {
  throw new Error("V2_DATABASE_URL is not set");
}
const V2_DATABASE_URL = process.env.V2_DATABASE_URL;
const prismaV2 = new PrismaClientV2({ datasources: { db: { url: V2_DATABASE_URL } } });
const PORT = process.env.ADMIN_PORT || 3031;
if (!process.env.ADMIN_PASSWORD) {
  throw new Error("ADMIN_PASSWORD is not set");
}
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

// verify captures the exact raw bytes of every JSON body into req.rawBody -
// нужно для проверки HMAC-подписи вебхука Alifpay (see /v2/payments/alif/webhook below).
// JSON.stringify(req.body) не подходит: повторная сериализация может изменить
// порядок ключей/пробелы, и подпись не совпадёт с присланной Alifpay.
app.use(express.json({
  verify: (req: any, _res, buf: Buffer) => {
    req.rawBody = buf;
  },
}));
app.use(express.urlencoded({ extended: true }));
app.use((req: Request, _res: Response, next: NextFunction) => { if (req.body === undefined) req.body = {}; next(); });

// ─────────────────────────────────────────────
// PAYMENT UTILS & HELPERS
// ─────────────────────────────────────────────

const PAYME_ERRORS = {
  // Transport / System
  TRANSPORT_ERROR:      { code: -32300, message: { uz: 'Transport xatosi', ru: 'Ошибка транспорта', en: 'Transport error' } },
  SYSTEM_ERROR:         { code: -32400, message: { uz: 'Tizim xatosi', ru: 'Системная ошибка', en: 'System error' } },
  METHOD_NOT_FOUND:     { code: -32601, message: { uz: 'Metod topilmadi', ru: 'Метод не найден', en: 'Method not found' } },
  AUTH_ERROR:           { code: -32504, message: { uz: 'Ushbu usulni bajarishga ruxsat yo\'q', ru: 'Недостаточно прав для выполнения метода', en: 'Insufficient privilege to perform this method' } },
  // Business logic
  WRONG_AMOUNT:         { code: -31001, message: { uz: 'Noto\'g\'ri summa', ru: 'Недопустимая сумма', en: 'Invalid amount' } },
  TRANSACTION_NOT_FOUND:{ code: -31003, message: { uz: 'Tranzaksiya topilmadi', ru: 'Транзакция не найдена', en: 'Transaction not found' } },
  CANNOT_CANCEL:        { code: -31007, message: { uz: 'Tranzaksiyani bekor qilib bo\'lmaydi', ru: 'Невозможно отменить транзакцию', en: 'Unable to cancel transaction' } },
  CANNOT_PERFORM:       { code: -31008, message: { uz: 'Operatsiyani bajarib bo\'lmadi', ru: 'Невозможно выполнить операцию', en: 'Unable to perform operation' } },
  // Order / Account errors
  ORDER_NOT_FOUND:      { code: -31050, message: { uz: 'Biz sizning hisobingizni topolmadik', ru: 'Мы не нашли вашу учетную запись', en: 'We couldn\'t find your account' } },
  ORDER_CANCELLED:      { code: -31051, message: { uz: 'Buyurtma bekor qilindi', ru: 'Заказ отменен', en: 'Order cancelled' } },
  ORDER_ALREADY_PAID:   { code: -31052, message: { uz: 'Buyurtma allaqachon to\'langan', ru: 'Заказ уже оплачен', en: 'Order already paid' } },
  ORDER_HAS_TRANSACTION:{ code: -31053, message: { uz: 'Buyurtmada boshqa tranzaksiya mavjud', ru: 'По заказу уже есть другая транзакция', en: 'Order already has another transaction' } },
};

const CLICK_ERRORS = {
  SUCCESS: 0,
  SIGN_CHECK_FAILED: -1,
  WRONG_AMOUNT: -2,
  ALREADY_PAID: -4,
  ORDER_NOT_FOUND: -5,
  TRANSACTION_NOT_FOUND: -6,
  CANNOT_CANCEL: -7,
  CANCELLED: -9,
  SYSTEM_ERROR: -10
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
  const returnUrl = "https://contador.uz/settings/subscription?payment=success";
  return `https://my.click.uz/services/pay?service_id=${serviceId}&merchant_id=${merchantId}&amount=${amount}&transaction_param=${orderId}&return_url=${encodeURIComponent(returnUrl)}`;
}

// ─────────────────────────────────────────────
// ALIFPAY
// ─────────────────────────────────────────────

const ALIF_PRODUCTION_BASE_URL = "https://api.alifpay.uz/v2";
// ВАЖНО: sandbox-адрес API не подтверждён напрямую документацией Alifpay
// (спрятан за JS-переключателем на docs.alifpay.uz) - сверить в личном кабинете.
const ALIF_SANDBOX_BASE_URL = "https://api-dev.alifpay.uz/v2";
const ALIF_MIN_AMOUNT_TIYIN = 50000; // 500 сум
const ALIF_MAX_AMOUNT_TIYIN = 20000000000; // 200 000 000 сум

function isAmountInAlifRange(amountTiyin: number) {
  return amountTiyin >= ALIF_MIN_AMOUNT_TIYIN && amountTiyin <= ALIF_MAX_AMOUNT_TIYIN;
}

async function createAlifInvoice({ token, env, items, cancelUrl, redirectUrl, webhookUrl, meta }: {
  token: string; env: string; items: any[]; cancelUrl: string; redirectUrl: string; webhookUrl: string; meta: any;
}): Promise<{ success: boolean; id?: string; error?: string }> {
  const baseUrl = env === "production" ? ALIF_PRODUCTION_BASE_URL : ALIF_SANDBOX_BASE_URL;
  try {
    const res = await fetch(`${baseUrl}/invoice`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Token: token },
      body: JSON.stringify({ items, cancel_url: cancelUrl, redirect_url: redirectUrl, webhook_url: webhookUrl, meta }),
    });
    const data: any = await res.json();
    // Alifpay всегда возвращает HTTP 200, даже при бизнес-ошибке - признак ошибки: поле `error`.
    if (data.error) {
      console.error("[Alif] createInvoice business error:", data.error);
      return { success: false, error: data.error.message || "Alifpay error" };
    }
    return { success: true, id: data.id };
  } catch (err: any) {
    console.error("[Alif] createInvoice network error:", err.message);
    return { success: false, error: "Платёжный сервис Alifpay временно недоступен" };
  }
}

function getAlifCheckoutUrl(invoiceId: string, env: string) {
  const base = env === "production" ? "https://checkout.alifpay.uz/" : "https://checkout-dev.alifpay.uz/";
  return `${base}?invoice=${encodeURIComponent(invoiceId)}`;
}

/**
 * Проверка подписи вебхука Alifpay: base64( HMAC-SHA256(rawBody, secretKey) ), заголовок `Signature`.
 * rawBody должен быть точным сырым телом запроса, а не JSON.stringify(req.body) -
 * при повторной сериализации порядок ключей/пробелы могут отличаться от оригинала.
 */
function verifyAlifSignature(rawBody: Buffer | undefined, signatureHeader: string | undefined, secretKey: string | undefined | null) {
  if (!rawBody || !signatureHeader || !secretKey) return false;
  const expected = crypto.createHmac("sha256", secretKey).update(rawBody).digest("base64");
  const expectedBuf = Buffer.from(expected);
  const receivedBuf = Buffer.from(signatureHeader);
  if (expectedBuf.length !== receivedBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, receivedBuf);
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

async function generateOrderCode(): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const code = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
    const exists = await prismaV2.payment.findUnique({ where: { orderCode: code } });
    if (!exists) return code;
  }
  throw new Error('Не удалось сгенерировать уникальный код заказа');
}

async function fulfillSubscriptionV2(paymentId: string, externalId: string) {
  const payment = await prismaV2.payment.update({
    where: { id: paymentId },
    data: { status: "SUCCESS", externalId, completedAt: new Date() }
  });

  const now = new Date();
  const sub = await prismaV2.subscription.findUnique({ where: { orgId: payment.orgId } });
  const baseDate = (sub?.plan === "PRO" && sub.validUntil && sub.validUntil > now)
    ? sub.validUntil : now;
  const newValidUntil = new Date(baseDate);
  newValidUntil.setDate(newValidUntil.getDate() + (payment.daysGranted || 365));

  await prismaV2.subscription.upsert({
    where: { orgId: payment.orgId },
    update: { plan: "PRO", validUntil: newValidUntil },
    create: { orgId: payment.orgId, plan: "PRO", validUntil: newValidUntil }
  });

  console.log(`[V2 Payment] Fulfilled PRO subscription for Org: ${payment.orgId}`);
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
  try {
    const config = await getPaymentConfig();
    if (!verifyClickSignature(p, 0, config?.click_secret_key || "")) {
      return res.json({ click_trans_id: p.click_trans_id, merchant_trans_id: p.merchant_trans_id, error: CLICK_ERRORS.SIGN_CHECK_FAILED, error_note: "Sign failed" });
    }

    const payment = await prisma.payment.findUnique({ where: { id: p.merchant_trans_id } });
    if (!payment) return res.json({ click_trans_id: p.click_trans_id, merchant_trans_id: p.merchant_trans_id, error: CLICK_ERRORS.ORDER_NOT_FOUND, error_note: "Order not found" });
    if (parseFloat(String(payment.amount)) !== parseFloat(p.amount)) return res.json({ click_trans_id: p.click_trans_id, merchant_trans_id: p.merchant_trans_id, error: CLICK_ERRORS.WRONG_AMOUNT, error_note: "Wrong amount" });
    if (payment.status === "SUCCESS") return res.json({ click_trans_id: p.click_trans_id, merchant_trans_id: p.merchant_trans_id, merchant_prepare_id: payment.id, error: CLICK_ERRORS.ALREADY_PAID, error_note: "Already paid" });

    await prisma.payment.update({
      where: { id: payment.id },
      data: { external_id: String(p.click_trans_id), processing_status: "PROCESSING" }
    });

    res.json({ click_trans_id: p.click_trans_id, merchant_trans_id: p.merchant_trans_id, merchant_prepare_id: payment.id, error: 0, error_note: "Success" });
  } catch (err: any) {
    console.error("[V1 Click Prepare] Error:", err);
    res.json({ click_trans_id: p.click_trans_id, merchant_trans_id: p.merchant_trans_id, error: CLICK_ERRORS.SYSTEM_ERROR, error_note: "System error" });
  }
});

publicRouter.post("/payments/click/complete", publicLimiter, async (req: Request, res: Response) => {
  const p = req.body;
  try {
    const config = await getPaymentConfig();
    if (!verifyClickSignature(p, 1, config?.click_secret_key || "")) {
      return res.json({ click_trans_id: p.click_trans_id, merchant_trans_id: p.merchant_trans_id, error: CLICK_ERRORS.SIGN_CHECK_FAILED, error_note: "Sign failed" });
    }

    const payment = await prisma.payment.findUnique({ where: { id: p.merchant_trans_id } });
    if (!payment || p.merchant_prepare_id !== payment.id) return res.json({ click_trans_id: p.click_trans_id, merchant_trans_id: p.merchant_trans_id, error: CLICK_ERRORS.TRANSACTION_NOT_FOUND, error_note: "Invalid prepare id" });

    if (parseInt(p.error) < 0) {
      await prisma.payment.update({ where: { id: payment.id }, data: { status: "FAILED" } });
      return res.json({ click_trans_id: p.click_trans_id, merchant_trans_id: p.merchant_trans_id, error: CLICK_ERRORS.CANCELLED, error_note: "Cancelled" });
    }

    if (payment.status === "SUCCESS") {
      return res.json({ click_trans_id: p.click_trans_id, merchant_trans_id: p.merchant_trans_id, merchant_confirm_id: payment.id, error: 0, error_note: "Success" });
    }

    await fulfillSubscription(payment.id, String(p.click_trans_id));
    res.json({ click_trans_id: p.click_trans_id, merchant_trans_id: p.merchant_trans_id, merchant_confirm_id: payment.id, error: 0, error_note: "Success" });
  } catch (err: any) {
    console.error("[V1 Click Complete] Error:", err);
    res.json({ click_trans_id: p.click_trans_id, merchant_trans_id: p.merchant_trans_id, error: CLICK_ERRORS.SYSTEM_ERROR, error_note: "System error" });
  }
});

// ─── V2 PAYMENT ROUTES ───────────────────────────────────────────────────────

// V2 - Initiate Payment
publicRouter.post("/v2/payments/initiate", publicLimiter, async (req: Request, res: Response) => {
  const { orgId, provider } = req.body;
  if (!orgId || !["PAYME", "CLICK", "ALIF"].includes(provider)) {
    return res.status(400).json({ error: "Invalid orgId or provider" });
  }

  try {
    const config = await getPaymentConfig();
    if (!config) return res.status(500).json({ error: "Payment system not configured" });

    const amount = config.pro_price_yearly || 299000;
    const pendingExternalId = `PENDING_${randomBytes(8).toString("hex")}`;
    const orderCode = await generateOrderCode();

    const payment = await prismaV2.payment.create({
      data: {
        orgId,
        provider,
        orderCode,
        externalId: pendingExternalId,
        amount: amount,
        currency: "UZS",
        status: "PENDING",
        daysGranted: 365
      }
    });

    let url = "";
    if (provider === "PAYME") {
      url = generatePaymeUrl(orderCode, amount * 100, config);
    } else if (provider === "CLICK") {
      url = generateClickUrl(orderCode, amount, config);
    } else {
      const env = (config as any).alif_env || "sandbox";
      const token = env === "production" ? (config as any).alif_token_production : (config as any).alif_token_sandbox;
      if (!token) {
        await prismaV2.payment.update({ where: { id: payment.id }, data: { status: "FAILED" } });
        return res.status(400).json({ error: "Alifpay не настроен" });
      }
      const priceInTiyin = amount * 100;
      if (!isAmountInAlifRange(priceInTiyin)) {
        await prismaV2.payment.update({ where: { id: payment.id }, data: { status: "FAILED" } });
        return res.status(400).json({ error: "Сумма вне допустимого диапазона Alifpay" });
      }
      const invoiceResult = await createAlifInvoice({
        token,
        env,
        items: [{ name: "Contador PRO — подписка на 1 год", amount: 1, price: priceInTiyin }],
        cancelUrl: "https://contador.uz/settings/subscription",
        redirectUrl: "https://contador.uz/settings/subscription?payment=success",
        webhookUrl: "https://contador.uz/admin/api/v2/payments/alif/webhook",
        meta: { order_id: orderCode },
      });
      if (!invoiceResult.success) {
        await prismaV2.payment.update({ where: { id: payment.id }, data: { status: "FAILED" } });
        return res.status(502).json({ error: invoiceResult.error });
      }
      // Сохраняем invoice id сразу вместо PENDING_ плейсхолдера - счёт уже реально создан у Alifpay.
      await prismaV2.payment.update({ where: { id: payment.id }, data: { externalId: invoiceResult.id } });
      url = getAlifCheckoutUrl(invoiceResult.id!, env);
    }

    res.json({ success: true, url, paymentId: orderCode });
  } catch (err: any) {
    console.error("[V2 Initiate Payment] Error:", err);
    res.status(500).json({ error: "Payment initiation failed", detail: err?.message });
  }
});

// V2 - Payme Webhook
publicRouter.post("/v2/payments/payme", publicLimiter, async (req: Request, res: Response) => {
  const { method, params, id } = req.body;
  const config = await getPaymentConfig();
  if (!checkPaymeAuth(req.headers.authorization, config)) {
    return res.json({ error: PAYME_ERRORS.AUTH_ERROR, id });
  }

  try {
    switch (method) {
      case "CheckPerformTransaction": {
        const providedKey = Object.keys(params.account || {})[0] || "order_id";
        const orderCode = params.account?.[providedKey];
        if (!orderCode) throw { ...PAYME_ERRORS.ORDER_NOT_FOUND, data: providedKey };

        const payment = await prismaV2.payment.findUnique({ where: { orderCode } });
        if (!payment) throw { ...PAYME_ERRORS.ORDER_NOT_FOUND, data: providedKey };
        if (Number(payment.amount) * 100 !== params.amount) throw PAYME_ERRORS.WRONG_AMOUNT;
        if (payment.status === "SUCCESS") throw PAYME_ERRORS.ORDER_ALREADY_PAID;
        if (payment.status === "FAILED") throw PAYME_ERRORS.ORDER_CANCELLED;
        return res.json({ result: { allow: true }, id });
      }
      case "CreateTransaction": {
        const providedKey = Object.keys(params.account || {})[0] || "order_id";
        const orderCode = params.account?.[providedKey];
        if (!orderCode) throw { ...PAYME_ERRORS.ORDER_NOT_FOUND, data: providedKey };

        if (Date.now() - params.time > 43200000) {
          throw { ...PAYME_ERRORS.CANNOT_PERFORM, data: "timeout" };
        }

        const existing = await prismaV2.payment.findFirst({ where: { externalId: params.id } });
        if (existing) {
          return res.json({ result: { create_time: existing.createdAt.getTime(), transaction: existing.orderCode, state: existing.status === "SUCCESS" ? 2 : (existing.status === "FAILED" ? (existing.completedAt ? -2 : -1) : 1) }, id });
        }

        const payment = await prismaV2.payment.findUnique({ where: { orderCode } });
        if (!payment) throw { ...PAYME_ERRORS.ORDER_NOT_FOUND, data: providedKey };
        if (payment.externalId && !payment.externalId.startsWith("PENDING_") && payment.externalId !== params.id) throw PAYME_ERRORS.ORDER_HAS_TRANSACTION;
        if (Number(payment.amount) * 100 !== params.amount) throw PAYME_ERRORS.WRONG_AMOUNT;
        if (payment.status === "SUCCESS") throw PAYME_ERRORS.ORDER_ALREADY_PAID;
        if (payment.status === "FAILED") throw PAYME_ERRORS.ORDER_CANCELLED;

        await prismaV2.payment.update({
          where: { id: payment.id },
          data: { externalId: params.id }
        });
        return res.json({ result: { create_time: payment.createdAt.getTime(), transaction: payment.orderCode, state: 1 }, id });
      }
      case "PerformTransaction": {
        const payment = await prismaV2.payment.findFirst({ where: { externalId: params.id } });
        if (!payment) throw PAYME_ERRORS.TRANSACTION_NOT_FOUND;
        if (payment.status === "SUCCESS" && payment.completedAt) {
          return res.json({ result: { transaction: payment.orderCode, perform_time: payment.completedAt.getTime(), state: 2 }, id });
        }
        if (payment.status === "FAILED") {
          throw { ...PAYME_ERRORS.CANNOT_PERFORM, data: "Transaction cancelled" };
        }
        await fulfillSubscriptionV2(payment.id, params.id);
        const updated = await prismaV2.payment.findUnique({ where: { id: payment.id } });
        return res.json({ result: { transaction: updated!.orderCode, perform_time: updated!.completedAt ? updated!.completedAt.getTime() : Date.now(), state: 2 }, id });
      }
      case "CancelTransaction": {
        const payment = await prismaV2.payment.findFirst({ where: { externalId: params.id } });
        if (!payment) throw PAYME_ERRORS.TRANSACTION_NOT_FOUND;

        const now = new Date();
        if (payment.status === "FAILED") {
          return res.json({ result: { transaction: payment.orderCode, cancel_time: payment.cancelTime ? payment.cancelTime.getTime() : now.getTime(), state: payment.completedAt ? -2 : -1 }, id });
        }
        await prismaV2.payment.update({
          where: { id: payment.id },
          data: { status: "FAILED", cancelTime: now, cancelReason: String(params.reason) }
        });
        return res.json({ result: { transaction: payment.orderCode, cancel_time: now.getTime(), state: payment.completedAt ? -2 : -1 }, id });
      }
      case "CheckTransaction": {
        const payment = await prismaV2.payment.findFirst({ where: { externalId: params.id } });
        if (!payment) throw PAYME_ERRORS.TRANSACTION_NOT_FOUND;

        let state = 1;
        if (payment.status === "SUCCESS") state = 2;
        else if (payment.status === "FAILED") state = payment.completedAt ? -2 : -1;

        return res.json({
          result: {
            create_time: payment.createdAt.getTime(),
            perform_time: payment.completedAt?.getTime() || 0,
            cancel_time: payment.cancelTime?.getTime() || 0,
            transaction: payment.orderCode,
            state: state,
            reason: payment.cancelReason ? parseInt(payment.cancelReason) : null
          },
          id
        });
      }
      case "GetStatement": {
        const { from, to } = params;
        const attempts = await prismaV2.payment.findMany({
          where: {
            externalId: { not: { startsWith: "PENDING_" } },
            createdAt: { gte: new Date(from), lte: new Date(to) }
          },
          orderBy: { createdAt: "asc" }
        });

        const transactions = attempts.map((attempt: any) => {
          let state = 1;
          if (attempt.status === "SUCCESS") state = 2;
          else if (attempt.status === "FAILED") state = attempt.completedAt ? -2 : -1;

          return {
            id: attempt.externalId,
            time: attempt.createdAt.getTime(),
            amount: Number(attempt.amount) * 100,
            account: { order_id: attempt.orderCode },
            create_time: attempt.createdAt.getTime(),
            perform_time: attempt.completedAt?.getTime() || 0,
            cancel_time: attempt.cancelTime?.getTime() || 0,
            transaction: attempt.orderCode,
            state: state,
            reason: attempt.cancelReason ? parseInt(attempt.cancelReason) : null
          };
        });
        return res.json({ result: { transactions }, id });
      }
      default: return res.json({ error: PAYME_ERRORS.METHOD_NOT_FOUND, id });
    }
  } catch (err: any) {
    return res.json({ error: err.code ? err : PAYME_ERRORS.SYSTEM_ERROR, id });
  }
});

// V2 - Click Prepare
publicRouter.post("/v2/payments/click/prepare", publicLimiter, async (req: Request, res: Response) => {
  const p = req.body;
  try {
    const config = await getPaymentConfig();
    if (!verifyClickSignature(p, 0, config?.click_secret_key || "")) {
      return res.json({ click_trans_id: p.click_trans_id, merchant_trans_id: p.merchant_trans_id, error: CLICK_ERRORS.SIGN_CHECK_FAILED, error_note: "Sign failed" });
    }

    const payment = await prismaV2.payment.findUnique({ where: { orderCode: p.merchant_trans_id } });
    if (!payment) return res.json({ click_trans_id: p.click_trans_id, merchant_trans_id: p.merchant_trans_id, error: CLICK_ERRORS.ORDER_NOT_FOUND, error_note: "Order not found" });
    if (parseFloat(String(payment.amount)) !== parseFloat(p.amount)) {
      return res.json({ click_trans_id: p.click_trans_id, merchant_trans_id: p.merchant_trans_id, error: CLICK_ERRORS.WRONG_AMOUNT, error_note: "Wrong amount" });
    }
    if (payment.status === "SUCCESS") return res.json({ click_trans_id: p.click_trans_id, merchant_trans_id: p.merchant_trans_id, merchant_prepare_id: payment.orderCode, error: CLICK_ERRORS.ALREADY_PAID, error_note: "Already paid" });

    await prismaV2.payment.update({
      where: { id: payment.id },
      data: { externalId: String(p.click_trans_id), status: "PROCESSING" }
    });

    res.json({ click_trans_id: p.click_trans_id, merchant_trans_id: p.merchant_trans_id, merchant_prepare_id: payment.orderCode, error: 0, error_note: "Success" });
  } catch (err: any) {
    console.error("[V2 Click Prepare] Error:", err);
    res.json({ click_trans_id: p.click_trans_id, merchant_trans_id: p.merchant_trans_id, error: CLICK_ERRORS.SYSTEM_ERROR, error_note: "System error" });
  }
});

// V2 - Click Complete
publicRouter.post("/v2/payments/click/complete", publicLimiter, async (req: Request, res: Response) => {
  const p = req.body;
  try {
    const config = await getPaymentConfig();
    if (!verifyClickSignature(p, 1, config?.click_secret_key || "")) {
      return res.json({ click_trans_id: p.click_trans_id, merchant_trans_id: p.merchant_trans_id, error: CLICK_ERRORS.SIGN_CHECK_FAILED, error_note: "Sign failed" });
    }

    const payment = await prismaV2.payment.findUnique({ where: { orderCode: p.merchant_trans_id } });
    if (!payment || p.merchant_prepare_id !== payment.orderCode) {
      return res.json({ click_trans_id: p.click_trans_id, merchant_trans_id: p.merchant_trans_id, error: CLICK_ERRORS.TRANSACTION_NOT_FOUND, error_note: "Invalid prepare id" });
    }

    if (parseInt(p.error) < 0) {
      await prismaV2.payment.update({ where: { id: payment.id }, data: { status: "FAILED" } });
      return res.json({ click_trans_id: p.click_trans_id, merchant_trans_id: p.merchant_trans_id, error: CLICK_ERRORS.CANCELLED, error_note: "Cancelled" });
    }

    if (payment.status === "SUCCESS") {
      return res.json({ click_trans_id: p.click_trans_id, merchant_trans_id: p.merchant_trans_id, merchant_confirm_id: payment.orderCode, error: 0, error_note: "Success" });
    }

    await fulfillSubscriptionV2(payment.id, String(p.click_trans_id));
    res.json({ click_trans_id: p.click_trans_id, merchant_trans_id: p.merchant_trans_id, merchant_confirm_id: payment.orderCode, error: 0, error_note: "Success" });
  } catch (err: any) {
    console.error("[V2 Click Complete] Error:", err);
    res.json({ click_trans_id: p.click_trans_id, merchant_trans_id: p.merchant_trans_id, error: CLICK_ERRORS.SYSTEM_ERROR, error_note: "System error" });
  }
});

// V2 - Alifpay Webhook
publicRouter.post("/v2/payments/alif/webhook", publicLimiter, async (req: Request, res: Response) => {
  const rawBody = (req as any).rawBody as Buffer | undefined;
  const signature = req.headers["signature"] as string | undefined;

  try {
    const config = await getPaymentConfig();
    const env = (config as any)?.alif_env || "sandbox";
    const secretKey = env === "production" ? (config as any)?.alif_secret_key_production : (config as any)?.alif_secret_key_sandbox;

    if (!verifyAlifSignature(rawBody, signature, secretKey)) {
      console.error("[V2 Alif] Webhook: invalid signature");
      return res.status(403).json({ status: "invalid_signature" });
    }

    const body = req.body;
    // ВАЖНО: верхнеуровневый `id` - это ID СЧЁТА (invoice), не платежа.
    // Статус/сумма/ID платежа лежат в body.payment.*
    const invoiceId = body.id;
    const payment = body.payment || {};
    const paymentStatus = payment.status;
    const orderCodeFromMeta = body.meta?.order_id;

    console.log(`[V2 Alif] Webhook: invoice=${invoiceId} payment=${payment.id} status=${paymentStatus}`);

    let record = orderCodeFromMeta
      ? await prismaV2.payment.findUnique({ where: { orderCode: orderCodeFromMeta } })
      : null;
    if (!record) {
      record = await prismaV2.payment.findFirst({ where: { externalId: invoiceId } });
    }

    if (!record) {
      console.error("[V2 Alif] Webhook: payment not found for invoice", invoiceId);
      return res.status(200).json({ status: "payment_not_found" });
    }

    if (record.status === "SUCCESS") {
      return res.status(200).json({ status: "already_paid" });
    }

    if (paymentStatus !== "SUCCEEDED") {
      if (paymentStatus && !["PENDING", "PENDING_REVERSAL", "OTP_REQUIRED"].includes(paymentStatus)) {
        await prismaV2.payment.update({ where: { id: record.id }, data: { status: "FAILED" } });
      }
      return res.status(200).json({ status: "not_succeeded", paymentStatus });
    }

    await fulfillSubscriptionV2(record.id, String(payment.id));
    console.log("[V2 Alif] Webhook: payment successful for", record.id);
    return res.status(200).json({ status: "ok" });
  } catch (error) {
    console.error("[V2 Alif] Webhook error:", error);
    // 200, чтобы Alifpay не повторял бесконечно при нашей внутренней ошибке.
    return res.status(200).json({ status: "internal_error" });
  }
});

// V2 User voucher redemption (called by v2 BFF — no admin auth needed, orgId comes from session via BFF)
publicRouter.post("/v2/vouchers/redeem", publicLimiter, async (req: Request, res: Response) => {
  const { orgId, code } = req.body;
  if (!orgId || !code) return res.status(400).json({ error: "orgId and code are required" });
  const normalizedCode = String(code).trim().toUpperCase();
  const voucher = await prismaV2.voucher.findUnique({ where: { code: normalizedCode } });
  if (!voucher) return res.status(404).json({ error: "Ваучер не найден" });
  if (voucher.usedAt) return res.status(409).json({ error: "Ваучер уже использован" });

  const sub = await prismaV2.subscription.findUnique({ where: { orgId } });
  const now = new Date();
  const baseDate = (sub?.plan === "PRO" && sub.validUntil && sub.validUntil > now) ? sub.validUntil : now;
  const newValidUntil = new Date(baseDate);
  newValidUntil.setDate(newValidUntil.getDate() + voucher.daysGranted);

  await prismaV2.$transaction([
    prismaV2.voucher.update({ where: { code: normalizedCode }, data: { usedByOrgId: orgId, usedAt: now } }),
    prismaV2.subscription.upsert({
      where: { orgId },
      update: { plan: "PRO", validUntil: newValidUntil },
      create: { orgId, plan: "PRO", validUntil: newValidUntil }
    })
  ]);

  res.json({ success: true, daysGranted: voucher.daysGranted, validUntil: newValidUntil });
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

  if (authHeader === ADMIN_PASSWORD) {
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
  const { orgId } = req.params as { orgId: string };
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
  const { orgId } = req.params as { orgId: string };
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  await prisma.aiUsage.deleteMany({ where: { organization_id: orgId, created_at: { gte: startOfMonth } } });
  res.json({ success: true });
});

router.patch("/users/:orgId/plan", async (req: Request, res: Response) => {
  const { orgId } = req.params as { orgId: string };
  const { plan } = req.body;
  if (!["FREE", "PRO", "MYAPI"].includes(plan)) return res.status(400).json({ error: "Invalid plan type" });
  const updated = await prisma.subscription.upsert({ where: { organization_id: orgId }, update: { plan }, create: { organization_id: orgId, plan } });
  res.json({ success: true, subscription: updated });
});

router.patch("/users/:orgId/api-key", async (req: Request, res: Response) => {
  const { orgId } = req.params as { orgId: string };
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
  const { userId } = req.params as { userId: string };
  try { await prisma.user.delete({ where: { id: userId } }); res.json({ success: true }); } catch (error) { res.status(500).json({ error: "Failed to delete user" }); }
});

router.delete("/organizations/:orgId", async (req: Request, res: Response) => {
  const { orgId } = req.params as { orgId: string };
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
  const { userId } = req.params as { userId: string };
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
    res.json({ payme_merchant_id: "", payme_env: "test", click_merchant_id: "", click_service_id: "", click_env: "test", alif_env: "sandbox", pro_price_yearly: 299000 });
  } else {
    const scrubbed = { ...config } as any;
    if (scrubbed.payme_key) scrubbed.payme_key = "********";
    if (scrubbed.payme_test_key) scrubbed.payme_test_key = "********";
    if (scrubbed.click_secret_key) scrubbed.click_secret_key = "********";
    if (scrubbed.alif_secret_key_production) scrubbed.alif_secret_key_production = "********";
    if (scrubbed.alif_secret_key_sandbox) scrubbed.alif_secret_key_sandbox = "********";
    res.json(scrubbed);
  }
});

router.post("/payment-settings", async (req: Request, res: Response) => {
  const data = req.body;
  const current = await getPaymentConfig();
  if (data.payme_key === "********") data.payme_key = current?.payme_key;
  if (data.payme_test_key === "********") data.payme_test_key = current?.payme_test_key;
  if (data.click_secret_key === "********") data.click_secret_key = current?.click_secret_key;
  if (data.alif_secret_key_production === "********") data.alif_secret_key_production = (current as any)?.alif_secret_key_production;
  if (data.alif_secret_key_sandbox === "********") data.alif_secret_key_sandbox = (current as any)?.alif_secret_key_sandbox;
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
  const orgId = req.params.orgId;
  try {
    // Must delete in FK-safe order:
    // StagedTransaction → blocks BankAccount & Period deletion
    await prismaV2.stagedTransaction.deleteMany({ where: { orgId } });
    // OpenItem → blocks Document deletion (no cascade on openingDocumentId)
    await prismaV2.openItem.deleteMany({ where: { orgId } });
    // Document → cascade deletes JournalEntry (which references Counterparty without cascade)
    await prismaV2.document.deleteMany({ where: { orgId } });
    // Now safe to delete Periods, BankAccounts, Counterparties
    await prismaV2.period.deleteMany({ where: { orgId } });
    await prismaV2.bankAccount.deleteMany({ where: { orgId } });
    await prismaV2.counterparty.deleteMany({ where: { orgId } });
    await prismaV2.rule.deleteMany({ where: { orgId } });
    // Organization cascade deletes: OrgMember, AuditLog, Subscription, Payment, TaxCalendarEvent, TaxDeadlineTemplate
    await prismaV2.organization.delete({ where: { id: orgId } });
    res.json({ success: true });
  } catch (error: any) {
    console.error("Delete org error:", error?.message, error?.code, error?.meta);
    res.status(500).json({ error: "Failed to delete organization", detail: error?.message });
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

// ─── V2 NEW ROUTES ───────────────────────────────────────────────────────────

// Create standalone organization
router.post("/v2/orgs", async (req: Request, res: Response) => {
  const { name, inn, taxRegime, isVatPayer } = req.body;
  if (!name) return res.status(400).json({ error: "Organization name is required" });
  if (taxRegime && !["VAT", "TURNOVER_TAX"].includes(taxRegime)) {
    return res.status(400).json({ error: "Invalid taxRegime. Use VAT or TURNOVER_TAX" });
  }
  try {
    const org = await prismaV2.organization.create({
      data: {
        name,
        inn: inn || null,
        taxRegime: taxRegime || "TURNOVER_TAX",
        isVatPayer: Boolean(isVatPayer),
        subscription: { create: { plan: "FREE" } }
      },
      include: { subscription: true }
    });
    res.json({ success: true, org });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to create organization" });
  }
});

// Update user name
router.patch("/v2/users/:userId", async (req: Request, res: Response) => {
  const { userId } = req.params;
  const { name } = req.body;
  if (name === undefined) return res.status(400).json({ error: "name is required" });
  try {
    const user = await prismaV2.user.update({ where: { id: userId }, data: { name: name || null } });
    res.json({ success: true, user });
  } catch (error: any) {
    res.status(404).json({ error: "User not found" });
  }
});

// Add user to organization
router.post("/v2/orgs/:orgId/members", async (req: Request, res: Response) => {
  const { orgId } = req.params;
  const { userId, role } = req.body;
  if (!userId || !role) return res.status(400).json({ error: "userId and role are required" });
  if (!["OWNER", "ADMIN", "ACCOUNTANT"].includes(role)) {
    return res.status(400).json({ error: "Invalid role. Use OWNER, ADMIN, or ACCOUNTANT" });
  }
  try {
    const member = await prismaV2.orgMember.create({
      data: { orgId, userId, role },
      include: { user: { select: { id: true, email: true, name: true } } }
    });
    res.json({ success: true, member });
  } catch (error: any) {
    if (error.code === "P2002") return res.status(409).json({ error: "User is already a member of this organization" });
    if (error.code === "P2003") return res.status(404).json({ error: "User or organization not found" });
    res.status(500).json({ error: error.message || "Failed to add member" });
  }
});

// Change member role in organization
router.patch("/v2/orgs/:orgId/members/:userId/role", async (req: Request, res: Response) => {
  const { orgId, userId } = req.params;
  const { role } = req.body;
  if (!["OWNER", "ADMIN", "ACCOUNTANT"].includes(role)) {
    return res.status(400).json({ error: "Invalid role. Use OWNER, ADMIN, or ACCOUNTANT" });
  }
  try {
    const member = await prismaV2.orgMember.update({
      where: { userId_orgId: { userId, orgId } },
      data: { role }
    });
    res.json({ success: true, member });
  } catch (error: any) {
    res.status(404).json({ error: "Member not found" });
  }
});

// Create bank account for org
router.post("/v2/orgs/:orgId/bank-accounts", async (req: Request, res: Response) => {
  const { orgId } = req.params;
  const { name, currency, bankName, accountNumber } = req.body;
  if (!name) return res.status(400).json({ error: "Account name is required" });
  try {
    const account = await prismaV2.bankAccount.create({
      data: { orgId, name, currency: currency || "UZS", bankName: bankName || null, accountNumber: accountNumber || null }
    });
    res.json({ success: true, account });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to create bank account" });
  }
});

// Edit bank account
router.patch("/v2/bank-accounts/:accountId", async (req: Request, res: Response) => {
  const { accountId } = req.params;
  const { name, currency, bankName, accountNumber } = req.body;
  const data: any = {};
  if (name !== undefined) data.name = name;
  if (currency !== undefined) data.currency = currency;
  if (bankName !== undefined) data.bankName = bankName;
  if (accountNumber !== undefined) data.accountNumber = accountNumber;
  try {
    const account = await prismaV2.bankAccount.update({ where: { id: accountId }, data });
    res.json({ success: true, account });
  } catch (error: any) {
    res.status(404).json({ error: "Bank account not found" });
  }
});

// Create period for org
router.post("/v2/orgs/:orgId/periods", async (req: Request, res: Response) => {
  const { orgId } = req.params;
  const { year, month, mode } = req.body;
  if (!year || !month) return res.status(400).json({ error: "year and month are required" });
  if (mode && !["HISTORICAL", "ACTIVE"].includes(mode)) {
    return res.status(400).json({ error: "Invalid mode. Use HISTORICAL or ACTIVE" });
  }
  try {
    const period = await prismaV2.period.create({
      data: { orgId, year: parseInt(year), month: parseInt(month), mode: mode || "ACTIVE" }
    });
    res.json({ success: true, period });
  } catch (error: any) {
    if (error.code === "P2002") return res.status(409).json({ error: "Period already exists for this year/month" });
    res.status(500).json({ error: error.message || "Failed to create period" });
  }
});

// Delete period
router.delete("/v2/periods/:periodId", async (req: Request, res: Response) => {
  try {
    await prismaV2.period.delete({ where: { id: req.params.periodId } });
    res.json({ success: true });
  } catch (error: any) {
    res.status(404).json({ error: "Period not found" });
  }
});

// List counterparties for org
router.get("/v2/orgs/:orgId/counterparties", async (req: Request, res: Response) => {
  const { orgId } = req.params;
  const counterparties = await prismaV2.counterparty.findMany({
    where: { orgId },
    include: { _count: { select: { journalEntries: true } } },
    orderBy: { name: "asc" }
  });
  res.json(counterparties);
});

// V2 Payments list
router.get("/v2/payments", async (req: Request, res: Response) => {
  const { orgId, status, from, to, page = "1" } = req.query;
  const take = 50;
  const skip = (parseInt(page as string) - 1) * take;
  const where: any = {};
  if (orgId) where.orgId = orgId;
  if (status) where.status = status;
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = new Date(from as string);
    if (to) where.createdAt.lte = new Date(to as string);
  }
  const [payments, total] = await Promise.all([
    prismaV2.payment.findMany({
      where,
      include: { org: { select: { name: true, inn: true } } },
      orderBy: { createdAt: "desc" },
      take, skip
    }),
    prismaV2.payment.count({ where })
  ]);
  res.json({ payments, total, page: parseInt(page as string), pages: Math.ceil(total / take) });
});

// V2 Vouchers list
router.get("/v2/vouchers", async (req: Request, res: Response) => {
  const { used } = req.query;
  const where: any = {};
  if (used === "true") where.usedAt = { not: null };
  if (used === "false") where.usedAt = null;
  const vouchers = await prismaV2.voucher.findMany({
    where,
    include: { org: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 200
  });
  res.json(vouchers);
});

// Generate V2 vouchers
router.post("/v2/vouchers/generate", async (req: Request, res: Response) => {
  const { count = 10, daysGranted = 365 } = req.body;
  const n = Math.min(parseInt(count), 100);
  const days = parseInt(daysGranted);
  const vouchers = Array.from({ length: n }, () => ({
    code: `CV2-${randomBytes(3).toString("hex").toUpperCase()}-${randomBytes(3).toString("hex").toUpperCase()}`,
    daysGranted: days
  }));
  await prismaV2.voucher.createMany({ data: vouchers });
  res.json({ success: true, count: n, vouchers });
});

// Apply V2 voucher to org
router.post("/v2/vouchers/:code/apply", async (req: Request, res: Response) => {
  const { code } = req.params;
  const { orgId } = req.body;
  if (!orgId) return res.status(400).json({ error: "orgId is required" });
  const voucher = await prismaV2.voucher.findUnique({ where: { code } });
  if (!voucher) return res.status(404).json({ error: "Voucher not found" });
  if (voucher.usedAt) return res.status(409).json({ error: "Voucher already used" });

  const sub = await prismaV2.subscription.findUnique({ where: { orgId } });
  const baseDate = (sub?.plan === "PRO" && sub.validUntil && sub.validUntil > new Date()) ? sub.validUntil : new Date();
  const newValidUntil = new Date(baseDate);
  newValidUntil.setDate(newValidUntil.getDate() + voucher.daysGranted);

  await prismaV2.$transaction([
    prismaV2.voucher.update({
      where: { code },
      data: { usedByOrgId: orgId, usedAt: new Date() }
    }),
    prismaV2.subscription.upsert({
      where: { orgId },
      update: { plan: "PRO", validUntil: newValidUntil },
      create: { orgId, plan: "PRO", validUntil: newValidUntil }
    })
  ]);

  res.json({ success: true, validUntil: newValidUntil });
});

app.use("/admin/api", router);
app.use("/admin", express.static(path.join(__dirname, "public")));
app.use("/", express.static(path.join(__dirname, "public")));

app.listen(PORT, () => { console.log(`✅ Admin Portal running at http://localhost:${PORT}`); });

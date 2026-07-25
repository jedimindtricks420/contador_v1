"use client";

import { useEffect, useState } from "react";
import { CreditCard, Clock, AlertCircle, Tag, Sparkles, Lock } from "lucide-react";
import { BILLING } from "@/lib/constants";

interface SubscriptionData {
  plan: "FREE" | "PRO";
  validUntil: string | null;
  daysLeft: number | null;
  proPrice: number;
}

interface PaymentRecord {
  id: string;
  orgId: string;
  provider: string;
  amount: string;
  status: string;
  daysGranted: number;
  createdAt: string;
  completedAt: string | null;
}

const PROVIDER_LABELS: Record<string, string> = {
  PAYME: "Payme",
  CLICK: "Click",
  ALIF: "Alif",
};

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  SUCCESS: { label: "Оплачен", className: "bg-black text-white" },
  PENDING: { label: "Ожидает", className: "bg-gray-100 text-gray-600" },
  FAILED: { label: "Отменён", className: "bg-gray-100 text-gray-400" },
};

function formatPrice(sum: number) {
  return sum.toLocaleString("ru-RU") + " сум";
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default function ProfileClient() {
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [initiating, setInitiating] = useState<"PAYME" | "CLICK" | "ALIF" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [voucherCode, setVoucherCode] = useState("");
  const [voucherLoading, setVoucherLoading] = useState(false);
  const [voucherError, setVoucherError] = useState<string | null>(null);
  const [voucherSuccess, setVoucherSuccess] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/v2/api/payments/subscription").then((r) => r.json()),
      fetch("/v2/api/payments/history").then((r) => r.json()),
    ])
      .then(([sub, hist]) => {
        if (!sub.error) setSubscription(sub);
        if (Array.isArray(hist)) setPayments(hist);
      })
      .catch(() => setError("Не удалось загрузить данные"))
      .finally(() => setLoading(false));
  }, []);

  const handlePayment = async (provider: "PAYME" | "CLICK" | "ALIF") => {
    setInitiating(provider);
    setError(null);
    try {
      const res = await fetch("/v2/api/payments/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError(data.error || "Ошибка инициации платежа");
        setInitiating(null);
      }
    } catch {
      setError("Ошибка соединения");
      setInitiating(null);
    }
  };

  const handleVoucher = async () => {
    if (!voucherCode.trim()) return;
    setVoucherLoading(true);
    setVoucherError(null);
    setVoucherSuccess(null);
    try {
      const res = await fetch("/v2/api/payments/voucher", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: voucherCode }),
      });
      const data = await res.json();
      if (data.success) {
        const until = new Date(data.validUntil).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
        setVoucherSuccess(`Активировано +${data.daysGranted} дн. Подписка действует до ${until}`);
        setVoucherCode("");
        // Refresh subscription data
        fetch("/v2/api/payments/subscription").then(r => r.json()).then(sub => { if (!sub.error) setSubscription(sub); });
        fetch("/v2/api/payments/history").then(r => r.json()).then(hist => { if (Array.isArray(hist)) setPayments(hist); });
      } else {
        setVoucherError(data.error || "Ошибка активации ваучера");
      }
    } catch {
      setVoucherError("Ошибка соединения");
    } finally {
      setVoucherLoading(false);
    }
  };

  const isPro =
    subscription?.plan === "PRO" &&
    subscription.validUntil != null &&
    new Date(subscription.validUntil) > new Date();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
        Загрузка...
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold text-gray-900 mb-8">Профиль</h1>

      {/* Subscription status cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">
            Текущий тариф
          </p>
          <div className="flex items-center gap-3">
            <span
              className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${
                isPro ? "bg-black text-white" : "bg-gray-100 text-gray-600"
              }`}
            >
              {subscription?.plan ?? "FREE"}
            </span>
          </div>
          {isPro && (
            <p className="text-xs text-gray-400 mt-2">
              Осталось {subscription!.daysLeft} дн.
            </p>
          )}
          {!isPro && (
            <p className="text-xs text-gray-400 mt-2">Базовый бесплатный доступ</p>
          )}
          {isPro && (
            <p className="text-xs text-green-500 mt-2 flex items-center gap-1">
              <Sparkles size={12} /> ИИ-функции активны
            </p>
          )}
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">
            Действителен до
          </p>
          {isPro && subscription?.validUntil ? (
            <p className="text-lg font-semibold text-gray-900">
              {formatDate(subscription.validUntil)}
            </p>
          ) : (
            <p className="text-lg text-gray-300">—</p>
          )}
        </div>
      </div>

      {/* AI restrictions banner for FREE users */}
      {!isPro && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 mb-8">
          <div className="flex items-start gap-3">
            <Lock size={18} strokeWidth={1.5} className="text-gray-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-gray-900 mb-2">Функции, доступные на PRO</p>
              <ul className="space-y-1.5">
                {[
                  "ИИ-классификация банковских транзакций",
                  "ИИ-сверка с данными Soliq",
                  "Создание нескольких организаций",
                ].map((feature) => (
                  <li key={feature} className="flex items-center gap-2 text-sm text-gray-500">
                    <span className="w-1 h-1 rounded-full bg-gray-300 flex-shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Payment section */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-8">
        <div className="flex items-center gap-2 mb-1">
          <CreditCard size={18} strokeWidth={1.5} className="text-gray-500" />
          <h2 className="text-sm font-semibold text-gray-900">
            {isPro ? "Продлить подписку PRO" : "Перейти на PRO"}
          </h2>
        </div>
        <p className="text-sm text-gray-400 mb-6">
          {subscription ? formatPrice(subscription.proPrice) : formatPrice(BILLING.DEFAULT_PRO_PRICE_YEARLY)} / год · {BILLING.DEFAULT_PRO_DURATION_DAYS} дней доступа
        </p>

        {error && (
          <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-4 py-3 mb-4">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Payme button */}
          <button
            onClick={() => handlePayment("PAYME")}
            disabled={initiating !== null}
            className="flex items-center gap-4 px-5 py-4 border border-gray-200 rounded-xl hover:border-black hover:shadow-sm transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <img src="/v2/1payme.png" alt="Payme" className="w-10 h-10 rounded-xl object-cover flex-shrink-0" />
            <div className="min-w-0">
              <p className="font-semibold text-sm text-gray-900">Payme</p>
              <p className="text-xs text-gray-400">Мгновенная оплата</p>
            </div>
            {initiating === "PAYME" && (
              <div className="ml-auto w-4 h-4 border-2 border-gray-300 border-t-black rounded-full animate-spin" />
            )}
          </button>

          {/* Click button */}
          <button
            onClick={() => handlePayment("CLICK")}
            disabled={initiating !== null}
            className="flex items-center gap-4 px-5 py-4 border border-gray-200 rounded-xl hover:border-black hover:shadow-sm transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <img src="/v2/1click.png" alt="Click" className="w-10 h-10 rounded-xl object-cover flex-shrink-0" />
            <div className="min-w-0">
              <p className="font-semibold text-sm text-gray-900">Click</p>
              <p className="text-xs text-gray-400">Мобильное приложение</p>
            </div>
            {initiating === "CLICK" && (
              <div className="ml-auto w-4 h-4 border-2 border-gray-300 border-t-black rounded-full animate-spin" />
            )}
          </button>

          {/* Alif button */}
          <button
            onClick={() => handlePayment("ALIF")}
            disabled={initiating !== null}
            className="flex items-center gap-4 px-5 py-4 border border-gray-200 rounded-xl hover:border-black hover:shadow-sm transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <img src="/v2/1alif.png" alt="Alif" className="w-10 h-10 rounded-xl object-cover flex-shrink-0" />
            <div className="min-w-0">
              <p className="font-semibold text-sm text-gray-900">Alif</p>
              <p className="text-xs text-gray-400">Карта / приложение Alif</p>
            </div>
            {initiating === "ALIF" && (
              <div className="ml-auto w-4 h-4 border-2 border-gray-300 border-t-black rounded-full animate-spin" />
            )}
          </button>
        </div>
      </div>

      {/* Voucher section */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-8">
        <div className="flex items-center gap-2 mb-1">
          <Tag size={18} strokeWidth={1.5} className="text-gray-500" />
          <h2 className="text-sm font-semibold text-gray-900">Активировать ваучер</h2>
        </div>
        <p className="text-sm text-gray-400 mb-4">Введите код ваучера для добавления дней подписки PRO</p>

        {voucherError && (
          <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-4 py-3 mb-4">
            <AlertCircle size={16} />
            <span>{voucherError}</span>
          </div>
        )}
        {voucherSuccess && (
          <div className="text-sm text-green-700 bg-green-50 border border-green-100 rounded-lg px-4 py-3 mb-4">
            {voucherSuccess}
          </div>
        )}

        <div className="flex gap-2">
          <input
            type="text"
            value={voucherCode}
            onChange={e => setVoucherCode(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === "Enter" && handleVoucher()}
            placeholder="CV2-XXXXXX-XXXXXX"
            className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-mono outline-none focus:border-black transition-colors"
            disabled={voucherLoading}
          />
          <button
            onClick={handleVoucher}
            disabled={voucherLoading || !voucherCode.trim()}
            className="px-5 py-2.5 bg-black text-white text-sm font-semibold rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {voucherLoading && <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
            Применить
          </button>
        </div>
      </div>

      {/* Payment history */}
      {payments.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900">История платежей</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-6 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  Дата
                </th>
                <th className="text-left px-6 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  Способ
                </th>
                <th className="text-right px-6 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  Сумма
                </th>
                <th className="text-center px-6 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  Статус
                </th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p, i) => {
                const statusMeta = STATUS_LABELS[p.status] ?? { label: p.status, className: "bg-gray-100 text-gray-500" };
                return (
                  <tr
                    key={p.id}
                    className={i < payments.length - 1 ? "border-b border-gray-50" : ""}
                  >
                    <td className="px-6 py-4 text-gray-600">
                      {formatDate(p.createdAt)}
                    </td>
                    <td className="px-6 py-4 text-gray-900 font-medium">
                      {PROVIDER_LABELS[p.provider] ?? p.provider}
                    </td>
                    <td className="px-6 py-4 text-right text-gray-900">
                      {formatPrice(parseFloat(p.amount))}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${statusMeta.className}`}
                      >
                        {statusMeta.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {payments.length === 0 && !loading && (
        <div className="bg-white border border-gray-200 rounded-xl px-6 py-10 text-center">
          <Clock size={32} strokeWidth={1} className="text-gray-200 mx-auto mb-3" />
          <p className="text-sm text-gray-400">История платежей пуста</p>
        </div>
      )}
    </div>
  );
}

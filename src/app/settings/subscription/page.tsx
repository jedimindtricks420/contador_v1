"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { CreditCard, Zap, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

export default function SubscriptionPage() {
  const queryClient = useQueryClient();
  const [voucherCode, setVoucherCode] = useState("");

  const { data: usage, isLoading } = useQuery({
    queryKey: ["billing-usage"],
    queryFn: () => fetch("/api/billing/usage").then((res) => res.json()),
  });

  const activateVoucher = useMutation({
    mutationFn: (code: string) =>
      fetch("/api/billing/voucher/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      }).then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Ошибка активации");
        return data;
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["billing-usage"] });
      alert(`Ваучер успешно активирован! План PRO до ${new Date(data.valid_until).toLocaleDateString()}`);
      setVoucherCode("");
    },
    onError: (error: any) => {
      alert(error.message);
    }
  });

  if (isLoading) return <div className="p-8 animate-pulse text-gray-400 font-medium lowercase italic">загрузка данных подписки...</div>;

  const { subscription, usageCount, limit } = usage || {};
  const percentage = limit === Infinity ? 0 : Math.min((usageCount / limit) * 100, 100);

  return (
    <div className="max-w-3xl space-y-12 pb-20">
      <header>
        <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Подписка и лимиты</h2>
        <p className="text-sm text-gray-500 mt-2">Управление вашим тарифным планом и мониторинг потребления ИИ.</p>
      </header>

      {/* Main Status Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm flex flex-col justify-between">
            <div className="space-y-1">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Текущий тариф</p>
                <h3 className="text-3xl font-black text-gray-900">{subscription?.plan || "FREE"}</h3>
            </div>
            <div className="mt-8">
                {subscription?.plan === "PRO" ? (
                    <div className="flex items-center space-x-2 text-black font-bold text-sm">
                        <CheckCircle2 size={16} />
                        <span>Активен до {subscription.valid_until ? new Date(subscription.valid_until).toLocaleDateString() : "—"}</span>
                    </div>
                ) : subscription?.plan === "MYAPI" ? (
                    <div className="text-gray-400 font-bold text-sm uppercase tracking-widest">
                         Безлимитный доступ (BYOK)
                    </div>
                ) : (
                    <div className="text-gray-400 font-bold text-sm uppercase tracking-widest">
                        Бесплатный базовый доступ
                    </div>
                )}
            </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm flex flex-col justify-between text-black">
            <div className="space-y-2 text-black">
                <div className="flex justify-between items-end">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Использование ИИ</p>
                    <span className="text-xs font-bold text-gray-900">{usageCount} / {limit === Infinity ? "∞" : limit}</span>
                </div>
                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div 
                        className={`h-full transition-all duration-500 bg-black`}
                        style={{ width: `${percentage}%` }}
                    />
                </div>
                <p className="text-[10px] text-gray-400 mt-2">Лимиты обновляются 1-го числа каждого месяца.</p>
            </div>
        </div>
      </div>

      {/* Payment Options */}
      <div className="space-y-6">
          <h3 className="text-sm font-bold text-gray-900 uppercase tracking-widest">Пополнение баланса</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button 
                onClick={() => alert("Интеграция Payme в процессе.")}
                className="flex items-center justify-between p-6 bg-white border border-gray-200 rounded-xl hover:border-black transition-all group"
              >
                  <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 bg-gray-50 border border-gray-100 rounded-lg flex items-center justify-center text-black font-bold uppercase transition-colors group-hover:bg-black group-hover:text-white">P</div>
                      <div className="text-left">
                          <p className="font-bold text-sm">Payme</p>
                          <p className="text-[10px] text-gray-400 italic">Мгновенная оплата</p>
                      </div>
                  </div>
                  <div className="w-4 h-4 rounded-full border-2 border-gray-100 group-hover:border-black transition-colors" />
              </button>

              <button 
                onClick={() => alert("Интеграция Click в процессе.")}
                className="flex items-center justify-between p-6 bg-white border border-gray-200 rounded-xl hover:border-black transition-all group"
              >
                  <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 bg-gray-50 border border-gray-100 rounded-lg flex items-center justify-center text-black font-bold uppercase transition-colors group-hover:bg-black group-hover:text-white">C</div>
                      <div className="text-left">
                          <p className="font-bold text-sm">Click</p>
                          <p className="text-[10px] text-gray-400 italic">Мобильное приложение</p>
                      </div>
                  </div>
                  <div className="w-4 h-4 rounded-full border-2 border-gray-100 group-hover:border-black transition-colors" />
              </button>
          </div>
      </div>

      {/* Voucher Section */}
      <div className="bg-gray-50 rounded-2xl p-10 border border-gray-100 flex flex-col md:flex-row md:items-center justify-between space-y-6 md:space-y-0">
          <div className="max-w-xs">
              <h3 className="font-bold text-gray-900">У вас есть ваучер?</h3>
              <p className="text-xs text-gray-500 mt-1">Введите 12-значный код активации для мгновенного продления PRO-статуса.</p>
          </div>
          <div className="flex space-x-2">
              <input 
                type="text" 
                placeholder="CONT-XXXX-XXXX"
                value={voucherCode}
                onChange={(e) => setVoucherCode(e.target.value.toUpperCase())}
                className="px-4 py-3 border border-gray-200 rounded-xl text-sm font-mono focus:ring-1 focus:ring-black outline-none w-48 shadow-sm"
              />
              <button 
                disabled={!voucherCode || activateVoucher.isPending}
                onClick={() => activateVoucher.mutate(voucherCode)}
                className="px-8 py-3 bg-black text-white rounded-xl font-bold text-sm hover:opacity-90 transition-opacity disabled:bg-gray-200 shadow-lg"
              >
                {activateVoucher.isPending ? <Loader2 className="animate-spin" size={18} /> : "Активировать"}
              </button>
          </div>
      </div>

      {/* Info Alert */}
      <div className="flex items-start space-x-3 text-gray-400 text-xs leading-relaxed max-w-xl italic">
          <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
          <p>
              Подписка привязана к текущей организации. При переключении организации лимиты будут пересчитаны согласно её тарифному плану.
          </p>
      </div>
    </div>
  );
}

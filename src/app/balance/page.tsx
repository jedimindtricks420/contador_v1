"use client";

import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

interface BalanceData {
  assets: {
    items: Record<string, number>;
    total: number;
  };
  passives: {
    items: Record<string, number>;
    total: number;
  };
}

export default function BalancePage() {
  const { data, isLoading } = useQuery<BalanceData>({
    queryKey: ["balance"],
    queryFn: () => fetch("/api/reports/balance").then((res) => res.json()),
  });

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-gray-400">
        <Loader2 className="animate-spin mb-4" size={32} />
        <span className="text-sm font-medium uppercase tracking-widest">Сборка баланса...</span>
      </div>
    );
  }

  const assetLabels: Record<string, string> = {
    fixed: "Основные средства (нетто)",
    inventory: "Запасы и материалы",
    receivables: "Дебиторская задолженность",
    advances: "Авансы выданные",
    cash: "Денежные средства",
    finished: "Готовая продукция",
  };

  const passiveLabels: Record<string, string> = {
    payables: "Кредиторская задолженность",
    taxes: "Задолженность по налогам",
    social: "Социальное страхование",
    salary: "Задолженность по зарплате",
    equity: "Уставный капитал",
    retained: "Нераспределенная прибыль",
  };

  return (
    <div className="space-y-8">
      <header>
        <h2 className="text-xl font-bold text-gray-900">Бухгалтерский баланс</h2>
        <p className="text-sm text-gray-500 mt-1">Форма №1. Состояние активов и пассивов компании на текущую дату.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
        {/* Assets Side */}
        <div className="space-y-6">
          <div className="border-b border-black pb-2 flex justify-between items-end">
            <h3 className="text-sm font-bold uppercase tracking-widest">I. Активы</h3>
            <span className="text-[10px] text-gray-400 font-bold uppercase">Сумма (сум)</span>
          </div>
          <div className="space-y-4">
            {Object.entries(assetLabels).map(([key, label]) => (
              <div key={key} className="flex justify-between items-baseline text-sm">
                <span className="text-gray-600">{label}</span>
                <span className="font-medium border-b border-gray-100 flex-1 mx-4 h-3"></span>
                <span className="font-bold text-gray-900">{data?.assets.items[key].toLocaleString('ru-RU')}</span>
              </div>
            ))}
          </div>
          <div className="pt-4 border-t-2 border-black flex justify-between items-center bg-gray-50 px-4 py-2 rounded">
            <span className="text-xs font-bold uppercase tracking-widest text-gray-900">Итого Активы</span>
            <span className="text-lg font-bold text-black">{data?.assets.total.toLocaleString('ru-RU')}</span>
          </div>
        </div>

        {/* Passives Side */}
        <div className="space-y-6">
          <div className="border-b border-black pb-2 flex justify-between items-end">
            <h3 className="text-sm font-bold uppercase tracking-widest">II. Пассивы</h3>
            <span className="text-[10px] text-gray-400 font-bold uppercase">Сумма (сум)</span>
          </div>
          <div className="space-y-4">
            {Object.entries(passiveLabels).map(([key, label]) => (
              <div key={key} className="flex justify-between items-baseline text-sm">
                <span className="text-gray-600">{label}</span>
                <span className="font-medium border-b border-gray-100 flex-1 mx-4 h-3"></span>
                <span className="font-bold text-gray-900">{data?.passives.items[key].toLocaleString('ru-RU')}</span>
              </div>
            ))}
          </div>
          <div className="pt-4 border-t-2 border-black flex justify-between items-center bg-gray-50 px-4 py-2 rounded">
            <span className="text-xs font-bold uppercase tracking-widest text-gray-900">Итого Пассивы</span>
            <span className="text-lg font-bold text-black">{data?.passives.total.toLocaleString('ru-RU')}</span>
          </div>
        </div>
      </div>

      {/* Balance Check */}
      <div className="flex justify-center pt-10">
        <div className={`px-8 py-3 rounded-full border text-[10px] font-bold uppercase tracking-[0.2em] ${data?.assets.total === data?.passives.total ? 'bg-black text-white border-black' : 'bg-red-500 text-white border-red-500'}`}>
          {data?.assets.total === data?.passives.total ? 'Баланс сходится' : 'Ошибка: Баланс не сходится'}
        </div>
      </div>
    </div>
  );
}

"use client";

import { useQuery } from "@tanstack/react-query";
import { Loader2, ArrowRight } from "lucide-react";

interface PnLData {
  revenue: number;
  expenses: {
    marketing: number;
    admin: number;
    other: number;
    insurance: number;
    misc: number;
    total: number;
  };
  netProfit: number;
}

export default function PnLPage() {
  const { data, isLoading } = useQuery<PnLData>({
    queryKey: ["pnl"],
    queryFn: () => fetch("/api/reports/pnl").then((res) => res.json()),
  });

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-gray-400">
        <Loader2 className="animate-spin mb-4" size={32} />
        <span className="text-sm font-medium uppercase tracking-widest">Расчет финансовых результатов...</span>
      </div>
    );
  }

  const expenseItems = [
    { label: "Расходы на маркетинг", value: data?.expenses.marketing },
    { label: "Административные расходы", value: data?.expenses.admin },
    { label: "Прочие операционные расходы", value: data?.expenses.other },
    { label: "Расходы по страхованию", value: data?.expenses.insurance },
    { label: "Другие операционные расходы", value: data?.expenses.misc },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-12">
      <header className="border-b border-gray-100 pb-8">
        <h2 className="text-xl font-bold text-gray-900">Отчет о финансовых результатах</h2>
        <p className="text-sm text-gray-500 mt-1">Форма №2. Анализ доходов и расходов за весь период деятельности.</p>
      </header>

      <div className="space-y-10">
        {/* Revenue Section */}
        <section className="space-y-4">
          <div className="flex justify-between items-baseline">
            <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-gray-400">Доходы</h3>
            <span className="h-px bg-gray-100 flex-1 mx-4"></span>
          </div>
          <div className="flex justify-between items-center py-4 px-6 bg-gray-50 rounded-lg">
            <span className="text-sm font-medium text-gray-900">Выручка от реализации товаров и услуг</span>
            <span className="text-xl font-bold text-black font-mono">{data?.revenue.toLocaleString('ru-RU')}</span>
          </div>
        </section>

        {/* Expenses Section */}
        <section className="space-y-4">
          <div className="flex justify-between items-baseline">
            <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-gray-400">Расходы</h3>
            <span className="h-px bg-gray-100 flex-1 mx-4"></span>
          </div>
          <div className="space-y-1">
            {expenseItems.map((item) => (
              <div key={item.label} className="flex justify-between items-center py-3 px-6 hover:bg-gray-50 transition-colors rounded">
                <span className="text-sm text-gray-600">{item.label}</span>
                <span className="text-sm font-bold text-gray-900 font-mono">{item.value?.toLocaleString('ru-RU')}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-gray-200 flex justify-between items-center px-6">
            <span className="text-xs font-bold uppercase text-gray-400 italic">Итого операционные расходы</span>
            <span className="text-sm font-bold text-gray-900 font-mono">{data?.expenses.total.toLocaleString('ru-RU')}</span>
          </div>
        </section>

        {/* Result Section */}
        <section className="pt-8 border-t-2 border-black">
          <div className="flex justify-between items-center p-8 bg-black text-white rounded-lg shadow-xl">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-[0.3em] opacity-60">Чистая прибыль / Убыток</h3>
              <p className="text-[10px] mt-1 opacity-40">После вычета всех операционных расходов</p>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-4xl font-bold tracking-tighter">{data?.netProfit.toLocaleString('ru-RU')}</span>
              <span className="text-[10px] font-medium uppercase mt-2 px-2 py-0.5 bg-white/10 rounded">Валюта: СУМ</span>
            </div>
          </div>
        </section>
      </div>

      <footer className="pt-20 text-center">
          <div className="inline-flex items-center space-x-2 text-[10px] font-bold text-gray-300 uppercase tracking-widest border border-gray-100 px-4 py-2 rounded-full">
            <span>Конец отчета</span>
            <ArrowRight size={10} />
          </div>
      </footer>
    </div>
  );
}

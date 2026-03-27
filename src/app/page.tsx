"use client";

import { useQuery } from "@tanstack/react-query";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer,
} from "recharts";
import { Loader2, ArrowUpRight, ArrowDownRight, TrendingUp, TrendingDown, Wallet, Minus, Users } from "lucide-react";

interface DashboardData {
  metrics: {
    revenue: number;
    expenses: number;
    profit: number;
    margin: number;
    bank: number;
    ar: number;
  };
  expensesByAccount: Array<{
    code: string;
    name: string;
    amount: number;
  }>;
  chartData: Array<{
    period: string;
    revenue: number;
    expenses: number;
  }>;
}

export default function DashboardPage() {
  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ["dashboard"],
    queryFn: () => fetch("/api/reports/dashboard").then((res) => res.json()),
  });

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-gray-400">
        <Loader2 className="animate-spin mb-4" size={32} />
        <span className="text-sm font-medium uppercase tracking-widest">Загрузка аналитики...</span>
      </div>
    );
  }

  const metrics = data?.metrics;

  const cards = [
    { name: "Выручка", value: metrics?.revenue, sub: "Всего по счету 9010", icon: ArrowUpRight },
    { name: "Расходы", value: metrics?.expenses, sub: "Операционные (94*)", icon: ArrowDownRight },
    { name: "Чистая прибыль", value: metrics?.profit, sub: "Выручка - Расходы", icon: metrics?.profit && metrics.profit >= 0 ? TrendingUp : TrendingDown },
    { name: "Маржинальность", value: metrics?.margin, unit: "%", sub: "Рентабельность продаж", icon: Minus },
    { name: "Деньги в банке", value: metrics?.bank, sub: "Сальдо счета 5110", icon: Wallet },
    { name: "Дебиторка", value: metrics?.ar, sub: "Задолженность клиентов (4010)", icon: Users },
  ];

  return (
    <div className="space-y-10">
      <header>
        <h2 className="text-xl font-bold text-gray-900 uppercase">Дашборд</h2>
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Финансовые показатели в реальном времени</p>
      </header>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.name} className="bg-white border border-gray-200 p-6 rounded shadow-sm">
              <div className="flex justify-between items-start">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{card.name}</span>
                <Icon size={14} className="text-gray-300" />
              </div>
              <div className="text-2xl font-bold mt-2 tracking-tight text-black">
                {card.value?.toLocaleString('ru-RU', { minimumFractionDigits: 0 })}
                {card.unit && <span className="text-sm ml-1 font-medium">{card.unit}</span>}
              </div>
              <div className="text-[9px] font-bold text-gray-300 mt-2 uppercase tracking-tight">{card.sub}</div>
            </div>
          );
        })}
      </div>

      {/* Structure & Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 bg-white border border-gray-200 p-6 rounded shadow-sm">
          <h3 className="text-xs font-bold text-gray-900 uppercase tracking-widest mb-6">Структура расходов</h3>
          <table className="w-full text-left">
             <tbody className="divide-y divide-gray-100">
                {data?.expensesByAccount.map(exp => (
                    <tr key={exp.code} className="text-[11px]">
                        <td className="py-2.5 text-gray-400 font-bold">{exp.code}</td>
                        <td className="py-2.5 text-gray-600 font-medium truncate max-w-[120px]">{exp.name}</td>
                        <td className="py-2.5 text-right font-bold text-black">{exp.amount.toLocaleString('ru-RU')}</td>
                    </tr>
                ))}
                {(!data?.expensesByAccount || data.expensesByAccount.length === 0) && (
                    <tr><td colSpan={3} className="py-10 text-center text-gray-300 italic font-medium">Нет данных</td></tr>
                )}
             </tbody>
          </table>
        </div>

        <div className="lg:col-span-2 bg-white border border-gray-200 p-6 rounded shadow-sm">
           <h3 className="text-xs font-bold text-gray-900 uppercase tracking-widest mb-10">Динамика выручки и расходов</h3>
           <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.chartData}>
                <XAxis dataKey="period" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#D1D5DB' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#D1D5DB' }} />
                <Tooltip cursor={{ fill: '#F9FAFB' }} contentStyle={{ border: '1px solid #E5E7EB', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold' }} />
                <Bar dataKey="revenue" fill="#000000" radius={[2, 2, 0, 0]} barSize={24} />
                <Bar dataKey="expenses" fill="#E5E7EB" radius={[2, 2, 0, 0]} barSize={24} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

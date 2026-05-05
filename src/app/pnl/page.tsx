"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2, ArrowRight } from "lucide-react";

interface PnLData {
  year: number;
  period: string | null;
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

function buildPnLUrl(year: string, month: string): string {
  const url = `/api/reports/pnl?year=${year}`;
  if (month && month !== "00") {
    return `${url}&period=${month.padStart(2, "0")}.${year}`;
  }
  return url;
}

export default function PnLPage() {
  const currentYear = new Date().getFullYear();
  const [year, setYear]   = useState(String(currentYear));
  const [month, setMonth] = useState("00"); // 00 = весь год

  const apiUrl = buildPnLUrl(year, month);

  const { data, isLoading } = useQuery<PnLData>({
    queryKey: ["pnl", year, month],
    queryFn: () => fetch(apiUrl).then((res) => res.json()),
    enabled: !!year,
  });

  const expenseItems = [
    { label: "Расходы на маркетинг",        value: data?.expenses.marketing },
    { label: "Административные расходы",     value: data?.expenses.admin },
    { label: "Прочие операционные расходы",  value: data?.expenses.other },
    { label: "Расходы по страхованию",       value: data?.expenses.insurance },
    { label: "Другие операционные расходы",  value: data?.expenses.misc },
  ];

  const periodLabel =
    month !== "00"
      ? `${month.padStart(2, "0")}.${year}`
      : `Весь ${year} год`;

  return (
    <div className="max-w-4xl mx-auto space-y-12">
      <header className="border-b border-gray-100 pb-8 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">
            Отчет о финансовых результатах
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Форма №2. Период: <span className="font-bold text-gray-800">{periodLabel}</span>
          </p>
        </div>

        {/* Фильтр периода */}
        <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
              Год
            </label>
            <select
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="text-sm font-bold bg-transparent outline-none cursor-pointer"
            >
              {Array.from({ length: 5 }, (_, i) => currentYear - i).map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
          <div className="w-px h-8 bg-gray-200" />
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
              Месяц
            </label>
            <select
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="text-sm font-bold bg-transparent outline-none cursor-pointer"
            >
              <option value="00">Весь год</option>
              {[
                ["01","Январь"],["02","Февраль"],["03","Март"],
                ["04","Апрель"],["05","Май"],["06","Июнь"],
                ["07","Июль"],["08","Август"],["09","Сентябрь"],
                ["10","Октябрь"],["11","Ноябрь"],["12","Декабрь"],
              ].map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>
        </div>
      </header>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center h-[40vh] text-gray-400">
          <Loader2 className="animate-spin mb-4" size={32} />
          <span className="text-sm font-medium uppercase tracking-widest">
            Расчет финансовых результатов...
          </span>
        </div>
      ) : (
        <div className="space-y-10">
          {/* Revenue Section */}
          <section className="space-y-4">
            <div className="flex justify-between items-baseline">
              <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-gray-400">
                Доходы
              </h3>
              <span className="h-px bg-gray-100 flex-1 mx-4"></span>
            </div>
            <div className="flex justify-between items-center py-4 px-6 bg-gray-50 rounded-lg">
              <span className="text-sm font-medium text-gray-900">
                Выручка от реализации товаров и услуг
              </span>
              <span className="text-xl font-bold text-black font-mono">
                {data?.revenue.toLocaleString("ru-RU") ?? "—"}
              </span>
            </div>
          </section>

          {/* Expenses Section */}
          <section className="space-y-4">
            <div className="flex justify-between items-baseline">
              <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-gray-400">
                Расходы
              </h3>
              <span className="h-px bg-gray-100 flex-1 mx-4"></span>
            </div>
            <div className="space-y-1">
              {expenseItems.map((item) => (
                <div
                  key={item.label}
                  className="flex justify-between items-center py-3 px-6 hover:bg-gray-50 transition-colors rounded"
                >
                  <span className="text-sm text-gray-600">{item.label}</span>
                  <span
                    className={`text-sm font-bold font-mono ${
                      (item.value ?? 0) < 0
                        ? "text-red-500"
                        : "text-gray-900"
                    }`}
                  >
                    {item.value?.toLocaleString("ru-RU") ?? "—"}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-gray-200 flex justify-between items-center px-6">
              <span className="text-xs font-bold uppercase text-gray-400 italic">
                Итого операционные расходы
              </span>
              <span className="text-sm font-bold text-gray-900 font-mono">
                {data?.expenses.total.toLocaleString("ru-RU") ?? "—"}
              </span>
            </div>
          </section>

          {/* Result Section */}
          <section className="pt-8 border-t-2 border-black">
            <div
              className={`flex justify-between items-center p-8 rounded-lg shadow-xl ${
                (data?.netProfit ?? 0) >= 0
                  ? "bg-black text-white"
                  : "bg-red-600 text-white"
              }`}
            >
              <div>
                <h3 className="text-xs font-bold uppercase tracking-[0.3em] opacity-60">
                  Чистая прибыль / Убыток
                </h3>
                <p className="text-[10px] mt-1 opacity-40">
                  {periodLabel}
                </p>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-4xl font-bold tracking-tighter">
                  {data?.netProfit.toLocaleString("ru-RU") ?? "—"}
                </span>
                <span className="text-[10px] font-medium uppercase mt-2 px-2 py-0.5 bg-white/10 rounded">
                  Валюта: СУМ
                </span>
              </div>
            </div>
          </section>
        </div>
      )}

      <footer className="pt-20 text-center">
        <div className="inline-flex items-center space-x-2 text-[10px] font-bold text-gray-300 uppercase tracking-widest border border-gray-100 px-4 py-2 rounded-full">
          <span>Конец отчета</span>
          <ArrowRight size={10} />
        </div>
      </footer>
    </div>
  );
}

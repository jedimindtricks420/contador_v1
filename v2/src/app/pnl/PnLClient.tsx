"use client";
import { useEffect, useState } from "react";
import { formatSum } from "@/lib/format";

interface PnLLine {
  line: string;
  amounts: number[];
  total: number;
}

interface PnLData {
  months: string[];
  revenue: PnLLine[];
  expenses: PnLLine[];
  profitBeforeTax: number[];
  tax: number[];
  netProfit: number[];
  taxRegime?: string;
}

const MONTH_NAMES_RU: Record<string, string> = {
  "01": "Январь", "02": "Февраль", "03": "Март", "04": "Апрель", "05": "Май", "06": "Июнь",
  "07": "Июль", "08": "Август", "09": "Сентябрь", "10": "Октябрь", "11": "Ноябрь", "12": "Декабрь"
};

function formatMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split("-");
  return `${MONTH_NAMES_RU[month] || month} ${year}`;
}

function formatPnLSum(amount: number): React.ReactNode {
  const val = Math.round(amount);
  if (val < 0) {
    return <span className="text-rose-600">({new Intl.NumberFormat("ru-RU").format(Math.abs(val))} сум)</span>;
  }
  return <span>{new Intl.NumberFormat("ru-RU").format(val)} сум</span>;
}

export default function PnLClient() {
  const [data, setData] = useState<PnLData | null>(null);
  const [periodType, setPeriodType] = useState<string>("YEAR"); // YEAR, QUARTER, CUSTOM
  
  // Custom range
  const now = new Date();
  const [fromStr, setFromStr] = useState<string>(`${now.getFullYear()}-01-01`);
  const [toStr, setToStr] = useState<string>(`${now.getFullYear()}-12-31`);

  const [loading, setLoading] = useState(true);

  const loadReport = async () => {
    setLoading(true);
    try {
      let fromDate = fromStr;
      let toDate = toStr;

      const year = now.getFullYear();
      if (periodType === "YEAR") {
        fromDate = `${year}-01-01`;
        toDate = `${year}-12-31`;
      } else if (periodType === "QUARTER") {
        const currentMonth = now.getMonth();
        const quarter = Math.floor(currentMonth / 3);
        const startMonth = String(quarter * 3 + 1).padStart(2, "0");
        const endMonth = String(quarter * 3 + 3).padStart(2, "0");
        fromDate = `${year}-${startMonth}-01`;
        toDate = `${year}-${endMonth}-31`;
      }

      const params = new URLSearchParams();
      params.append("from", fromDate);
      params.append("to", toDate);

      const res = await fetch(`/v2/api/pnl?${params.toString()}`);
      const reportData = await res.json();
      setData(reportData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, [periodType, fromStr, toStr]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-[300px] text-gray-500 font-medium">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black mr-3"></div>
        Загрузка отчёта P&L...
      </div>
    );
  }

  // Row selectors
  const salesRevenue = data?.revenue.find((r) => r.line === "Выручка от продаж") || { amounts: [], total: 0 };
  const salesVat = data?.revenue.find((r) => r.line === "НДС к уплате") || { amounts: [], total: 0 };
  const netRevenue = data?.revenue.find((r) => r.line === "Выручка без НДС") || { amounts: [], total: 0 };
  const otherIncome = data?.revenue.find((r) => r.line === "Прочие операционные доходы") || { amounts: [] as number[], total: 0 };

  const totalExpenseByMonth = data
    ? data.months.map((_, idx) => data.expenses.reduce((sum, cat) => sum + cat.amounts[idx], 0))
    : [];
  const grandTotalExpense = totalExpenseByMonth.reduce((sum, val) => sum + val, 0);

  const profitBeforeTaxTotal = data?.profitBeforeTax.reduce((sum, val) => sum + val, 0) || 0;
  const taxTotal = data?.tax.reduce((sum, val) => sum + val, 0) || 0;
  const netProfitTotal = data?.netProfit.reduce((sum, val) => sum + val, 0) || 0;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header & Filter */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-6 border-b border-gray-200">
        <div>
          <h1 className="text-xl font-bold text-gray-900 uppercase">P&L (Прибыли и убытки)</h1>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Отчет о финансовых результатах (метод начисления)</p>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-gray-700 w-full md:w-auto">
          {/* Period Selection */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-gray-400">Период:</span>
            <select
              value={periodType}
              onChange={(e) => setPeriodType(e.target.value)}
              className="bg-white border border-gray-200 rounded px-2.5 py-1.5 outline-hidden focus:border-black font-semibold text-gray-700"
            >
              <option value="YEAR">Текущий год</option>
              <option value="QUARTER">Текущий квартал</option>
              <option value="CUSTOM">Произвольный диапазон</option>
            </select>
          </div>

          {periodType === "CUSTOM" && (
            <div className="flex items-center gap-2 pt-5">
              <input
                type="date"
                value={fromStr}
                onChange={(e) => setFromStr(e.target.value)}
                className="bg-white border border-gray-200 rounded px-2 py-1 outline-hidden focus:border-black text-gray-700 font-semibold"
              />
              <span className="text-gray-400">-</span>
              <input
                type="date"
                value={toStr}
                onChange={(e) => setToStr(e.target.value)}
                className="bg-white border border-gray-200 rounded px-2 py-1 outline-hidden focus:border-black text-gray-700 font-semibold"
              />
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      {data && (
        <div className="bg-white border border-gray-200 rounded overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-gray-50 text-gray-500 border-b border-gray-200 font-bold">
                  <th className="p-3.5 min-w-[240px]">Статьи доходов и расходов</th>
                  {data.months.map((m) => (
                    <th key={m} className="p-3.5 text-right whitespace-nowrap">
                      {formatMonthLabel(m)}
                    </th>
                  ))}
                  <th className="p-3.5 text-right min-w-[120px]">Итого за период</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-medium">
                {/* REVENUE SECTION */}
                <tr className="bg-gray-50/30">
                  <td className="p-3.5 font-black text-gray-800 text-[13px] uppercase tracking-wider" colSpan={data.months.length + 2}>
                    Выручка
                  </td>
                </tr>
                <tr className="hover:bg-gray-50/50 text-gray-700">
                  <td className="p-3.5 pl-6 font-semibold">Выручка от продаж</td>
                  {salesRevenue.amounts.map((amt, idx) => (
                    <td key={idx} className="p-3.5 text-right font-mono">
                      {formatPnLSum(amt)}
                    </td>
                  ))}
                  <td className="p-3.5 text-right font-bold text-gray-800 bg-gray-50/20">
                    {formatPnLSum(salesRevenue.total)}
                  </td>
                </tr>
                <tr className="hover:bg-gray-50/50 text-gray-700">
                  <td className="p-3.5 pl-6 font-semibold">НДС к уплате</td>
                  {salesVat.amounts.map((amt, idx) => (
                    <td key={idx} className="p-3.5 text-right font-mono">
                      {formatPnLSum(-amt)}
                    </td>
                  ))}
                  <td className="p-3.5 text-right font-bold text-gray-800 bg-gray-50/20">
                    {formatPnLSum(-salesVat.total)}
                  </td>
                </tr>
                <tr className="bg-gray-50/20 text-gray-800 font-bold border-t border-gray-200">
                  <td className="p-3.5 pl-6 font-bold text-gray-800">Выручка без НДС</td>
                  {netRevenue.amounts.map((amt, idx) => (
                    <td key={idx} className="p-3.5 text-right font-bold">
                      {formatPnLSum(amt)}
                    </td>
                  ))}
                  <td className="p-3.5 text-right font-extrabold text-gray-900 bg-gray-50/40">
                    {formatPnLSum(netRevenue.total)}
                  </td>
                </tr>
                {otherIncome.total !== 0 && (
                  <tr className="hover:bg-gray-50/50 text-gray-700">
                    <td className="p-3.5 pl-6 font-semibold">Прочие доходы (курсовые, операционные)</td>
                    {otherIncome.amounts.map((amt, idx) => (
                      <td key={idx} className="p-3.5 text-right font-mono">
                        {formatPnLSum(amt)}
                      </td>
                    ))}
                    <td className="p-3.5 text-right font-bold text-gray-800 bg-gray-50/20">
                      {formatPnLSum(otherIncome.total)}
                    </td>
                  </tr>
                )}

                {/* EXPENSES SECTION */}
                <tr className="bg-gray-50/30">
                  <td className="p-3.5 font-black text-gray-800 text-[13px] uppercase tracking-wider" colSpan={data.months.length + 2}>
                    Расходы
                  </td>
                </tr>
                {data.expenses
                  .filter((cat) => !(cat.line === "Налог на прибыль (начислен)" && data.taxRegime === "TURNOVER_TAX"))
                  .map((cat) => (
                  <tr key={cat.line} className="hover:bg-gray-50/50 text-gray-600">
                    <td className="p-3.5 pl-6 font-semibold text-gray-700">{cat.line}</td>
                    {cat.amounts.map((amt, idx) => (
                      <td key={idx} className="p-3.5 text-right font-mono">
                        {formatPnLSum(-amt)}
                      </td>
                    ))}
                    <td className="p-3.5 text-right font-bold text-gray-800 bg-gray-50/20">
                      {formatPnLSum(-cat.total)}
                    </td>
                  </tr>
                ))}
                <tr className="bg-gray-50/20 text-gray-800 font-bold border-t border-gray-200">
                  <td className="p-3.5 pl-6 font-bold text-gray-800">Итого расходы</td>
                  {totalExpenseByMonth.map((sum, idx) => (
                    <td key={idx} className="p-3.5 text-right font-bold">
                      {formatPnLSum(-sum)}
                    </td>
                  ))}
                  <td className="p-3.5 text-right font-extrabold text-gray-900 bg-gray-50/40">
                    {formatPnLSum(-grandTotalExpense)}
                  </td>
                </tr>

                {/* RESULTS */}
                <tr className="bg-gray-100/30 font-bold border-t-2 border-gray-200">
                  <td className="p-4 text-gray-800 font-bold text-sm">Прибыль до налогообложения</td>
                  {data.profitBeforeTax.map((val, idx) => (
                    <td key={idx} className="p-4 text-right font-bold text-gray-800">
                      {formatPnLSum(val)}
                    </td>
                  ))}
                  <td className="p-4 text-right font-extrabold text-gray-900 bg-gray-100/50">
                    {formatPnLSum(profitBeforeTaxTotal)}
                  </td>
                </tr>
                <tr className="hover:bg-gray-50/50 text-gray-700">
                  <td className="p-3.5 pl-6 font-semibold text-gray-700">Налог на прибыль / с оборота</td>
                  {data.tax.map((amt, idx) => (
                    <td key={idx} className="p-3.5 text-right font-mono">
                      {formatPnLSum(-amt)}
                    </td>
                  ))}
                  <td className="p-3.5 text-right font-bold text-gray-800 bg-gray-50/20">
                    {formatPnLSum(-taxTotal)}
                  </td>
                </tr>
                <tr className="bg-gray-100 font-black border-t border-b border-gray-300">
                  <td className="p-4 text-gray-900 font-black text-sm">Чистая прибыль</td>
                  {data.netProfit.map((val, idx) => (
                    <td key={idx} className="p-4 text-right font-black text-[13px]">
                      {formatPnLSum(val)}
                    </td>
                  ))}
                  <td className="p-4 text-right font-black text-sm bg-gray-200/50">
                    {formatPnLSum(netProfitTotal)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

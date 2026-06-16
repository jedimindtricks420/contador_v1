"use client";
import { useEffect, useState } from "react";
import { formatSum } from "@/lib/format";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from "recharts";

interface BankAccount {
  id: string;
  name: string;
  currency: string;
}

interface CashFlowCategory {
  categoryCode: string;
  categoryName: string;
  amounts: number[];
  total: number;
}

interface CashFlowData {
  months: string[];
  income: CashFlowCategory[];
  expense: CashFlowCategory[];
  netFlow: number[];
  openingBalance?: number;
  closingBalance?: number;
  hasMixedCurrencies?: boolean;
  openingBalanceUZS?: number;
  closingBalanceUZS?: number;
  openingBalanceUSD?: number;
  closingBalanceUSD?: number;
}

const MONTH_NAMES_RU: Record<string, string> = {
  "01": "Янв", "02": "Фев", "03": "Мар", "04": "Апр", "05": "Май", "06": "Июн",
  "07": "Июл", "08": "Авг", "09": "Сен", "10": "Окт", "11": "Ноя", "12": "Дек"
};

function formatMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split("-");
  return `${MONTH_NAMES_RU[month] || month} ${year}`;
}

export default function CashFlowClient() {
  const [data, setData] = useState<CashFlowData | null>(null);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string>("ALL");
  const [periodType, setPeriodType] = useState<string>("YEAR"); // YEAR, QUARTER, MONTH, CUSTOM
  
  // Custom range
  const now = new Date();
  const [fromStr, setFromStr] = useState<string>(`${now.getFullYear()}-01-01`);
  const [toStr, setToStr] = useState<string>(`${now.getFullYear()}-12-31`);

  const [loading, setLoading] = useState(true);

  // Collapse states
  const [showIncomeDetails, setShowIncomeDetails] = useState(true);
  const [showExpenseDetails, setShowExpenseDetails] = useState(true);

  const loadFilterData = async () => {
    try {
      const bankRes = await fetch("/v2/api/bank-accounts");
      const accounts = await bankRes.json();
      setBankAccounts(accounts);
    } catch (err) {
      console.error(err);
    }
  };

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
        const currentMonth = now.getMonth(); // 0-11
        const quarter = Math.floor(currentMonth / 3); // 0-3
        const startMonthNum = quarter * 3 + 1;
        const endMonthNum = quarter * 3 + 3;
        const startMonth = String(startMonthNum).padStart(2, "0");
        // last day of quarter-end month
        const lastDay = new Date(year, endMonthNum, 0).getDate();
        const endMonth = String(endMonthNum).padStart(2, "0");
        fromDate = `${year}-${startMonth}-01`;
        toDate = `${year}-${endMonth}-${String(lastDay).padStart(2, "0")}`;
      } else if (periodType === "MONTH") {
        const currentMonthNum = now.getMonth() + 1;
        const currentMonthStr = String(currentMonthNum).padStart(2, "0");
        const lastDay = new Date(year, currentMonthNum, 0).getDate();
        fromDate = `${year}-${currentMonthStr}-01`;
        toDate = `${year}-${currentMonthStr}-${String(lastDay).padStart(2, "0")}`;
      }

      const params = new URLSearchParams();
      params.append("from", fromDate);
      params.append("to", toDate);
      if (selectedAccount !== "ALL") {
        params.append("accountId", selectedAccount);
      }

      const res = await fetch(`/v2/api/cashflow?${params.toString()}`);
      const reportData = await res.json();
      setData(reportData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFilterData();
  }, []);

  useEffect(() => {
    loadReport();
  }, [selectedAccount, periodType, fromStr, toStr]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-[300px] text-gray-500 font-medium">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-300 mr-3"></div>
        Загрузка отчёта Cash Flow...
      </div>
    );
  }

  // Prep chart data
  const chartData = data
    ? data.months.map((m, idx) => {
        const incomeSum = data.income.reduce((sum, cat) => sum + cat.amounts[idx], 0);
        const expenseSum = data.expense.reduce((sum, cat) => sum + cat.amounts[idx], 0);
        return {
          name: formatMonthLabel(m),
          Приход: incomeSum,
          Расход: expenseSum
        };
      })
    : [];

  // Table computations
  const totalIncomeByMonth = data
    ? data.months.map((_, idx) => data.income.reduce((sum, cat) => sum + cat.amounts[idx], 0))
    : [];
  const totalExpenseByMonth = data
    ? data.months.map((_, idx) => data.expense.reduce((sum, cat) => sum + cat.amounts[idx], 0))
    : [];

  const grandTotalIncome = totalIncomeByMonth.reduce((sum, val) => sum + val, 0);
  const grandTotalExpense = totalExpenseByMonth.reduce((sum, val) => sum + val, 0);

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header & Filters */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-6 border-b border-gray-200">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Cash Flow (Движение денег)</h1>
          <p className="text-xs text-gray-400 mt-0.5">Поступления и списания денежных средств со счетов организации</p>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-gray-700 w-full md:w-auto">
          {/* Account */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-gray-400">Счёт:</span>
            <select
              value={selectedAccount}
              onChange={(e) => setSelectedAccount(e.target.value)}
              className="bg-white border border-gray-200 rounded px-2.5 py-1.5 outline-hidden focus:border-black font-semibold text-gray-700"
            >
              <option value="ALL">Все счета</option>
              {bankAccounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name} ({acc.currency})
                </option>
              ))}
            </select>
          </div>

          {/* Period Type */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-gray-400">Период:</span>
            <select
              value={periodType}
              onChange={(e) => setPeriodType(e.target.value)}
              className="bg-white border border-gray-200 rounded px-2.5 py-1.5 outline-hidden focus:border-black font-semibold text-gray-700"
            >
              <option value="YEAR">Текущий год</option>
              <option value="QUARTER">Текущий квартал</option>
              <option value="MONTH">Текущий месяц</option>
              <option value="CUSTOM">Произвольный диапазон</option>
            </select>
          </div>

          {/* Custom Date Range Picker */}
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

      {/* Visual Chart */}
      {data && (
        <div className="bg-white border border-gray-200 rounded p-6 shadow-sm">
          <h2 className="text-sm font-bold text-gray-700 mb-6">Динамика поступлений и списаний</h2>
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" fontSize={11} fontWeight={600} stroke="#94a3b8" tickLine={false} />
                <YAxis
                  fontSize={10}
                  fontWeight={600}
                  stroke="#94a3b8"
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `${(v / 1000000).toFixed(0)}M`}
                />
                <Tooltip
                  cursor={{ fill: "#f8fafc" }}
                  contentStyle={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 12, boxShadow: "0 1px 3px 0 rgba(0,0,0,0.05)", fontSize: 11 }}
                  formatter={(value: any) => [formatSum(value), ""]}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 11, fontWeight: 600, paddingTop: 15 }} />
                <Bar dataKey="Приход" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={45} />
                <Bar dataKey="Расход" fill="#f43f5e" radius={[4, 4, 0, 0]} maxBarSize={45} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Grouped Table */}
      {data && (
        <div className="bg-white border border-gray-200 rounded overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-gray-50 text-gray-500 border-b border-gray-200 font-bold">
                  <th className="p-3.5 min-w-[200px]">Статьи ДДС</th>
                  {data.months.map((m) => (
                    <th key={m} className="p-3.5 text-right whitespace-nowrap">
                      {formatMonthLabel(m)}
                    </th>
                  ))}
                  <th className="p-3.5 text-right min-w-[120px]">Итого за период</th>
                  <th className="p-3.5 text-right w-[60px]">%</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-medium">
                {/* 1. INCOME GROUP */}
                <tr className="bg-gray-50/50">
                  <td className="p-3.5 font-bold text-gray-700 flex items-center gap-1.5">
                    <button
                      onClick={() => setShowIncomeDetails(!showIncomeDetails)}
                      className="h-4 w-4 bg-gray-200 hover:bg-gray-300 rounded flex items-center justify-center text-[10px] text-gray-600 transition"
                    >
                      {showIncomeDetails ? "−" : "+"}
                    </button>
                    Поступления (Приход)
                  </td>
                  {totalIncomeByMonth.map((sum, i) => (
                    <td key={i} className="p-3.5 text-right font-bold text-gray-700">
                      {formatSum(sum)}
                    </td>
                  ))}
                  <td className="p-3.5 text-right font-extrabold text-gray-700">
                    {formatSum(grandTotalIncome)}
                  </td>
                  <td className="p-3.5 text-right font-bold text-gray-400">—</td>
                </tr>

                {showIncomeDetails &&
                  data.income.map((cat) => {
                    const percentage = grandTotalIncome > 0 ? Math.round((cat.total / grandTotalIncome) * 100) : 0;
                    return (
                      <tr key={cat.categoryCode} className="hover:bg-gray-50/50 text-gray-600">
                        <td className="p-3.5 pl-9 font-semibold text-gray-700">{cat.categoryName}</td>
                        {cat.amounts.map((amt, idx) => (
                          <td key={idx} className="p-3.5 text-right font-mono">
                            <a
                              href={`/v2/transactions?categoryCode=${cat.categoryCode}&month=${data.months[idx]}`}
                              className="hover:text-black hover:underline"
                            >
                              {formatSum(amt)}
                            </a>
                          </td>
                        ))}
                        <td className="p-3.5 text-right font-bold text-gray-800 bg-gray-50/20">
                          {formatSum(cat.total)}
                        </td>
                        <td className="p-3.5 text-right text-gray-400 font-semibold">{percentage}%</td>
                      </tr>
                    );
                  })}

                {/* 2. EXPENSE GROUP */}
                <tr className="bg-gray-50/50">
                  <td className="p-3.5 font-bold text-gray-700 flex items-center gap-1.5">
                    <button
                      onClick={() => setShowExpenseDetails(!showExpenseDetails)}
                      className="h-4 w-4 bg-gray-200 hover:bg-gray-300 rounded flex items-center justify-center text-[10px] text-gray-600 transition"
                    >
                      {showExpenseDetails ? "−" : "+"}
                    </button>
                    Списания (Расход)
                  </td>
                  {totalExpenseByMonth.map((sum, i) => (
                    <td key={i} className="p-3.5 text-right font-bold text-gray-700">
                      {formatSum(sum)}
                    </td>
                  ))}
                  <td className="p-3.5 text-right font-extrabold text-rose-600">
                    {formatSum(grandTotalExpense)}
                  </td>
                  <td className="p-3.5 text-right font-bold text-gray-400">—</td>
                </tr>

                {showExpenseDetails &&
                  data.expense.map((cat) => {
                    const percentage = grandTotalExpense > 0 ? Math.round((cat.total / grandTotalExpense) * 100) : 0;
                    return (
                      <tr key={cat.categoryCode} className="hover:bg-gray-50/50 text-gray-600">
                        <td className="p-3.5 pl-9 font-semibold text-gray-700">{cat.categoryName}</td>
                        {cat.amounts.map((amt, idx) => (
                          <td key={idx} className="p-3.5 text-right font-mono">
                            <a
                              href={`/v2/transactions?categoryCode=${cat.categoryCode}&month=${data.months[idx]}`}
                              className="hover:text-black hover:underline"
                            >
                              {formatSum(amt)}
                            </a>
                          </td>
                        ))}
                        <td className="p-3.5 text-right font-bold text-gray-800 bg-gray-50/20">
                          {formatSum(cat.total)}
                        </td>
                        <td className="p-3.5 text-right text-gray-400 font-semibold">{percentage}%</td>
                      </tr>
                    );
                  })}

                {/* 3. NET CASH FLOW */}
                <tr className="bg-gray-100/40 text-gray-800 font-bold border-t-2 border-gray-200">
                  <td className="p-4 text-sm font-bold text-gray-800">Чистый денежный поток</td>
                  {data.netFlow.map((net, i) => {
                    const isPositive = net >= 0;
                    return (
                      <td key={i} className={`p-4 text-right text-sm font-bold ${isPositive ? "text-gray-700" : "text-rose-600"}`}>
                        {isPositive ? "+" : ""}{formatSum(net)}
                      </td>
                    );
                  })}
                  <td className={`p-4 text-right text-sm font-black ${(grandTotalIncome - grandTotalExpense) >= 0 ? "text-gray-700" : "text-rose-600"}`}>
                    {(grandTotalIncome - grandTotalExpense) >= 0 ? "+" : ""}{formatSum(grandTotalIncome - grandTotalExpense)}
                  </td>
                  <td className="p-4 text-right text-gray-400 font-bold">—</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {data && (
        <div className="bg-white border border-gray-200 p-4 shadow-sm space-y-2">
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Остатки по кассовым счетам</div>
          {data.hasMixedCurrencies ? (
            <>
              <div className="text-xs text-amber-600 font-semibold border border-amber-200 bg-amber-50 px-3 py-2 rounded">
                ⚠ Счета в разных валютах — остатки показаны раздельно
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs font-semibold text-gray-600">
                <div className="bg-gray-50 p-3 border border-gray-200 space-y-1">
                  <div className="text-[10px] font-bold text-gray-400 uppercase">UZS</div>
                  <div className="flex justify-between"><span>Начало периода:</span><span className="font-bold text-gray-800">{formatSum(data.openingBalanceUZS)}</span></div>
                  <div className="flex justify-between"><span>Конец периода:</span><span className="font-bold text-gray-800">{formatSum(data.closingBalanceUZS)}</span></div>
                </div>
                <div className="bg-gray-50 p-3 border border-gray-200 space-y-1">
                  <div className="text-[10px] font-bold text-gray-400 uppercase">USD</div>
                  <div className="flex justify-between"><span>Начало периода:</span><span className="font-bold text-gray-800">{(data.openingBalanceUSD ?? 0).toFixed(2)} USD</span></div>
                  <div className="flex justify-between"><span>Конец периода:</span><span className="font-bold text-gray-800">{(data.closingBalanceUSD ?? 0).toFixed(2)} USD</span></div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex gap-6 text-xs font-semibold text-gray-600">
              <div className="flex gap-2"><span>Начало периода:</span><span className="font-bold text-gray-800">{formatSum(data.openingBalance)}</span></div>
              <div className="flex gap-2"><span>Конец периода:</span><span className="font-bold text-gray-800">{formatSum(data.closingBalance)}</span></div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

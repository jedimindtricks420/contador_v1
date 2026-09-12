"use client";
import { useEffect, useState } from "react";
import { formatSum } from "@/lib/format";
import SearchableSelect from "@/components/SearchableSelect";
import { RefreshCw } from "lucide-react";
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
  const [report, setReport] = useState<{ key: string; data: CashFlowData | null; error: string | null } | null>(null);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string>("ALL");
  const [periodType, setPeriodType] = useState<string>("YEAR"); // YEAR, QUARTER, MONTH, CUSTOM
  
  // Custom range
  const currentYear = new Intl.DateTimeFormat("en", { timeZone: "Asia/Tashkent", year: "numeric" }).format(new Date());
  const [fromStr, setFromStr] = useState<string>(`${currentYear}-01-01`);
  const [toStr, setToStr] = useState<string>(`${currentYear}-12-31`);

  const [retryAttempt, setRetryAttempt] = useState(0);
  const requestKey = JSON.stringify([selectedAccount, periodType, fromStr, toStr, retryAttempt]);
  const loading = report?.key !== requestKey;
  const data = loading ? null : report?.data ?? null;
  const error = loading ? null : report?.error ?? null;

  // Collapse states
  const [showIncomeDetails, setShowIncomeDetails] = useState(true);
  const [showExpenseDetails, setShowExpenseDetails] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    const loadFilterData = async () => {
      try {
        const bankRes = await fetch("/v2/api/bank-accounts", { signal: controller.signal });
        const accounts = await bankRes.json();
        if (!bankRes.ok || !Array.isArray(accounts)) throw new Error("Не удалось загрузить банковские счета");
        if (!controller.signal.aborted) setBankAccounts(accounts);
      } catch (err) {
        if (!controller.signal.aborted) console.error(err);
      }
    };
    void loadFilterData();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    const loadReport = async () => {
    try {
      const currentParts = new Intl.DateTimeFormat("en", {
        timeZone: "Asia/Tashkent", year: "numeric", month: "2-digit",
      }).formatToParts(new Date());
      const year = Number(currentParts.find(part => part.type === "year")!.value);
      const currentMonthNum = Number(currentParts.find(part => part.type === "month")!.value);
      let fromDate = fromStr;
      let toDate = toStr;

      if (periodType === "YEAR") {
        fromDate = `${year}-01-01`;
        toDate = `${year}-12-31`;
      } else if (periodType === "QUARTER") {
        const quarter = Math.floor((currentMonthNum - 1) / 3);
        const startMonthNum = quarter * 3 + 1;
        const endMonthNum = quarter * 3 + 3;
        const startMonth = String(startMonthNum).padStart(2, "0");
        // last day of quarter-end month
        const lastDay = new Date(Date.UTC(year, endMonthNum, 0)).getUTCDate();
        const endMonth = String(endMonthNum).padStart(2, "0");
        fromDate = `${year}-${startMonth}-01`;
        toDate = `${year}-${endMonth}-${String(lastDay).padStart(2, "0")}`;
      } else if (periodType === "MONTH") {
        const currentMonthStr = String(currentMonthNum).padStart(2, "0");
        const lastDay = new Date(Date.UTC(year, currentMonthNum, 0)).getUTCDate();
        fromDate = `${year}-${currentMonthStr}-01`;
        toDate = `${year}-${currentMonthStr}-${String(lastDay).padStart(2, "0")}`;
      }

      const params = new URLSearchParams();
      params.append("from", fromDate);
      params.append("to", toDate);
      if (selectedAccount !== "ALL") {
        params.append("accountId", selectedAccount);
      }

      const res = await fetch(`/v2/api/cashflow?${params.toString()}`, { signal });
      const reportData = await res.json();
      if (!res.ok) throw new Error(reportData.error || "Не удалось загрузить ДДС");
      if (!Array.isArray(reportData.months) || !Array.isArray(reportData.income) ||
          !Array.isArray(reportData.expense) || !Array.isArray(reportData.netFlow)) {
        throw new Error("Сервер вернул некорректный отчёт ДДС");
      }
      if (!signal.aborted) setReport({ key: requestKey, data: reportData, error: null });
    } catch (err) {
      if (!signal.aborted) setReport({ key: requestKey, data: null,
        error: err instanceof Error ? err.message : "Не удалось загрузить ДДС" });
    }
    };
    void loadReport();
    return () => controller.abort();
  }, [selectedAccount, periodType, fromStr, toStr, requestKey]);

  // Скрываем категории где все значения = 0
  const visibleIncome = data ? data.income.filter((cat) => cat.amounts.some((a) => a !== 0)) : [];
  const visibleExpense = data ? data.expense.filter((cat) => cat.amounts.some((a) => a !== 0)) : [];

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
            <SearchableSelect
              options={bankAccounts.map((acc) => ({ value: acc.id, label: `${acc.name} (${acc.currency})` }))}
              value={selectedAccount}
              onChange={setSelectedAccount}
              allOption={{ value: "ALL", label: "Все счета" }}
              className="min-w-[180px]"
            />
          </div>

          {/* Period Type */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-gray-400">Период:</span>
            <SearchableSelect
              options={[
                { value: "YEAR", label: "Текущий год" },
                { value: "QUARTER", label: "Текущий квартал" },
                { value: "MONTH", label: "Текущий месяц" },
                { value: "CUSTOM", label: "Произвольный диапазон" },
              ]}
              value={periodType}
              onChange={setPeriodType}
              className="min-w-[180px]"
            />
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

      {loading && <p role="status" className="text-sm text-gray-500">Загрузка отчёта ДДС...</p>}
      {error && <div role="alert" className="flex items-start gap-3 border-l-2 border-rose-400 bg-rose-50 p-4 text-sm text-rose-800">
        <p className="min-w-0 flex-1 break-words">{error}</p>
        <button type="button" onClick={() => setRetryAttempt(attempt => attempt + 1)}
          disabled={loading} aria-label="Повторить загрузку ДДС" title="Повторить загрузку ДДС"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded hover:bg-rose-100 disabled:opacity-50">
          <RefreshCw size={16} />
        </button>
      </div>}

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
                  visibleIncome.map((cat) => {
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
                  visibleExpense.map((cat) => {
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

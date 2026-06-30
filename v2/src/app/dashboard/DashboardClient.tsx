"use client";
import { useEffect, useState } from "react";
import { Sparkles, Check } from "lucide-react";
import { formatSum, periodLabel } from "@/lib/format";

interface DashboardData {
  period: { id: string; year: number; month: number; status: string } | null;
  allPeriods: { id: string; year: number; month: number; status: string; mode: string }[];
  monthStatus: "awaiting_data" | "awaiting_action" | "closed";
  stats: {
    totalImported: number;
    needsClarification: number;
    confirmed: number;
    totalBalance: string;
    revenue: string;
    expenses: string;
    profit: string;
    riskItems: number;
  };
  bankAccounts: { id: string; name: string; currency: string; lastBalance: string }[];
  upcomingTaxes: { id: string; type: string; dueDate: string; estimatedAmount: string | null }[];
  importStatus: { bankTransactions: number; soliqMatched: number };
  closingChecklist: { step: number; done: boolean; label: string }[];
  kpi: { totalBalance: string; income: string; expense: string; taxesOwed: string; salaryDebt: string };
  riskOpenItems: { id: string; counterpartyName: string; accountCode: string; amount: number; dateOpened: string; overdueDays: number }[];
}

interface BankAccount {
  id: string;
  name: string;
  bankName: string | null;
  accountNumber: string | null;
  lastBalance: string | number;
  currency: string;
}

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  awaiting_data: { label: "Ожидает данных", className: "bg-gray-100 text-gray-600 border border-gray-200" },
  awaiting_action: { label: "Ожидает действий", className: "bg-gray-100 text-gray-700 border border-gray-200" },
  closed: { label: "Период закрыт", className: "bg-gray-900 text-white border border-gray-900" },
};

const TAX_TYPE_LABELS: Record<string, string> = {
  VAT: "НДС",
  PERSONAL_INCOME_TAX: "НДФЛ",
  INPS: "ИНПС (накопительная пенсия)",
  TURNOVER_TAX: "Налог с оборота",
  PROFIT_TAX: "Налог на прибыль",
  STATISTICS: "Статистика",
  SOCIAL_TAX: "Соцналог",
};

export default function DashboardClient() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDashboardPeriodId, setSelectedDashboardPeriodId] = useState<string>("");
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);

  const loadDashboard = async (periodId?: string) => {
    try {
      const url = periodId ? `/v2/api/dashboard?periodId=${periodId}` : "/v2/api/dashboard";
      const res = await fetch(url);
      if (!res.ok) {
        setLoadError(`Ошибка загрузки дашборда: ${res.status}`);
        return;
      }
      const d = await res.json();
      setData(d);
      setLoadError(null);

      if (!periodId && d.period) {
        setSelectedDashboardPeriodId(d.period.id);
      }

      const bankRes = await fetch("/v2/api/bank-accounts");
      if (bankRes.ok) setBankAccounts(await bankRes.json());
    } catch (err: any) {
      console.error("Failed to load dashboard:", err);
      setLoadError(err.message || "Ошибка сети");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-gray-400">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black mb-4"></div>
        <span className="text-sm font-medium uppercase tracking-widest">Загрузка данных...</span>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-rose-500 gap-3">
        <span className="text-sm font-semibold">{loadError}</span>
        <button onClick={() => loadDashboard()} className="text-xs text-gray-500 underline">Повторить</button>
      </div>
    );
  }

  if (!data) return null;

  const { period, allPeriods, monthStatus, upcomingTaxes, closingChecklist, kpi, riskOpenItems } = data;
  const statusInfo = STATUS_LABELS[monthStatus] || STATUS_LABELS.awaiting_data;

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-wrap justify-between items-center pb-6 border-b border-gray-200 gap-3">
        <div>
          <div className="flex items-center gap-3 mb-1 flex-wrap">
            <h1 className="text-xl font-bold text-gray-900 uppercase">
              {period ? periodLabel(period.year, period.month) : "Дашборд"}
            </h1>
            <span className={`px-2 py-0.5 text-xs font-bold uppercase tracking-wide ${statusInfo.className}`}>
              {statusInfo.label}
            </span>
            {allPeriods && allPeriods.length > 1 && (
              <select
                value={selectedDashboardPeriodId || period?.id || ""}
                onChange={(e) => {
                  setSelectedDashboardPeriodId(e.target.value);
                  loadDashboard(e.target.value);
                }}
                className="bg-white border border-gray-200 px-2 py-1 text-xs text-gray-700 font-semibold outline-none focus:border-black"
              >
                {allPeriods.map((p) => (
                  <option key={p.id} value={p.id}>
                    {periodLabel(p.year, p.month)} {p.status === "CLOSED" ? "(Закрыт)" : "(Открыт)"}
                  </option>
                ))}
              </select>
            )}
          </div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
            Управление и сверка за выбранный отчётный период
          </p>
        </div>

        {period && period.status !== "CLOSED" && (
          <a
            href="/v2/closing"
            className="bg-black text-white text-xs font-bold py-2 px-4 hover:opacity-80 transition-opacity"
          >
            Закрыть месяц →
          </a>
        )}
      </div>

      {/* Onboarding empty state */}
      {!period && (
        <div className="bg-white border border-gray-200 p-10 shadow-sm text-center space-y-4 max-w-xl mx-auto">
          <Sparkles className="h-10 w-10 text-gray-400 mx-auto" />
          <h2 className="text-sm font-bold text-gray-800">Добро пожаловать в Contador</h2>
          <p className="text-xs text-gray-500 max-w-sm mx-auto">
            Для начала работы перейдите в мастер закрытия месяца — там вы сможете импортировать банковскую выписку и настроить период.
          </p>
          <div className="pt-2">
            <a href="/v2/closing" className="text-xs bg-black text-white font-bold py-2 px-5 hover:opacity-80 transition">
              Начать работу →
            </a>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: "Остаток на счетах", value: formatSum(kpi.totalBalance), warn: false },
          { label: "Доходы", value: formatSum(kpi.income), warn: false },
          { label: "Расходы", value: formatSum(kpi.expense), warn: false },
          { label: "Налоги к уплате", value: formatSum(kpi.taxesOwed), warn: Number(kpi.taxesOwed) > 0 },
          ...(Number(kpi.salaryDebt) > 0 ? [{ label: "Задолженность по зарплате", value: formatSum(kpi.salaryDebt), warn: true }] : []),
        ].map((card, i) => (
          <div key={i} className={`bg-white border p-6 shadow-sm ${card.warn ? "border-amber-300" : "border-gray-200"}`}>
            <div className={`text-[10px] font-bold uppercase tracking-widest mb-2 ${card.warn ? "text-amber-600" : "text-gray-400"}`}>{card.label}</div>
            <div className={`text-2xl font-bold tracking-tight ${card.warn ? "text-amber-700" : "text-black"}`}>{card.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: Closing Checklist */}
        <div className="lg:col-span-2">
          <div className="bg-white border border-gray-200 p-6 shadow-sm">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xs font-bold text-gray-900 uppercase tracking-widest">Чек-лист закрытия периода</h2>
              {period && period.status !== "CLOSED" && (
                <a
                  href="/v2/closing"
                  className="text-xs font-bold text-gray-500 border border-gray-200 px-3 py-1.5 hover:bg-gray-50 transition-colors"
                >
                  Открыть мастер →
                </a>
              )}
            </div>
            <div className="space-y-1.5">
              {closingChecklist.map((item, i) => (
                <a
                  href={`/v2/closing?step=${item.step}`}
                  key={i}
                  className="flex items-center justify-between p-2.5 border border-gray-100 hover:bg-gray-50 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <span className={`h-5 w-5 flex items-center justify-center text-xs font-bold border ${item.done ? "bg-black text-white border-black" : "bg-white text-gray-400 border-gray-200"}`}>
                      {item.done ? <Check size={12} /> : ""}
                    </span>
                    <span className={`text-xs font-medium ${item.done ? "text-gray-400 line-through" : "text-gray-800"}`}>
                      {item.label}
                    </span>
                  </div>
                  <span className="text-[10px] text-gray-400 font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                    Перейти →
                  </span>
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* Right Side */}
        <div className="space-y-8">
          {/* Bank Accounts */}
          <div className="bg-white border border-gray-200 p-6 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xs font-bold text-gray-900 uppercase tracking-widest">Банковские счета</h3>
              <a href="/v2/accounts" className="text-[11px] font-bold text-gray-500 hover:text-black">
                Все счета →
              </a>
            </div>
            {bankAccounts.length === 0 ? (
              <p className="text-sm text-gray-400 italic">Счета не добавлены</p>
            ) : (
              <div className="divide-y divide-gray-100">
                {bankAccounts.map((acc) => (
                  <div key={acc.id} className="py-3 flex justify-between items-center text-sm">
                    <div>
                      <div className="font-medium text-gray-800">{acc.name}</div>
                      <div className="text-xs text-gray-400 font-mono">{acc.accountNumber || "нет номера"}</div>
                    </div>
                    <div className="font-bold text-gray-900">{formatSum(acc.lastBalance)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Risk Open Items */}
          <div className="bg-white border border-gray-200 p-6 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xs font-bold text-gray-900 uppercase tracking-widest">Требуют внимания</h3>
              <a href="/v2/open-positions" className="text-[11px] font-bold text-gray-500 hover:text-black">
                Подробнее →
              </a>
            </div>
            {riskOpenItems.length === 0 ? (
              <p className="text-xs text-gray-400 italic">Нет просроченных позиций</p>
            ) : (
              <div className="space-y-2">
                {riskOpenItems.map((item) => (
                  <div key={item.id} className="p-3 border border-gray-200 text-xs space-y-1">
                    <div className="flex justify-between items-start gap-2">
                      <span className="font-bold text-gray-800 truncate">{item.counterpartyName}</span>
                      <span className="font-bold text-gray-900 whitespace-nowrap">{formatSum(item.amount)}</span>
                    </div>
                    <div className="flex justify-between text-[10px] text-gray-400">
                      <span>Счёт {item.accountCode}</span>
                      <span className="font-semibold">Просрочено {item.overdueDays} дн.</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Tax calendar */}
          <div className="bg-white border border-gray-200 p-6 shadow-sm">
            <h3 className="text-xs font-bold text-gray-900 uppercase tracking-widest mb-4">Ближайшие налоги (30 дней)</h3>
            {upcomingTaxes.length === 0 ? (
              <p className="text-xs text-gray-400 italic">Нет ближайших налоговых дедлайнов</p>
            ) : (
              <div className="divide-y divide-gray-100">
                {upcomingTaxes.map((event: any) => (
                  <div key={event.id} className="py-3 flex justify-between items-center text-sm">
                    <div>
                      <div className="font-medium text-gray-800">{TAX_TYPE_LABELS[event.type] || event.type}</div>
                      <div className="text-xs text-gray-400">
                        до {new Date(event.dueDate).toLocaleDateString("ru-RU")}
                      </div>
                    </div>
                    {event.estimatedAmount && (
                      <span className="text-gray-700 font-bold">{formatSum(event.estimatedAmount)}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

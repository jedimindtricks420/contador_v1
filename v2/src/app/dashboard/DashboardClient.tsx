"use client";
import { useEffect, useState } from "react";
import { Sparkles, Check, FolderOpen, BarChart2 } from "lucide-react";
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

interface Period {
  id: string;
  year: number;
  month: number;
  status: string;
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
  const [loading, setLoading] = useState(true);
  const [selectedDashboardPeriodId, setSelectedDashboardPeriodId] = useState<string>("");

  // Bank import states
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [selectedBankAccountId, setSelectedBankAccountId] = useState<string>("");
  const parserType = "AUTO";
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewTransactions, setPreviewTransactions] = useState<any[] | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<string>("");

  // Bank account creation modal states
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [newAccForm, setNewAccForm] = useState({
    name: "",
    bankName: "",
    accountNumber: "",
    lastBalance: "0",
    currency: "UZS"
  });

  // Soliq import states
  const [periods, setPeriods] = useState<Period[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>("");
  const [soliqFile, setSoliqFile] = useState<File | null>(null);
  const [soliqUploading, setSoliqUploading] = useState(false);
  const [soliqResult, setSoliqResult] = useState<string>("");
  const [soliqData, setSoliqData] = useState<any | null>(null);

  const loadDashboard = async (periodId?: string) => {
    try {
      const url = periodId ? `/v2/api/dashboard?periodId=${periodId}` : "/v2/api/dashboard";
      const res = await fetch(url);
      const d = await res.json();
      setData(d);

      // Sync period dropdown with loaded data
      if (!periodId && d.period) {
        setSelectedDashboardPeriodId(d.period.id);
      }

      const bankRes = await fetch("/v2/api/bank-accounts");
      const accounts = await bankRes.json();
      setBankAccounts(accounts);
      if (accounts.length > 0 && !selectedBankAccountId) {
        setSelectedBankAccountId(accounts[0].id);
      }

      // Use allPeriods from dashboard response for Soliq dropdown
      const pList = d.allPeriods || [];
      setPeriods(pList);
      if (pList.length > 0 && !selectedPeriodId) {
        const active = pList.find((p: any) => p.status === "OPEN") || pList[0];
        setSelectedPeriodId(active.id);
      }
    } catch (err) {
      console.error("Failed to load dashboard:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/v2/api/bank-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newAccForm.name,
          bankName: newAccForm.bankName,
          accountNumber: newAccForm.accountNumber,
          lastBalance: parseFloat(newAccForm.lastBalance) || 0,
          currency: newAccForm.currency
        })
      });
      if (res.ok) {
        const newAcc = await res.json();
        setBankAccounts(prev => [...prev, newAcc]);
        setSelectedBankAccountId(newAcc.id);
        setShowAddAccount(false);
        setNewAccForm({ name: "", bankName: "", accountNumber: "", lastBalance: "0", currency: "UZS" });
        loadDashboard();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handlePreview = async () => {
    if (!uploadFile) return;
    if (!selectedBankAccountId) {
      setUploadResult("Выберите банковский счёт для предпросмотра");
      return;
    }
    setPreviewLoading(true);
    setUploadResult("");
    setPreviewTransactions(null);

    const fd = new FormData();
    fd.append("file", uploadFile);
    fd.append("bankAccountId", selectedBankAccountId);
    fd.append("parserType", parserType);

    try {
      const res = await fetch("/v2/api/import/bank?preview=true", { method: "POST", body: fd });
      const result = await res.json();
      if (res.ok) {
        setPreviewTransactions(result.transactions || []);
      } else {
        setUploadResult(`Ошибка предпросмотра: ${result.error}`);
      }
    } catch (err: any) {
      setUploadResult(`Ошибка сети: ${err.message}`);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleImport = async () => {
    if (!uploadFile || !selectedBankAccountId) return;
    setUploading(true);
    setUploadResult("");
    try {
      const fd = new FormData();
      fd.append("file", uploadFile);
      fd.append("bankAccountId", selectedBankAccountId);
      fd.append("parserType", parserType);

      const res = await fetch("/v2/api/import/bank", { method: "POST", body: fd });
      const result = await res.json();
      if (res.ok) {
        setUploadResult(`Успешно. Импортировано: ${result.imported}, дублей: ${result.duplicates}`);
        setPreviewTransactions(null);
        setUploadFile(null);
        loadDashboard();
      } else {
        setUploadResult(`Ошибка импорта: ${result.error}`);
      }
    } catch (err: any) {
      setUploadResult(`Ошибка сети: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleSoliqUpload = async () => {
    if (!soliqFile || !selectedPeriodId) return;
    setSoliqUploading(true);
    setSoliqResult("");
    setSoliqData(null);
    try {
      const fd = new FormData();
      fd.append("file", soliqFile);
      fd.append("periodId", selectedPeriodId);

      const res = await fetch("/v2/api/import/soliq", { method: "POST", body: fd });
      const result = await res.json();
      if (res.ok) {
        setSoliqResult(`Импорт Soliq завершен.`);
        setSoliqData(result);
        setSoliqFile(null);
        loadDashboard();
      } else {
        setSoliqResult(`Ошибка: ${result.error}`);
      }
    } catch (err: any) {
      setSoliqResult(`Ошибка сети: ${err.message}`);
    } finally {
      setSoliqUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-gray-400">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black mb-4"></div>
        <span className="text-sm font-medium uppercase tracking-widest">Загрузка данных...</span>
      </div>
    );
  }

  const { period, allPeriods, monthStatus, stats, upcomingTaxes, closingChecklist, kpi, riskOpenItems } = data!;
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
                  // Reset period-specific upload state when switching periods
                  setUploadFile(null);
                  setPreviewTransactions(null);
                  setUploadResult("");
                  setSoliqFile(null);
                  setSoliqData(null);
                  setSoliqResult("");
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
            Для начала работы загрузите банковскую выписку ниже или перейдите в мастер закрытия месяца.
            Период создастся автоматически.
          </p>
          <div className="flex gap-3 justify-center pt-2">
            <a href="#bank-import" className="text-xs bg-black text-white font-bold py-2 px-5 hover:opacity-80 transition">
              Загрузить выписку ↓
            </a>
            <a href="/v2/closing" className="text-xs border border-gray-300 text-gray-700 font-bold py-2 px-5 hover:bg-gray-50 transition">
              Мастер закрытия →
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
        {/* Left Side: Upload bank statement */}
        <div className="lg:col-span-2 space-y-8">
          <div id="bank-import" className="bg-white border border-gray-200 p-6 shadow-sm">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xs font-bold text-gray-900 uppercase tracking-widest">Импорт банковской выписки</h2>
              <button
                onClick={() => setShowAddAccount(true)}
                className="text-xs font-medium text-gray-600 border border-gray-200 px-3 py-1.5 hover:bg-gray-50 transition-colors"
              >
                + Добавить счёт
              </button>
            </div>

            {/* Closing Checklist */}
            <div className="space-y-1.5 mb-6 border-b border-gray-100 pb-5">
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Чек-лист закрытия периода:</div>
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

            {/* Import Form */}
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Банковский счёт *</label>
                  {bankAccounts.length === 0 ? (
                    <div className="text-sm text-gray-500">Нет доступных счетов. Добавьте счёт.</div>
                  ) : (
                    <select
                      value={selectedBankAccountId}
                      onChange={(e) => setSelectedBankAccountId(e.target.value)}
                      className="w-full border border-gray-200 px-3 py-2 text-sm text-gray-700 bg-white outline-none focus:border-black"
                    >
                      {bankAccounts.map((acc) => (
                        <option key={acc.id} value={acc.id}>
                          {acc.name} ({formatSum(acc.lastBalance)})
                        </option>
                      ))}
                    </select>
                  )}
                </div>

              </div>
              <p className="text-[10px] text-gray-400 italic">Формат выписки определяется автоматически (1C / Excel)</p>

              {/* File input */}
              <div className="border-2 border-dashed border-gray-200 hover:border-gray-400 transition-colors p-6 text-center">
                <input
                  type="file"
                  id="bankFile"
                  accept=".txt,.xls,.xlsx"
                  onChange={(e) => {
                    setUploadFile(e.target.files?.[0] || null);
                    setPreviewTransactions(null);
                  }}
                  className="hidden"
                />
                <label htmlFor="bankFile" className="cursor-pointer space-y-2 block">
                  <FolderOpen className="h-8 w-8 text-gray-300 mx-auto" />
                  <div className="text-sm font-medium text-gray-700">
                    {uploadFile ? uploadFile.name : "Выберите или перетащите файл"}
                  </div>
                  <div className="text-xs text-gray-400">
                    Поддерживаются файлы 1C (.txt) и Excel банков Узбекистана (.xlsx, .xls)
                  </div>
                </label>
              </div>

              {uploadFile && (
                <div className="flex gap-4">
                  <button
                    onClick={handlePreview}
                    disabled={previewLoading || uploading}
                    className="flex-1 border border-gray-200 text-gray-700 text-sm font-medium py-2 px-4 hover:bg-gray-50 transition-colors disabled:opacity-50"
                  >
                    {previewLoading ? "Загрузка..." : "Предпросмотр (первые 5 строк)"}
                  </button>
                  <button
                    onClick={handleImport}
                    disabled={uploading || previewLoading}
                    className="flex-1 bg-black text-white text-sm font-medium py-2 px-4 hover:opacity-80 transition-opacity disabled:opacity-50"
                  >
                    {uploading ? "Импортируем..." : "Загрузить полностью"}
                  </button>
                </div>
              )}

              {uploadResult && (
                <div className={`p-3 text-sm font-medium border ${uploadResult.startsWith("Ошибка") ? "bg-gray-50 text-gray-700 border-gray-200" : "bg-gray-50 text-gray-700 border-gray-200"}`}>
                  {uploadResult}
                </div>
              )}
            </div>

            {/* Transactions Preview Table */}
            {previewTransactions && (
              <div className="mt-6 border-t border-gray-100 pt-6">
                <h3 className="text-xs font-bold text-gray-900 uppercase tracking-widest mb-3">Предпросмотр ({previewTransactions.length} строк)</h3>
                <div className="overflow-x-auto border border-gray-200">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-gray-50 text-gray-500 border-b border-gray-200 font-semibold uppercase tracking-wider">
                        <th className="px-3 py-2.5">Дата</th>
                        <th className="px-3 py-2.5">Контрагент</th>
                        <th className="px-3 py-2.5">ИНН</th>
                        <th className="px-3 py-2.5">Тип</th>
                        <th className="px-3 py-2.5">Сумма</th>
                        <th className="px-3 py-2.5">Назначение</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {previewTransactions.slice(0, 5).map((tx, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="px-3 py-2.5 font-medium text-gray-700">{tx.date}</td>
                          <td className="px-3 py-2.5 text-gray-600">{tx.counterpartyHint || "—"}</td>
                          <td className="px-3 py-2.5 text-gray-500 font-mono">{tx.counterpartyInn || "—"}</td>
                          <td className="px-3 py-2.5">
                            <span className={`px-2 py-0.5 text-[10px] font-bold border ${tx.direction === "CREDIT" ? "bg-gray-50 text-gray-700 border-gray-200" : "bg-gray-900 text-white border-gray-900"}`}>
                              {tx.direction === "CREDIT" ? "Приход" : "Расход"}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 font-semibold text-gray-700">{formatSum(tx.amount)}</td>
                          <td className="px-3 py-2.5 text-gray-400 truncate max-w-[200px]" title={tx.description}>{tx.description}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Soliq upload Card */}
          <div className="bg-white border border-gray-200 p-6 shadow-sm">
            <h2 className="text-xs font-bold text-gray-900 uppercase tracking-widest mb-4">Импорт реестра Soliq (.xlsx)</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Отчётный период</label>
                {periods.length === 0 ? (
                  <div className="text-sm text-gray-500">Нет периодов</div>
                ) : (
                  <select
                    value={selectedPeriodId}
                    onChange={(e) => setSelectedPeriodId(e.target.value)}
                    className="w-full border border-gray-200 px-3 py-2 text-sm text-gray-700 bg-white outline-none focus:border-black"
                  >
                    {periods.map((p) => (
                      <option key={p.id} value={p.id}>
                        {periodLabel(p.year, p.month)}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="border-2 border-dashed border-gray-200 hover:border-gray-400 transition-colors p-4 text-center">
                <input
                  type="file"
                  id="soliqFile"
                  accept=".xlsx,.xls,.xltx"
                  onChange={(e) => {
                    setSoliqFile(e.target.files?.[0] || null);
                    setSoliqData(null);
                  }}
                  className="hidden"
                />
                <label htmlFor="soliqFile" className="cursor-pointer space-y-1 block">
                  <BarChart2 className="h-7 w-7 text-gray-300 mx-auto" />
                  <div className="text-sm font-medium text-gray-700">
                    {soliqFile ? soliqFile.name : "Выберите файл my.soliq.uz"}
                  </div>
                  <div className="text-xs text-gray-400">
                    Листы: «Реестр ЭСФ» и «Расчёт налога»
                  </div>
                </label>
              </div>

              {soliqFile && (
                <button
                  onClick={handleSoliqUpload}
                  disabled={soliqUploading}
                  className="w-full bg-black text-white text-sm font-medium py-2 px-4 hover:opacity-80 transition-opacity disabled:opacity-50"
                >
                  {soliqUploading ? "Обработка..." : "Загрузить и сверить"}
                </button>
              )}

              {soliqResult && (
                <div className="p-3 border border-gray-200 bg-gray-50 text-sm font-medium text-gray-700">
                  {soliqResult}
                </div>
              )}

              {soliqData && (
                <div className="bg-gray-50 border border-gray-200 p-4 space-y-3 text-xs">
                  <div className="font-bold text-gray-900 text-sm border-b border-gray-200 pb-2 uppercase tracking-widest">Результаты сверки</div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white p-3 border border-gray-200">
                      <div className="text-gray-400 font-medium mb-1">Связано с авансами</div>
                      <div className="text-lg font-bold text-gray-900">{soliqData.matched} ЭСФ</div>
                    </div>
                    <div className="bg-white p-3 border border-gray-200">
                      <div className="text-gray-400 font-medium mb-1">Без соответствий</div>
                      <div className="text-lg font-bold text-gray-900">{soliqData.unmatched} ЭСФ</div>
                    </div>
                  </div>
                  <div className="bg-white p-3 border border-gray-200 space-y-2">
                    <div className="font-semibold text-gray-700">Суммы налогов по данным Soliq:</div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">НДС к уплате:</span>
                      <span className="font-bold text-gray-700">{formatSum(soliqData.taxSummary?.vat)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Налог с оборота:</span>
                      <span className="font-bold text-gray-700">{formatSum(soliqData.taxSummary?.turnoverTax)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Налог на прибыль:</span>
                      <span className="font-bold text-gray-700">{formatSum(soliqData.taxSummary?.incomeTax)}</span>
                    </div>
                  </div>
                </div>
              )}
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

      {/* Modal: Add Bank Account */}
      {showAddAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white p-6 max-w-md w-full mx-4 border border-gray-200 shadow-sm space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-gray-100">
              <h3 className="text-xs font-bold text-gray-900 uppercase tracking-widest">Добавить банковский счёт</h3>
              <button onClick={() => setShowAddAccount(false)} className="text-gray-400 hover:text-gray-600 text-lg">×</button>
            </div>
            <form onSubmit={handleAddAccount} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-gray-400 uppercase tracking-widest mb-1">Название счёта *</label>
                <input
                  type="text"
                  required
                  placeholder="Основной счёт UZS"
                  value={newAccForm.name}
                  onChange={(e) => setNewAccForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full border border-gray-200 px-3 py-2 text-sm text-gray-700 bg-white outline-none focus:border-black"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-400 uppercase tracking-widest mb-1">Валюта</label>
                  <select
                    value={newAccForm.currency}
                    onChange={(e) => setNewAccForm(prev => ({ ...prev, currency: e.target.value }))}
                    className="w-full border border-gray-200 px-3 py-2 text-sm text-gray-700 bg-white outline-none focus:border-black"
                  >
                    <option value="UZS">UZS</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-gray-400 uppercase tracking-widest mb-1">Начальный баланс</label>
                  <input
                    type="number"
                    value={newAccForm.lastBalance}
                    onChange={(e) => setNewAccForm(prev => ({ ...prev, lastBalance: e.target.value }))}
                    className="w-full border border-gray-200 px-3 py-2 text-sm text-gray-700 bg-white outline-none focus:border-black"
                  />
                </div>
              </div>
              <div>
                <label className="block font-bold text-gray-400 uppercase tracking-widest mb-1">Название банка</label>
                <input
                  type="text"
                  placeholder="Asaka Bank"
                  value={newAccForm.bankName}
                  onChange={(e) => setNewAccForm(prev => ({ ...prev, bankName: e.target.value }))}
                  className="w-full border border-gray-200 px-3 py-2 text-sm text-gray-700 bg-white outline-none focus:border-black"
                />
              </div>
              <div>
                <label className="block font-bold text-gray-400 uppercase tracking-widest mb-1">Номер счёта</label>
                <input
                  type="text"
                  placeholder="20208000600001234567"
                  value={newAccForm.accountNumber}
                  onChange={(e) => setNewAccForm(prev => ({ ...prev, accountNumber: e.target.value }))}
                  className="w-full border border-gray-200 px-3 py-2 text-sm text-gray-700 bg-white outline-none focus:border-black"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddAccount(false)}
                  className="flex-1 border border-gray-200 text-gray-700 text-sm font-medium py-2 hover:bg-gray-50 transition-colors"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-black text-white text-sm font-medium py-2 hover:opacity-80 transition-opacity"
                >
                  Сохранить
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

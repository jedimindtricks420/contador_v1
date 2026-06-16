"use client";

import { useEffect, useState } from "react";
import {
  TrendingDown, TrendingUp, Briefcase, Handshake, Lock, HelpCircle,
  FolderOpen, Folder, Banknote, AlertOctagon, AlertTriangle, X, AlertCircle
} from "lucide-react";
import { formatSum, formatDate, periodLabel } from "@/lib/format";

interface Counterparty {
  id: string;
  name: string;
  inn: string | null;
}

interface Document {
  id: string;
  type: {
    name: string;
    code: string;
  };
  payload: any;
}

interface OpenItem {
  id: string;
  accountId: string;
  counterpartyId: string | null;
  openingDocumentId: string;
  amount: number;
  dateOpened: string;
  status: "OPEN" | "RISK" | "CLOSED";
  riskDeadline: string | null;
  closingDocumentId: string | null;
  dateClosed: string | null;
  affectedPeriodId: string | null;
  account: {
    code: string;
    name: string;
  };
  counterparty: Counterparty | null;
  openingDocument: Document | null;
  closingDocument: Document | null;
}

interface SummaryStats {
  totalOpen: number;
  totalRisk: number;
  amountOpen: number;
  amountRisk: number;
  byAccount: {
    accountCode: string;
    name: string;
    count: number;
    amount: number;
  }[];
}

function AccountIcon({ code }: { code: string }) {
  const icons: Record<string, React.ReactNode> = {
    "6310": <TrendingUp size={18} className="text-gray-500" />,
    "4310": <TrendingDown size={18} className="text-gray-500" />,
    "4220": <Briefcase size={18} className="text-gray-500" />,
    "6820": <Handshake size={18} className="text-gray-500" />,
    "5830": <Lock size={18} className="text-gray-500" />,
    "6990": <HelpCircle size={18} className="text-gray-500" />,
  };
  return <>{icons[code] || <Folder size={18} className="text-gray-500" />}</>;
}

export default function OpenPositionsClient() {
  const [items, setItems] = useState<OpenItem[]>([]);
  const [summary, setSummary] = useState<SummaryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  // Filters
  const [selectedStatus, setSelectedStatus] = useState<string>("UNRESOLVED"); // UNRESOLVED, OPEN, RISK, CLOSED, ALL
  const [selectedAccount, setSelectedAccount] = useState<string>("ALL");
  const [selectedPeriod, setSelectedPeriod] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [periods, setPeriods] = useState<{ id: string; year: number; month: number }[]>([]);

  // Interactive UI Modals
  const [activeItemToClose, setActiveItemToClose] = useState<OpenItem | null>(null);
  const [closingDate, setClosingDate] = useState<string>(
    new Date().toISOString().substring(0, 10)
  );
  const [isClosing, setIsClosing] = useState(false);

  // Details Modal
  const [detailsItem, setDetailsItem] = useState<OpenItem | null>(null);

  // M-08: Reopen confirm
  const [reopenTarget, setReopenTarget] = useState<OpenItem | null>(null);
  const [reopening, setReopening] = useState(false);
  const [reopenError, setReopenError] = useState<string>("");

  // Manual close error
  const [closeError, setCloseError] = useState<string>("");

  const loadFilterData = async () => {
    try {
      const res = await fetch("/v2/api/periods");
      if (res.ok) setPeriods(await res.json());
    } catch (err) {
      console.error(err);
    }
  };

  const loadData = async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const params = new URLSearchParams();
      params.append("status", selectedStatus);
      if (selectedAccount !== "ALL") params.append("accountCode", selectedAccount);
      if (selectedPeriod !== "ALL") params.append("periodId", selectedPeriod);
      if (searchQuery.trim()) params.append("search", searchQuery.trim());

      const res = await fetch(`/v2/api/open-items?${params}`);
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
        setSummary(data.summary || null);
      } else {
        setLoadError(true);
      }
    } catch (err) {
      console.error("Failed to load open positions:", err);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFilterData();
  }, []);

  useEffect(() => {
    loadData();
  }, [selectedStatus, selectedAccount, selectedPeriod]);

  // Debounce search query
  useEffect(() => {
    const delay = setTimeout(() => {
      loadData();
    }, 350);
    return () => clearTimeout(delay);
  }, [searchQuery]);

  const handleManualClose = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeItemToClose) return;

    setIsClosing(true);
    setCloseError("");
    try {
      const res = await fetch(`/v2/api/open-items/${activeItemToClose.id}/close`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dateClosed: new Date(closingDate).toISOString(),
        }),
      });

      if (res.ok) {
        setActiveItemToClose(null);
        loadData();
      } else {
        const errData = await res.json();
        setCloseError(`Ошибка при закрытии позиции: ${errData.error}`);
      }
    } catch {
      setCloseError("Сетевая ошибка при закрытии. Попробуйте снова.");
    } finally {
      setIsClosing(false);
    }
  };

  const handleReopen = async () => {
    if (!reopenTarget) return;
    setReopening(true);
    setReopenError("");
    try {
      const res = await fetch(`/v2/api/open-items/${reopenTarget.id}/reopen`, { method: "POST" });
      if (res.ok) {
        setReopenTarget(null);
        loadData();
      } else {
        const errData = await res.json();
        setReopenError(`Ошибка: ${errData.error}`);
      }
    } catch {
      setReopenError("Ошибка сети. Попробуйте снова.");
    } finally {
      setReopening(false);
    }
  };

  // Group items by accountCode
  const groupedItems = items.reduce<Record<string, { account: OpenItem["account"]; list: OpenItem[] }>>(
    (acc, item) => {
      const code = item.account.code;
      if (!acc[code]) {
        acc[code] = { account: item.account, list: [] };
      }
      acc[code].list.push(item);
      return acc;
    },
    {}
  );

  const getAgeDays = (dateStr: string) => {
    const diffTime = Math.abs(Date.now() - new Date(dateStr).getTime());
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-6 border-b border-gray-200">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Буферные счета и открытые позиции</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Контроль незакрытых авансов, подотчетных сумм и депозитов в реальном времени
          </p>
        </div>

        {/* Status quick tabs */}
        <div className="flex items-center gap-2 bg-gray-100 p-1 rounded border border-gray-200">
          {(
            [
              { id: "UNRESOLVED", label: "Незакрытые" },
              { id: "RISK", label: "Только риски" },
              { id: "CLOSED", label: "Закрытые" },
              { id: "ALL", label: "Все" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedStatus(tab.id)}
              className={`text-xs font-semibold px-4 py-1.5 rounded transition duration-150 whitespace-nowrap ${
                selectedStatus === tab.id
                  ? "bg-white text-gray-800 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
          {/* Card 1: Total unresolved */}
          <div className="bg-white p-5 rounded border border-gray-200 flex items-center justify-between shadow-sm">
            <div>
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Открытых позиций</div>
              <div className="text-2xl font-bold text-gray-800 mt-1">{summary.totalOpen} шт.</div>
            </div>
            <div className="h-10 w-10 rounded bg-gray-100 flex items-center justify-center">
              <FolderOpen size={20} className="text-gray-600" />
            </div>
          </div>

          {/* Card 2: Risk positions */}
          <div className="bg-white p-5 rounded border border-gray-200 flex items-center justify-between shadow-sm">
            <div>
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">В зоне риска просрочки</div>
              <div className="text-2xl font-bold text-rose-600 mt-1">{summary.totalRisk} шт.</div>
            </div>
            <div className="h-10 w-10 rounded bg-rose-50 flex items-center justify-center animate-pulse">
              <AlertTriangle size={20} className="text-rose-600" />
            </div>
          </div>

          {/* Card 3: Total unresolved sum */}
          <div className="bg-white p-5 rounded border border-gray-200 flex items-center justify-between shadow-sm">
            <div>
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Сумма в расчётах</div>
              <div className="text-xl font-bold text-gray-800 mt-1.5">{formatSum(summary.amountOpen)}</div>
            </div>
            <div className="h-10 w-10 rounded bg-gray-50 flex items-center justify-center">
              <Banknote size={20} className="text-gray-600" />
            </div>
          </div>

          {/* Card 4: Risk amount */}
          <div className="bg-white p-5 rounded border border-gray-200 flex items-center justify-between shadow-sm">
            <div>
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Сумма под риском</div>
              <div className="text-xl font-bold text-rose-600 mt-1.5">{formatSum(summary.amountRisk)}</div>
            </div>
            <div className="h-10 w-10 rounded bg-rose-50 flex items-center justify-center">
              <AlertOctagon size={20} className="text-rose-600" />
            </div>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white rounded border border-gray-200 p-4 flex flex-col md:flex-row gap-4 justify-between items-center shadow-sm">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <input
            type="text"
            placeholder="Поиск по контрагенту или ИНН..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-gray-50 hover:bg-gray-100/70 focus:bg-white border border-gray-200 rounded pl-3 pr-8 py-2 text-xs text-gray-700 outline-hidden focus:border-black transition duration-150"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600 text-xs"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Dropdown filters */}
        <div className="flex gap-4 w-full md:w-auto overflow-x-auto">
          {/* Account Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-400 whitespace-nowrap">Счет:</span>
            <select
              value={selectedAccount}
              onChange={(e) => setSelectedAccount(e.target.value)}
              className="bg-white border border-gray-200 rounded px-2.5 py-1.5 text-xs text-gray-700 outline-hidden focus:border-black"
            >
              <option value="ALL">Все буферные счета</option>
              <option value="6310">6310 (Авансы полученные)</option>
              <option value="4310">4310 (Авансы выданные)</option>
              <option value="4220">4220 (Подотчетные средства)</option>
              <option value="6820">6820 (Займы учредителя)</option>
              <option value="5830">5830 (Гарантийные депозиты)</option>
              <option value="6990">6990 (Невыясненные платежи)</option>
            </select>
          </div>

          {/* Period Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-400 whitespace-nowrap">Период:</span>
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="bg-white border border-gray-200 rounded px-2.5 py-1.5 text-xs text-gray-700 outline-hidden focus:border-black"
            >
              <option value="ALL">Все месяцы</option>
              {periods.map((p) => (
                <option key={p.id} value={p.id}>
                  {periodLabel(p.year, p.month)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Grouped List */}
      <div className="space-y-6">
        {loading ? (
          <div className="bg-white rounded border border-gray-200 py-16 text-center text-gray-400 font-medium">
            <div className="flex justify-center items-center gap-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-300"></div>
              Загрузка позиций...
            </div>
          </div>
        ) : loadError ? (
          <div className="bg-rose-50 border border-rose-200 rounded p-8 text-center space-y-3">
            <AlertTriangle className="h-8 w-8 text-rose-400 mx-auto" />
            <p className="text-sm font-bold text-rose-800">Не удалось загрузить открытые позиции</p>
            <p className="text-xs text-rose-600">Проверьте подключение к сети и попробуйте снова.</p>
            <button
              onClick={loadData}
              className="inline-flex items-center gap-1.5 text-xs bg-rose-600 hover:bg-rose-700 text-white font-bold py-2 px-4 rounded transition"
            >
              Повторить
            </button>
          </div>
        ) : Object.keys(groupedItems).length === 0 ? (
          <div className="bg-white rounded border border-gray-200 py-20 text-center text-gray-400 space-y-2">
            <FolderOpen className="h-10 w-10 text-gray-300 mx-auto" />
            {selectedStatus !== "UNRESOLVED" || selectedAccount !== "ALL" || selectedPeriod !== "ALL" || searchQuery ? (
              <>
                <div className="font-semibold text-gray-700">Ничего не найдено</div>
                <div className="text-[11px] text-gray-400 max-w-sm mx-auto">
                  Ни одна позиция не соответствует выбранным фильтрам. Попробуйте изменить параметры поиска.
                </div>
              </>
            ) : (
              <>
                <div className="font-semibold text-gray-700">Открытые позиции отсутствуют</div>
                <div className="text-[11px] text-gray-400 max-w-sm mx-auto">
                  В системе нет незакрытых буферных сумм. Все расчеты завершены.
                </div>
              </>
            )}
          </div>
        ) : (
          Object.entries(groupedItems).map(([code, group]) => {
            const groupSum = group.list.reduce((sum, item) => sum + Number(item.amount), 0);

            return (
              <div key={code} className="bg-white rounded border border-gray-200 overflow-hidden shadow-sm">
                {/* Group Header */}
                <div className="bg-gray-50/50 p-4 px-5 border-b border-gray-250 flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <AccountIcon code={code} />
                    <div>
                      <span className="font-mono font-bold text-gray-800 mr-2">{code}</span>
                      <span className="text-xs font-bold text-gray-700">{group.account.name}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-gray-400 font-semibold mr-3">
                      Позиций: {group.list.length}
                    </span>
                    <span className="text-xs font-bold text-gray-800 bg-gray-100/70 border border-gray-200 py-1 px-3 rounded">
                      {formatSum(groupSum)}
                    </span>
                  </div>
                </div>

                {/* Group Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50/20 border-b border-gray-100 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                        <th className="py-2.5 px-5">Контрагент</th>
                        <th className="py-2.5 px-5">Дата открытия</th>
                        <th className="py-2.5 px-5">Предельный срок</th>
                        <th className="py-2.5 px-5">Сумма</th>
                        <th className="py-2.5 px-5">Возраст позиции</th>
                        <th className="py-2.5 px-5">Статус</th>
                        <th className="py-2.5 px-5 text-right">Действия</th>
                      </tr>
                    </thead>
                    <tbody className="text-xs text-gray-700 divide-y divide-gray-100">
                      {group.list.map((item) => {
                        const age = getAgeDays(item.dateOpened);
                        const isRisk = item.status === "RISK";
                        const isClosed = item.status === "CLOSED";

                        return (
                          <tr key={item.id} className="hover:bg-gray-50/30 transition duration-150">
                            {/* Counterparty */}
                            <td className="py-3 px-5">
                              {item.counterparty ? (
                                <div className="space-y-0.5">
                                  <div className="font-bold text-gray-800">{item.counterparty.name}</div>
                                  {item.counterparty.inn && (
                                    <div className="text-[10px] text-gray-400 font-mono">
                                      ИНН: {item.counterparty.inn}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="text-gray-400 italic">
                                  {(item.openingDocument?.payload as any)?.counterpartyHint || "Неизвестный контрагент"}
                                </div>
                              )}
                            </td>

                            {/* Date opened */}
                            <td className="py-3 px-5 whitespace-nowrap text-gray-500 font-medium">
                              {formatDate(item.dateOpened)}
                            </td>

                            {/* Risk deadline */}
                            <td className="py-3 px-5 whitespace-nowrap text-gray-500 font-medium">
                              {item.riskDeadline ? formatDate(item.riskDeadline) : "—"}
                            </td>

                            {/* Amount */}
                            <td className="py-3 px-5 font-bold text-gray-800 whitespace-nowrap">
                              {formatSum(item.amount)}
                            </td>

                            {/* Age */}
                            <td className="py-3 px-5 whitespace-nowrap font-medium text-gray-600">
                              {isClosed ? (
                                <span className="text-gray-400">Закрыто за {getAgeDays(item.dateOpened) - getAgeDays(item.dateClosed || "")} дн.</span>
                              ) : isRisk ? (
                                <span className="text-rose-600 font-bold flex items-center gap-1"><AlertCircle size={12} />{age} дн. (Просрочено)</span>
                              ) : (
                                <span className="text-gray-500">⏳ {age} дн.</span>
                              )}
                            </td>

                            {/* Status */}
                            <td className="py-3 px-5">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold border ${
                                  isClosed
                                    ? "bg-gray-100 border-gray-200 text-gray-400"
                                    : isRisk
                                    ? "bg-rose-50 border-rose-100 text-rose-700 animate-pulse"
                                    : "bg-gray-100 border-gray-300 text-black"
                                }`}
                              >
                                {isClosed ? "Закрыто" : isRisk ? "Риск просрочки" : "Открыто"}
                              </span>
                            </td>

                            {/* Actions */}
                            <td className="py-3 px-5 text-right space-x-2 whitespace-nowrap">
                              <button
                                onClick={() => setDetailsItem(item)}
                                className="text-[11px] bg-gray-100 hover:bg-gray-200 text-gray-700 py-1 px-2.5 rounded-md font-semibold transition"
                              >
                                Документ
                              </button>
                              {!isClosed && (
                                <button
                                  onClick={() => {
                                    setActiveItemToClose(item);
                                    setClosingDate(new Date().toISOString().substring(0, 10));
                                    setCloseError("");
                                  }}
                                  className="text-[11px] bg-black hover:opacity-80 text-white py-1 px-2.5 rounded-md font-semibold transition shadow-sm"
                                >
                                  Закрыть вручную
                                </button>
                              )}
                              {isClosed && item.closingDocumentId === null && (
                                <button
                                  onClick={() => { setReopenTarget(item); setReopenError(""); }}
                                  className="text-[11px] border border-gray-200 hover:border-gray-400 text-gray-500 hover:text-gray-700 py-1 px-2.5 rounded-md font-semibold transition"
                                >
                                  Открыть повторно
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Manual Close Modal */}
      {activeItemToClose && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded shadow-xl border border-gray-200 w-full max-w-md overflow-hidden transform transition duration-300 scale-100">
            <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-sm font-bold text-gray-800">Ручное закрытие позиции</h3>
              <button
                onClick={() => setActiveItemToClose(null)}
                className="text-gray-400 hover:text-gray-600 text-sm p-1 rounded-md"
              >
                <X size={14} />
              </button>
            </div>

            <form onSubmit={handleManualClose} className="p-6 space-y-4">
              <div className="bg-gray-50 border border-gray-200 p-3.5 rounded text-gray-600 text-[11px] font-semibold leading-relaxed">
                <AlertTriangle size={13} className="inline mr-1.5 text-amber-500" />Подтвердите ручное закрытие открытой позиции для контрагента{" "}
                <strong>
                  {activeItemToClose.counterparty?.name ||
                    (activeItemToClose.openingDocument?.payload as any)?.counterpartyHint ||
                    "данного контрагента"}
                </strong>{" "}
                на сумму <strong>{formatSum(activeItemToClose.amount)}</strong>. Позиция будет исключена из списков просрочек и рисков.
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-500">Дата закрытия обязательства</label>
                <input
                  type="date"
                  value={closingDate}
                  onChange={(e) => setClosingDate(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded px-3 py-2 text-xs text-gray-700 outline-hidden focus:border-black"
                  required
                />
              </div>

              {closeError && (
                <div className="p-2 bg-rose-50 border border-rose-200 rounded text-xs text-rose-700 font-semibold">
                  {closeError}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setActiveItemToClose(null)}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold py-2 px-4 rounded transition"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={isClosing}
                  className="bg-black hover:opacity-80 text-white text-xs font-bold py-2 px-5 rounded transition disabled:opacity-50 shadow-sm"
                >
                  {isClosing ? "Закрываем..." : "Подтвердить закрытие"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Opening Document Details Modal */}
      {detailsItem && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded shadow-xl border border-gray-200 w-full max-w-lg overflow-hidden transform transition duration-300 scale-100">
            <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-sm font-bold text-gray-800">Документ открытия позиции</h3>
              <button
                onClick={() => setDetailsItem(null)}
                className="text-gray-400 hover:text-gray-600 text-sm p-1 rounded-md"
              >
                <X size={14} />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs text-gray-700">
              <div className="grid grid-cols-3 py-1.5 border-b border-gray-50">
                <span className="font-semibold text-gray-400">Тип документа:</span>
                <span className="col-span-2 font-bold text-gray-800">
                  {detailsItem.openingDocument?.type?.name || "Первичный документ"}
                </span>
              </div>
              <div className="grid grid-cols-3 py-1.5 border-b border-gray-50">
                <span className="font-semibold text-gray-400">Код типа:</span>
                <span className="col-span-2 font-mono font-bold text-gray-600">
                  {detailsItem.openingDocument?.type?.code || "—"}
                </span>
              </div>
              <div className="grid grid-cols-3 py-1.5 border-b border-gray-50">
                <span className="font-semibold text-gray-400">Дата документа:</span>
                <span className="col-span-2 font-bold text-gray-800">
                  {formatDate(detailsItem.dateOpened)}
                </span>
              </div>
              <div className="grid grid-cols-3 py-1.5 border-b border-gray-50">
                <span className="font-semibold text-gray-400">Первоначальная сумма:</span>
                <span className="col-span-2 font-bold text-gray-800">
                  {formatSum(detailsItem.amount)}
                </span>
              </div>
              {detailsItem.openingDocument?.payload && (
                <div className="space-y-1.5 pt-2">
                  <span className="font-semibold text-gray-400 block">Содержимое документа (Payload):</span>
                  <pre className="bg-gray-50 border border-gray-200 rounded p-3 text-[10px] font-mono text-gray-600 overflow-x-auto leading-relaxed max-h-[150px]">
                    {JSON.stringify(detailsItem.openingDocument.payload, null, 2)}
                  </pre>
                </div>
              )}

              {detailsItem.status === "CLOSED" && detailsItem.closingDocument && (
                <div className="mt-4 pt-4 border-t border-gray-150 space-y-2 bg-gray-50/50 p-4 rounded">
                  <h4 className="font-bold text-gray-800 text-xs">Документ закрытия обязательства</h4>
                  <div className="grid grid-cols-3 py-1">
                    <span className="font-semibold text-gray-400">Тип закрытия:</span>
                    <span className="col-span-2 font-bold text-gray-800">
                      {detailsItem.closingDocument.type?.name || "Первичный документ"}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 py-1">
                    <span className="font-semibold text-gray-400">Дата закрытия:</span>
                    <span className="col-span-2 font-bold text-gray-850">
                      {detailsItem.dateClosed ? formatDate(detailsItem.dateClosed) : "—"}
                    </span>
                  </div>
                </div>
              )}

              <div className="flex justify-end pt-4 border-t border-gray-100">
                <button
                  onClick={() => setDetailsItem(null)}
                  className="bg-gray-800 hover:bg-gray-900 text-white text-xs font-bold py-2.5 px-6 rounded transition"
                >
                  Закрыть
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* M-08: Reopen confirm modal */}
      {reopenTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded border border-gray-200 shadow-xl max-w-sm w-full p-6 space-y-4">
            <h3 className="text-sm font-bold text-gray-900">Открыть позицию повторно?</h3>
            <p className="text-xs text-gray-600">
              Позиция для <strong>{reopenTarget.counterparty?.name || "контрагента"}</strong> на сумму{" "}
              <strong>{new Intl.NumberFormat("ru-RU").format(Number(reopenTarget.amount))} сум</strong>{" "}
              будет возвращена в статус «Открытая».
            </p>
            {reopenError && (
              <div className="p-2 bg-rose-50 border border-rose-200 rounded text-xs text-rose-700 font-semibold">
                {reopenError}
              </div>
            )}
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setReopenTarget(null)}
                className="flex-1 text-xs border border-gray-200 text-gray-700 font-bold py-2.5 rounded hover:bg-gray-50 transition"
              >
                Отмена
              </button>
              <button
                onClick={handleReopen}
                disabled={reopening}
                className="flex-1 text-xs bg-black hover:opacity-80 text-white font-bold py-2.5 rounded transition disabled:opacity-50"
              >
                {reopening ? "Открываем..." : "Открыть повторно"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

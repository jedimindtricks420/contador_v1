"use client";

import { useEffect, useState } from "react";
import { X, Loader2 } from "lucide-react";
import { formatSum, formatDate, periodLabel } from "@/lib/format";

interface BankAccount {
  id: string;
  name: string;
  currency: string;
}

interface Period {
  id: string;
  year: number;
  month: number;
  status: string;
}

interface DocumentType {
  id: string;
  code: string;
  name: string;
}

interface JournalEntry {
  id: string;
  debit: string;
  credit: string;
  account: {
    code: string;
    name: string;
  };
}

interface Document {
  id: string;
  type: {
    id: string;
    name: string;
    code: string;
  };
  journalEntries: JournalEntry[];
}

interface Transaction {
  id: string;
  date: string;
  amount: string;
  direction: "CREDIT" | "DEBIT";
  description: string;
  counterpartyHint: string | null;
  counterpartyInn: string | null;
  status: "IMPORTED" | "AUTO_MATCHED" | "NEEDS_CLARIFICATION" | "CONFIRMED" | "POSTED" | "SKIPPED";
  bankAccount: { name: string; currency: string };
  document: Document | null;
}

const STATUS_CONFIGS: Record<string, { label: string; className: string }> = {
  IMPORTED:            { label: "Импортирован",  className: "bg-gray-50 text-gray-500 border border-gray-200" },
  AUTO_MATCHED:        { label: "Авто",          className: "bg-gray-100 text-gray-700 border border-gray-200" },
  NEEDS_CLARIFICATION: { label: "Уточнить",      className: "bg-gray-900 text-white border border-gray-900" },
  CONFIRMED:           { label: "Подтверждён",   className: "bg-gray-100 text-gray-700 border border-gray-200" },
  POSTED:              { label: "Проведён",       className: "bg-black text-white border border-black" },
  SKIPPED:             { label: "Пропущен",       className: "bg-gray-50 text-gray-400 border border-gray-200" },
};

export default function TransactionsClient() {
  const [items, setItems] = useState<Transaction[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const [periods, setPeriods] = useState<Period[]>([]);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [categories, setCategories] = useState<DocumentType[]>([]);

  const [selectedPeriod, setSelectedPeriod] = useState<string>("ALL");
  const [selectedAccount, setSelectedAccount] = useState<string>("ALL");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [selectedDirection, setSelectedDirection] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [rulePromptTx, setRulePromptTx] = useState<Transaction | null>(null);
  const [rulePromptCategory, setRulePromptCategory] = useState<string>("");

  // M-06: undo toast after rule creation
  const [undoToast, setUndoToast] = useState<{
    ruleId: string; matchValue: string; timeoutId: ReturnType<typeof setTimeout>;
  } | null>(null);
  const [updatingTxId, setUpdatingTxId] = useState<string | null>(null);

  // H-03: inline action error
  const [actionError, setActionError] = useState<string | null>(null);

  const loadFilters = async () => {
    try {
      const [periodsRes, accountsRes, categoriesRes] = await Promise.all([
        fetch("/v2/api/periods"),
        fetch("/v2/api/bank-accounts"),
        fetch("/v2/api/document-types"),
      ]);
      if (periodsRes.ok) setPeriods(await periodsRes.json());
      if (accountsRes.ok) setAccounts(await accountsRes.json());
      if (categoriesRes.ok) setCategories(await categoriesRes.json());
    } catch (err) {
      console.error("Failed to load transactions filters:", err);
    }
  };

  const loadTransactions = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append("page", currentPage.toString());
      params.append("limit", "50");
      if (statusFilter !== "ALL") params.append("status", statusFilter);
      if (selectedPeriod !== "ALL") params.append("periodId", selectedPeriod);
      if (selectedAccount !== "ALL") params.append("accountId", selectedAccount);
      if (selectedCategory !== "ALL") params.append("categoryId", selectedCategory);
      if (selectedDirection !== "ALL") params.append("direction", selectedDirection);
      if (searchQuery.trim()) params.append("search", searchQuery.trim());

      const res = await fetch(`/v2/api/transactions?${params}`);
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
        setTotal(data.total || 0);
        setPages(data.pages || 1);
        if (selectedTx) {
          const fresh = (data.items || []).find((x: Transaction) => x.id === selectedTx.id);
          if (fresh) setSelectedTx(fresh);
        }
      }
    } catch (err) {
      console.error("Failed to fetch transactions:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadFilters(); }, []);

  useEffect(() => {
    loadTransactions();
  }, [currentPage, selectedPeriod, selectedAccount, selectedCategory, selectedDirection, statusFilter]);

  useEffect(() => {
    const delay = setTimeout(() => {
      setCurrentPage(1);
      loadTransactions();
    }, 350);
    return () => clearTimeout(delay);
  }, [searchQuery]);

  const handleSkipToggle = async (tx: Transaction) => {
    setUpdatingTxId(tx.id);
    setActionError(null);
    try {
      const res = await fetch(`/v2/api/transactions/${tx.id}/skip`, { method: "PATCH" });
      if (res.ok) {
        loadTransactions();
      } else {
        const data = await res.json();
        setActionError(`Ошибка: ${data.error}`);
      }
    } catch {
      setActionError("Ошибка сети при изменении статуса");
    } finally {
      setUpdatingTxId(null);
    }
  };

  const handleCategoryChange = async (tx: Transaction, categoryId: string) => {
    if (!categoryId) return;
    setUpdatingTxId(tx.id);
    setActionError(null);
    try {
      const res = await fetch(`/v2/api/transactions/${tx.id}/category`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentTypeId: categoryId, createRule: false }),
      });
      if (res.ok) {
        setRulePromptTx(tx);
        setRulePromptCategory(categoryId);
        loadTransactions();
      } else {
        const data = await res.json();
        setActionError(`Ошибка при смене категории: ${data.error}`);
      }
    } catch {
      setActionError("Ошибка сети при смене категории");
    } finally {
      setUpdatingTxId(null);
    }
  };

  const handleConfirmRule = async (saveRule: boolean) => {
    if (!rulePromptTx) return;
    if (saveRule) {
      const matchType = rulePromptTx.counterpartyInn ? "INN" : "KEYWORD";
      const matchValue = rulePromptTx.counterpartyInn || rulePromptTx.counterpartyHint || rulePromptTx.description;
      try {
        const res = await fetch("/v2/api/rules", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ matchType, matchValue, categoryId: rulePromptCategory }),
        });
        if (res.ok) {
          const data = await res.json();
          // Clear any existing toast first
          if (undoToast) clearTimeout(undoToast.timeoutId);
          const timeoutId = setTimeout(() => setUndoToast(null), 15000);
          setUndoToast({ ruleId: data.id, matchValue: matchValue || "", timeoutId });
        }
      } catch (err) {
        console.error("Failed to save auto-classification rule:", err);
      }
    }
    setRulePromptTx(null);
    setRulePromptCategory("");
  };

  const handleUndoRule = async () => {
    if (!undoToast) return;
    if (undoToast.timeoutId) clearTimeout(undoToast.timeoutId);
    try {
      await fetch(`/v2/api/rules/${undoToast.ruleId}`, { method: "DELETE" });
    } catch (err) {
      console.error("Failed to undo rule:", err);
    }
    setUndoToast(null);
  };

  return (
    <div className="relative min-h-[calc(100vh-100px)]">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-6 border-b border-gray-200 mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900 uppercase">Реестр операций</h1>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">
            Журнал выписок банков с возможностью переквалификации и сверки счетов
          </p>
        </div>

        {/* Status quick tabs */}
        <div className="flex items-center gap-1 bg-gray-100 p-1 border border-gray-200">
          {(
            [
              { id: "ALL", label: "Все операции" },
              { id: "attention", label: "Требуют внимания" },
              { id: "SKIPPED", label: "Пропущенные" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => { setStatusFilter(tab.id); setCurrentPage(1); }}
              className={`text-xs font-medium px-4 py-1.5 transition-colors whitespace-nowrap ${
                statusFilter === tab.id
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white border border-gray-200 p-5 mb-6 shadow-sm space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
          <div className="relative md:col-span-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Поиск</label>
            <input
              type="text"
              placeholder="Текст / ИНН..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full border border-gray-200 px-3 py-1.5 pr-8 text-xs text-gray-700 bg-white outline-none focus:border-black transition-colors"
            />
            {loading && searchQuery ? (
              <Loader2 size={14} className="absolute right-2.5 top-7 text-gray-400 animate-spin" />
            ) : searchQuery ? (
              <button onClick={() => setSearchQuery("")} className="absolute right-2.5 top-7 text-gray-400 hover:text-gray-600 text-xs"><X size={14} /></button>
            ) : null}
          </div>

          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Период</label>
            <select
              value={selectedPeriod}
              onChange={(e) => { setSelectedPeriod(e.target.value); setCurrentPage(1); }}
              className="w-full border border-gray-200 px-2.5 py-1.5 text-xs text-gray-700 bg-white outline-none focus:border-black"
            >
              <option value="ALL">Все месяцы</option>
              {periods.map((p) => (
                <option key={p.id} value={p.id}>
                  {periodLabel(p.year, p.month)} ({p.status === "CLOSED" ? "Закр" : "Откр"})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Счет</label>
            <select
              value={selectedAccount}
              onChange={(e) => { setSelectedAccount(e.target.value); setCurrentPage(1); }}
              className="w-full border border-gray-200 px-2.5 py-1.5 text-xs text-gray-700 bg-white outline-none focus:border-black"
            >
              <option value="ALL">Все счета</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Категория</label>
            <select
              value={selectedCategory}
              onChange={(e) => { setSelectedCategory(e.target.value); setCurrentPage(1); }}
              className="w-full border border-gray-200 px-2.5 py-1.5 text-xs text-gray-700 bg-white outline-none focus:border-black"
            >
              <option value="ALL">Все категории</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Направление</label>
            <select
              value={selectedDirection}
              onChange={(e) => { setSelectedDirection(e.target.value); setCurrentPage(1); }}
              className="w-full border border-gray-200 px-2.5 py-1.5 text-xs text-gray-700 bg-white outline-none focus:border-black"
            >
              <option value="ALL">Все</option>
              <option value="CREDIT">Приход (+)</option>
              <option value="DEBIT">Расход (-)</option>
            </select>
          </div>
        </div>
      </div>

      {/* H-03: Inline action error banner */}
      {actionError && (
        <div className="flex items-center justify-between bg-rose-50 border border-rose-200 rounded p-3 mb-4 text-xs text-rose-800 font-semibold">
          <span>{actionError}</span>
          <button onClick={() => setActionError(null)} className="ml-3 text-rose-600 hover:text-rose-800"><X size={14} /></button>
        </div>
      )}

      {/* Main Table */}
      <div className="bg-white border border-gray-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                <th className="py-3.5 px-5">Дата</th>
                <th className="py-3.5 px-5">Счет</th>
                <th className="py-3.5 px-5 w-[38%]">Контрагент / Назначение</th>
                <th className="py-3.5 px-5">Сумма</th>
                <th className="py-3.5 px-5">Категория</th>
                <th className="py-3.5 px-5">Статус</th>
                <th className="py-3.5 px-5 text-right">Действия</th>
              </tr>
            </thead>
            <tbody className="text-xs divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-gray-400 font-medium">
                    <div className="flex justify-center items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-black"></div>
                      Загрузка операций...
                    </div>
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-20 text-center text-gray-400 space-y-2">
                    <div className="text-4xl">↕</div>
                    <div className="font-semibold text-gray-700">Транзакций не найдено</div>
                    <div className="text-[11px] text-gray-400 max-w-xs mx-auto">
                      Попробуйте сбросить фильтры или ввести другой поисковый запрос.
                    </div>
                  </td>
                </tr>
              ) : (
                items.map((tx) => {
                  const status = STATUS_CONFIGS[tx.status] || STATUS_CONFIGS.IMPORTED;
                  const isDebit = tx.direction === "DEBIT";
                  const isSkipped = tx.status === "SKIPPED";
                  const isUpdating = updatingTxId === tx.id;

                  return (
                    <tr
                      key={tx.id}
                      className={`hover:bg-gray-50 transition-colors group ${isSkipped ? "opacity-50" : ""}`}
                    >
                      <td className="py-3.5 px-5 text-gray-500 font-medium whitespace-nowrap">
                        {formatDate(tx.date)}
                      </td>
                      <td className="py-3.5 px-5 text-gray-500 whitespace-nowrap">
                        {tx.bankAccount?.name}
                      </td>
                      <td className="py-3.5 px-5 max-w-[280px]">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-gray-800">
                            {tx.counterpartyHint || "Неизвестный контрагент"}
                          </span>
                          {tx.counterpartyInn && (
                            <span className="bg-gray-100 text-gray-500 text-[9px] font-mono px-1">
                              {tx.counterpartyInn}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-gray-400 truncate mt-0.5" title={tx.description}>
                          {tx.description}
                        </div>
                      </td>
                      <td className={`py-3.5 px-5 font-bold whitespace-nowrap font-mono ${isDebit ? "text-gray-900" : "text-gray-900"}`}>
                        {isDebit ? "−" : "+"}{formatSum(tx.amount)}
                      </td>
                      <td className="py-3 px-5">
                        <select
                          disabled={isSkipped || isUpdating}
                          value={tx.document?.type?.id || ""}
                          onChange={(e) => handleCategoryChange(tx, e.target.value)}
                          className="bg-transparent border-none py-1.5 px-1 pr-6 font-semibold text-gray-800 focus:bg-white text-xs cursor-pointer outline-none hover:bg-gray-100 transition-colors"
                        >
                          <option value="" disabled>— Выберите категорию —</option>
                          {categories.map((c) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      </td>
                      <td className="py-3.5 px-5">
                        <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-semibold ${status.className}`}>
                          {status.label}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 text-right space-x-1 whitespace-nowrap">
                        <button
                          onClick={() => setSelectedTx(tx)}
                          className="text-xs border border-gray-200 text-gray-700 py-1.5 px-3 hover:bg-gray-50 font-medium transition-colors"
                        >
                          Детали
                        </button>
                        <button
                          onClick={() => handleSkipToggle(tx)}
                          disabled={isUpdating}
                          className={`text-xs border py-1.5 px-3 font-medium transition-colors ${
                            isSkipped
                              ? "border-gray-200 text-gray-600 hover:bg-gray-50"
                              : "border-gray-200 text-gray-400 hover:text-gray-700 hover:bg-gray-50"
                          }`}
                        >
                          {isSkipped ? "Восстановить" : "Пропустить"}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pages > 1 && (
          <div className="bg-gray-50 px-5 py-4 border-t border-gray-200 flex justify-between items-center text-xs font-medium text-gray-500">
            <div>Показано {items.length} из {total} операций</div>
            <div className="flex gap-2 items-center">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                className="border border-gray-200 px-3 py-1.5 text-gray-600 hover:bg-gray-100 disabled:opacity-50 transition-colors bg-white"
              >
                ← Назад
              </button>
              <span>Стр. {currentPage} из {pages}</span>
              <button
                disabled={currentPage === pages}
                onClick={() => setCurrentPage(p => Math.min(pages, p + 1))}
                className="border border-gray-200 px-3 py-1.5 text-gray-600 hover:bg-gray-100 disabled:opacity-50 transition-colors bg-white"
              >
                Вперед →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Side Details Drawer */}
      {selectedTx && (
        <div className="fixed inset-0 overflow-hidden z-50">
          <div className="absolute inset-0 bg-black/30" onClick={() => setSelectedTx(null)} />
          <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-xl bg-white shadow-xl flex flex-col border-l border-gray-200">
              <div className="p-6 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                <div>
                  <h3 className="text-xs font-bold text-gray-900 uppercase tracking-widest">Детали операции</h3>
                  <p className="text-[11px] text-gray-400 font-medium mt-0.5">ID: {selectedTx.id}</p>
                </div>
                <button onClick={() => setSelectedTx(null)} className="text-gray-400 hover:text-gray-600 p-1.5 hover:bg-gray-100 transition-colors"><X size={14} /></button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                <div className="space-y-3">
                  <div className="flex justify-between border-b border-gray-100 pb-2">
                    <span className="text-gray-400 text-xs font-semibold">Дата операции:</span>
                    <span className="text-gray-800 text-xs font-bold">{formatDate(selectedTx.date)}</span>
                  </div>
                  <div className="flex justify-between border-b border-gray-100 pb-2">
                    <span className="text-gray-400 text-xs font-semibold">Банковский счет:</span>
                    <span className="text-gray-800 text-xs font-bold">{selectedTx.bankAccount?.name}</span>
                  </div>
                  <div className="flex justify-between border-b border-gray-100 pb-2">
                    <span className="text-gray-400 text-xs font-semibold">Сумма операции:</span>
                    <span className="text-sm font-bold text-gray-900">
                      {selectedTx.direction === "DEBIT" ? "−" : "+"}{formatSum(selectedTx.amount)}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-gray-400 text-[10px] font-bold uppercase tracking-wider block">Назначение платежа:</span>
                    <p className="text-gray-700 bg-gray-50 border border-gray-200 p-3 text-xs leading-relaxed">
                      {selectedTx.description}
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-gray-800 border-b border-gray-200 pb-2 flex justify-between items-center uppercase tracking-widest">
                    <span>Бухгалтерские проводки</span>
                    {selectedTx.document && (
                      <span className="bg-gray-100 text-gray-500 font-mono text-[9px] px-1.5 py-0.5">
                        {selectedTx.document.type.code}
                      </span>
                    )}
                  </h4>

                  {selectedTx.status === "SKIPPED" ? (
                    <div className="text-center py-6 text-gray-400 text-xs italic bg-gray-50 border border-gray-100">
                      Операция пропущена. Проводки не формируются.
                    </div>
                  ) : !selectedTx.document?.journalEntries || selectedTx.document.journalEntries.length === 0 ? (
                    <div className="text-center py-6 text-gray-400 text-xs italic bg-gray-50 border border-gray-100">
                      Для данной категории проводки отсутствуют или документ еще не проведен.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="grid grid-cols-12 text-[10px] font-bold text-gray-400 uppercase pb-1 border-b border-gray-100">
                        <div className="col-span-2">Дебет</div>
                        <div className="col-span-2">Кредит</div>
                        <div className="col-span-5">Счёт</div>
                        <div className="col-span-3 text-right">Сумма</div>
                      </div>
                      {selectedTx.document.journalEntries.map((je) => {
                        const isDebit = Number(je.debit) > 0;
                        const sum = isDebit ? je.debit : je.credit;
                        return (
                          <div key={je.id} className="grid grid-cols-12 text-xs py-2 border-b border-gray-50 items-center">
                            <div className="col-span-2 font-mono font-bold text-gray-800">{isDebit ? je.account.code : "—"}</div>
                            <div className="col-span-2 font-mono font-bold text-gray-800">{!isDebit ? je.account.code : "—"}</div>
                            <div className="col-span-5 truncate pr-2">
                              <div className="text-gray-800 font-semibold">{je.account.name}</div>
                              <div className="text-[10px] text-gray-400 font-mono">{isDebit ? "Дебетовый счёт" : "Кредитовый счёт"}</div>
                            </div>
                            <div className="col-span-3 text-right font-bold text-gray-900 whitespace-nowrap">{formatSum(sum)}</div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className="p-6 border-t border-gray-200 bg-gray-50 flex justify-end">
                <button
                  onClick={() => setSelectedTx(null)}
                  className="bg-black text-white text-xs font-bold py-2 px-6 hover:opacity-80 transition-opacity"
                >
                  Закрыть
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rule Recommendation Modal */}
      {rulePromptTx && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-gray-200 shadow-sm w-full max-w-md p-6 space-y-4">
            <h3 className="text-xs font-bold text-gray-900 uppercase tracking-widest text-center">
              Создать правило автоклассификации?
            </h3>
            <p className="text-xs text-gray-500 text-center leading-relaxed">
              Вы выбрали категорию для контрагента{" "}
              <strong className="text-gray-800">
                {rulePromptTx.counterpartyHint || "этого плательщика"}
              </strong>
              . Запомнить этот выбор для всех будущих операций?
            </p>

            <div className="flex justify-center gap-3 pt-2">
              <button
                onClick={() => handleConfirmRule(false)}
                className="border border-gray-200 text-gray-700 text-xs font-medium py-2 px-4 hover:bg-gray-50 transition-colors"
              >
                Только для этой
              </button>
              <button
                onClick={() => handleConfirmRule(true)}
                className="bg-black text-white text-xs font-bold py-2 px-5 hover:opacity-80 transition-opacity"
              >
                Да, запомнить выбор
              </button>
            </div>
          </div>
        </div>
      )}

      {/* M-06: Undo rule toast */}
      {undoToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-gray-900 text-white text-xs font-semibold rounded shadow-xl flex items-center gap-3 px-4 py-3 max-w-xs animate-fade-in">
          <span className="truncate">Правило создано для «{undoToast.matchValue}»</span>
          <button
            onClick={handleUndoRule}
            className="shrink-0 text-amber-400 hover:text-amber-300 font-bold underline underline-offset-2 transition"
          >
            Отменить
          </button>
          <button onClick={() => { clearTimeout(undoToast.timeoutId); setUndoToast(null); }} className="shrink-0 text-gray-400 hover:text-white">
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

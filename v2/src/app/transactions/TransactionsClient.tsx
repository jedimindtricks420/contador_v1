"use client";

import { useEffect, useRef, useState } from "react";
import { X, Loader2 } from "lucide-react";
import { formatSum, formatDate, periodLabel } from "@/lib/format";
import { TRANSIT_INNS } from "@/lib/constants";

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
  bankAccount: { name: string; currency: string; bankName: string | null; accountNumber: string | null };
  document: Document | null;
}

// One row inside the "other transactions from this counterparty" modal.
interface CounterpartyTx {
  id: string;
  date: string;
  amount: number;
  direction: "CREDIT" | "DEBIT";
  description: string;
  counterpartyHint: string | null;
  status: string;
  categoryId: string | null;
  categoryName: string | null;
  selectable: boolean;
}

// Searchable combobox for category selection.
// allOption: if provided, adds "All" option with that value (used in filter bar).
// compact: smaller styling for use inside table rows.
function CategoryCombobox({
  options,
  value,
  onChange,
  allOption,
  compact = false,
  disabled = false,
}: {
  options: DocumentType[];
  value: string;
  onChange: (id: string) => void;
  allOption?: { value: string; label: string };
  compact?: boolean;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const allOptions = allOption
    ? [{ id: allOption.value, code: "__all__", name: allOption.label }, ...options]
    : options;

  const selectedName = allOptions.find(o => o.id === value)?.name ?? "";
  const filtered = query.length > 0
    ? options.filter(o =>
        o.name.toLowerCase().includes(query.toLowerCase()) ||
        o.code.toLowerCase().includes(query.toLowerCase())
      )
    : allOptions;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (disabled) {
    return (
      <span className={`text-gray-400 ${compact ? "text-xs px-1" : "text-xs"}`}>
        {selectedName || "—"}
      </span>
    );
  }

  return (
    <div ref={containerRef} className="relative w-full">
      {compact && !open ? (
        <div
          onClick={() => { setOpen(true); setQuery(""); }}
          className="w-full bg-transparent py-1 px-1 font-semibold text-gray-800 text-xs cursor-pointer hover:bg-gray-100 transition-colors leading-tight min-h-[22px]"
        >
          {selectedName || <span className="text-gray-400 font-normal">— Выберите —</span>}
        </div>
      ) : (
        <input
          type="text"
          autoFocus={compact && open}
          className={compact
            ? "w-full bg-white border border-gray-300 py-1 px-1 font-semibold text-gray-800 text-xs outline-none"
            : "w-full border border-gray-200 px-2.5 py-1.5 text-xs text-gray-700 bg-white outline-none focus:border-black"
          }
          placeholder={compact ? "Поиск..." : "Все категории"}
          value={open ? query : selectedName}
          onFocus={() => { setOpen(true); setQuery(""); }}
          onChange={e => setQuery(e.target.value)}
        />
      )}
      {open && (
        <div className="absolute z-50 left-0 w-56 mt-0.5 bg-white border border-gray-200 shadow-lg max-h-60 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-xs text-gray-400">Ничего не найдено</div>
          ) : (
            filtered.map(o => (
              <div
                key={o.id}
                className={`px-3 py-2 text-xs cursor-pointer hover:bg-gray-50 ${o.id === value ? "bg-gray-100 font-semibold" : ""}`}
                onMouseDown={e => {
                  e.preventDefault();
                  onChange(o.id);
                  setOpen(false);
                  setQuery("");
                }}
              >
                {o.name}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
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

  // M-06: undo toast after rule creation
  const [undoToast, setUndoToast] = useState<{
    ruleId: string; matchValue: string; timeoutId: ReturnType<typeof setTimeout>;
  } | null>(null);

  // Counterparty clarification modal: shown right after a category is chosen for a
  // transaction — lists every other transaction from the same counterparty (unclassified
  // ones first) so several can be clarified at once, with an option to save a rule.
  const [counterpartyModal, setCounterpartyModal] = useState<{
    categoryId: string;
    categoryName: string;
    counterpartyInn: string | null;
    counterpartyHint: string | null;
    transactions: CounterpartyTx[];
  } | null>(null);
  const [counterpartySelected, setCounterpartySelected] = useState<Set<string>>(new Set());
  const [saveRule, setSaveRule] = useState(true);
  const [counterpartySubmitting, setCounterpartySubmitting] = useState(false);
  const [updatingTxId, setUpdatingTxId] = useState<string | null>(null);
  const [voidingDocId, setVoidingDocId] = useState<string | null>(null);

  // H-03: inline action error
  const [actionError, setActionError] = useState<string | null>(null);

  const [aiRunning, setAiRunning] = useState(false);
  const [aiProgress, setAiProgress] = useState<{ processed: number; total: number } | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  const handleRunAI = async () => {
    setAiRunning(true);
    setAiProgress(null);
    setActionError(null);
    try {
      const res = await fetch("/v2/api/classification/run-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ periodId: selectedPeriod }),
      });
      if (!res.ok) {
        const data = await res.json();
        setActionError(`Ошибка запуска: ${data.error}`);
        setAiRunning(false);
        return;
      }

      // Poll status every 2s, capture processed/total for progress bar
      pollIntervalRef.current = setInterval(async () => {
        try {
          const stRes = await fetch(`/v2/api/classification/status/${selectedPeriod}`);
          if (stRes.ok) {
            const st = await stRes.json();
            if (st.total > 0) {
              setAiProgress({ processed: st.processed ?? 0, total: st.total });
            }
            if (st.status === "done" || st.status === "failed") {
              clearInterval(pollIntervalRef.current!);
              pollIntervalRef.current = null;
              setAiRunning(false);
              setAiProgress(null);
              if (st.status === "failed") setActionError(`Ошибка ИИ: ${st.error}`);
              loadTransactions();
            }
          }
        } catch {
          // ignore poll errors
        }
      }, 2000);
    } catch {
      setActionError("Ошибка сети при запуске ИИ");
      setAiRunning(false);
    }
  };

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

  const loadTransactions = async (page?: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append("page", (page ?? currentPage).toString());
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
      loadTransactions(1);
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

  // After a category is set for one transaction, look up every other transaction from
  // the same counterparty (INN preferred, falls back to the counterparty name for
  // transit accounts / accounts with no INN) so the user can clarify several at once.
  const openCounterpartyModal = async (tx: Transaction, categoryId: string) => {
    const isTransit = tx.counterpartyInn ? TRANSIT_INNS.has(tx.counterpartyInn) : false;
    const useInn = !!(tx.counterpartyInn && !isTransit);
    const hint = tx.counterpartyHint?.trim() || null;
    if (!useInn && !hint) return; // nothing reliable to group by — skip the modal

    try {
      const params = new URLSearchParams();
      if (useInn) params.append("inn", tx.counterpartyInn!);
      else params.append("hint", hint!);
      params.append("direction", tx.direction);
      params.append("excludeId", tx.id);

      const res = await fetch(`/v2/api/transactions/by-counterparty?${params}`);
      if (!res.ok) return;
      const data = await res.json();
      const transactions: CounterpartyTx[] = data.transactions || [];
      const categoryName = categories.find(c => c.id === categoryId)?.name || "";

      setCounterpartyModal({
        categoryId,
        categoryName,
        counterpartyInn: useInn ? tx.counterpartyInn : null,
        counterpartyHint: hint,
        transactions,
      });
      setSaveRule(true);
      setCounterpartySelected(new Set(transactions.filter(t => t.selectable).map(t => t.id)));
    } catch {
      // Non-critical — if the lookup fails, the transaction is still categorized,
      // the user just doesn't get the bulk-clarification modal this time.
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
        loadTransactions();
        await openCounterpartyModal(tx, categoryId);
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

  const closeCounterpartyModal = () => {
    setCounterpartyModal(null);
    setCounterpartySelected(new Set());
  };

  const handleConfirmCounterpartyModal = async () => {
    if (!counterpartyModal) return;

    const ruleMatchType = counterpartyModal.counterpartyInn ? "INN" : "KEYWORD";
    const ruleMatchValue = counterpartyModal.counterpartyInn || counterpartyModal.counterpartyHint;
    const wantsRule = saveRule && !!ruleMatchValue;

    if (counterpartySelected.size === 0 && !wantsRule) {
      closeCounterpartyModal();
      return;
    }

    setCounterpartySubmitting(true);
    try {
      const res = await fetch("/v2/api/clarification/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transactionIds: Array.from(counterpartySelected),
          documentTypeId: counterpartyModal.categoryId,
          createRule: wantsRule,
          ruleMatchType: wantsRule ? ruleMatchType : undefined,
          ruleMatchValue: wantsRule ? ruleMatchValue : undefined,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.ruleCreated && data.ruleId) {
          if (undoToast) clearTimeout(undoToast.timeoutId);
          const timeoutId = setTimeout(() => setUndoToast(null), 15000);
          setUndoToast({ ruleId: data.ruleId, matchValue: ruleMatchValue || "", timeoutId });
        }
      } else {
        const data = await res.json();
        setActionError(`Ошибка при уточнении операций: ${data.error}`);
      }
    } catch {
      setActionError("Ошибка сети при уточнении операций");
    } finally {
      setCounterpartySubmitting(false);
      closeCounterpartyModal();
      loadTransactions();
    }
  };

  const handleVoidDocument = async (tx: Transaction) => {
    if (!tx.document) return;
    setVoidingDocId(tx.document.id);
    setActionError(null);
    try {
      const res = await fetch("/v2/api/posting/void", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId: tx.document.id })
      });
      if (res.ok) {
        loadTransactions();
      } else {
        const data = await res.json();
        setActionError(`Ошибка аннулирования: ${data.error}`);
      }
    } catch {
      setActionError("Ошибка сети при аннулировании");
    } finally {
      setVoidingDocId(null);
    }
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

        {/* AI Action and Status quick tabs */}
        <div className="flex items-center gap-4">
          <div className="flex flex-col items-end gap-1">
            <button
              onClick={handleRunAI}
              disabled={aiRunning}
              className="text-[10px] font-bold bg-black text-white px-4 py-2 uppercase tracking-widest hover:opacity-80 transition-opacity disabled:opacity-50 flex items-center gap-2"
            >
              {aiRunning && (
                <svg className="animate-spin h-3 w-3 shrink-0" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
              )}
              {aiRunning && aiProgress
                ? `${aiProgress.processed}/${aiProgress.total}`
                : aiRunning ? "Запуск..." : "Распознать ИИ"}
            </button>
            {aiRunning && aiProgress && aiProgress.total > 0 && (
              <div className="w-full h-1 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-1 bg-black transition-all duration-300"
                  style={{ width: `${Math.min(100, (aiProgress.processed / aiProgress.total) * 100)}%` }}
                />
              </div>
            )}
          </div>

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
            <CategoryCombobox
              options={categories}
              value={selectedCategory}
              onChange={id => { setSelectedCategory(id); setCurrentPage(1); }}
              allOption={{ value: "ALL", label: "Все категории" }}
            />
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
                <th className="py-3.5 px-5 w-[90px]">Дата</th>
                <th className="py-3.5 px-5 w-[120px]">Счет</th>
                <th className="py-3.5 px-5 w-[28%]">Контрагент / Назначение</th>
                <th className="py-3.5 px-5 w-[110px]">Сумма</th>
                <th className="py-3.5 px-5 min-w-[190px]">Категория</th>
                <th className="py-3.5 px-5 w-[100px]">Статус</th>
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
                      <td className="py-3.5 px-5 text-gray-500">
                        <div className="text-xs font-medium leading-tight">
                          {tx.bankAccount?.name && tx.bankAccount.name !== tx.bankAccount.accountNumber
                            ? tx.bankAccount.name
                            : (tx.bankAccount?.bankName || tx.bankAccount?.name || "—")}
                        </div>
                        {tx.bankAccount?.bankName && tx.bankAccount.name !== tx.bankAccount.accountNumber && (
                          <div className="text-[10px] text-gray-400">{tx.bankAccount.bankName}</div>
                        )}
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
                        <CategoryCombobox
                          options={categories}
                          value={tx.document?.type?.id || ""}
                          onChange={id => handleCategoryChange(tx, id)}
                          compact
                          disabled={isSkipped || isUpdating}
                        />
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
                        {tx.document && (tx.status === "POSTED" || tx.status === "AUTO_MATCHED" || tx.status === "CONFIRMED") && (
                          <button
                            onClick={() => handleVoidDocument(tx)}
                            disabled={voidingDocId === tx.document!.id}
                            className="text-xs border border-gray-200 text-rose-500 hover:bg-rose-50 hover:border-rose-200 py-1.5 px-3 font-medium transition-colors disabled:opacity-40"
                            title="Аннулировать документ и вернуть в очередь"
                          >
                            {voidingDocId === tx.document.id ? "..." : "Аннулировать"}
                          </button>
                        )}
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

      {/* Counterparty clarification modal: appears right after a category is chosen.
          Lists every other transaction from the same counterparty (unclassified ones
          first) so several can be clarified in one go, plus a checkbox to save a rule. */}
      {counterpartyModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-gray-200 shadow-xl w-full max-w-2xl rounded p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-xs font-bold text-gray-900 uppercase tracking-widest">
                  Другие операции контрагента
                </h3>
                <p className="text-xs text-gray-500 leading-relaxed mt-1">
                  Категория «<strong className="text-gray-800">{counterpartyModal.categoryName}</strong>» применена для{" "}
                  <strong className="text-gray-800">{counterpartyModal.counterpartyHint || "этого контрагента"}</strong>.
                  {" "}Отметьте операции без категории, к которым применить её же.
                </p>
              </div>
              <button onClick={closeCounterpartyModal} className="text-gray-400 hover:text-gray-600 p-1 shrink-0">
                <X size={14} />
              </button>
            </div>

            {counterpartyModal.transactions.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-xs italic bg-gray-50 border border-gray-100">
                Других операций этого контрагента не найдено.
              </div>
            ) : (
              <div className="border border-gray-200 rounded overflow-hidden max-h-80 overflow-y-auto">
                <table className="w-full text-left text-[11px]">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200 text-gray-400 font-bold sticky top-0">
                      <th className="p-2 w-8">
                        <input
                          type="checkbox"
                          checked={
                            counterpartySelected.size > 0 &&
                            counterpartySelected.size === counterpartyModal.transactions.filter(t => t.selectable).length
                          }
                          onChange={e => {
                            if (e.target.checked) {
                              setCounterpartySelected(new Set(counterpartyModal.transactions.filter(t => t.selectable).map(t => t.id)));
                            } else {
                              setCounterpartySelected(new Set());
                            }
                          }}
                          className="rounded"
                        />
                      </th>
                      <th className="p-2">Дата</th>
                      <th className="p-2">Сумма</th>
                      <th className="p-2">Описание</th>
                      <th className="p-2">Категория</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {counterpartyModal.transactions.map(tx => (
                      <tr key={tx.id} className={`hover:bg-gray-50/50 ${!tx.selectable ? "opacity-50" : ""}`}>
                        <td className="p-2">
                          <input
                            type="checkbox"
                            disabled={!tx.selectable}
                            checked={counterpartySelected.has(tx.id)}
                            onChange={e => {
                              const next = new Set(counterpartySelected);
                              if (e.target.checked) next.add(tx.id);
                              else next.delete(tx.id);
                              setCounterpartySelected(next);
                            }}
                            className="rounded"
                          />
                        </td>
                        <td className="p-2 text-gray-500 whitespace-nowrap">{tx.date}</td>
                        <td className={`p-2 font-mono whitespace-nowrap ${tx.direction === "CREDIT" ? "text-green-700" : "text-rose-700"}`}>
                          {tx.direction === "CREDIT" ? "+" : "−"}{tx.amount.toLocaleString("ru")}
                        </td>
                        <td className="p-2 text-gray-600 max-w-[220px] truncate" title={tx.description}>
                          {tx.description}
                        </td>
                        <td className="p-2 whitespace-nowrap">
                          {tx.categoryName ? (
                            <span className="bg-gray-100 text-gray-500 text-[10px] px-1.5 py-0.5">{tx.categoryName}</span>
                          ) : (
                            <span className="text-gray-400 italic">без категории</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <label className="flex items-center gap-2 text-xs text-gray-700 font-medium cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={saveRule}
                onChange={e => setSaveRule(e.target.checked)}
                className="rounded"
              />
              Сохранить правило автоклассификации для будущих операций этого контрагента
            </label>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={closeCounterpartyModal}
                disabled={counterpartySubmitting}
                className="text-xs border border-gray-200 text-gray-700 font-medium py-2 px-4 rounded hover:bg-gray-50 transition"
              >
                Закрыть
              </button>
              <button
                onClick={handleConfirmCounterpartyModal}
                disabled={counterpartySubmitting}
                className="text-xs bg-black text-white font-bold py-2 px-5 rounded hover:opacity-80 transition disabled:opacity-40"
              >
                {counterpartySubmitting
                  ? "Применяем..."
                  : counterpartySelected.size > 0
                    ? `Применить к ${counterpartySelected.size} операциям`
                    : "Сохранить"}
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

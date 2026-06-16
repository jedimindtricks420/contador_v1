"use client";
import { useEffect, useState } from "react";
import { CreditCard, DollarSign, Pencil, Trash2, AlertTriangle, X } from "lucide-react";
import { formatSum } from "@/lib/format";

interface BankAccount {
  id: string;
  name: string;
  bankName: string | null;
  accountNumber: string | null;
  lastBalance: string | number;
  currency: string;
}

export default function AccountsClient() {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [usdRate, setUsdRate] = useState<number>(12800);

  // Modal and form states
  const [showAddEdit, setShowAddEdit] = useState(false);
  const [editingAccount, setEditingAccount] = useState<BankAccount | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Delete confirm state
  const [deleteTarget, setDeleteTarget] = useState<{
    account: BankAccount; transactionCount: number; periodCount: number; loading: boolean; error?: string;
  } | null>(null);
  const [form, setForm] = useState({
    name: "",
    bankName: "",
    accountNumber: "",
    lastBalance: "0",
    currency: "UZS"
  });

  const loadAccounts = async () => {
    try {
      const res = await fetch("/v2/api/bank-accounts");
      const data = await res.json();
      setAccounts(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAccounts();
  }, []);

  const openAdd = () => {
    setEditingAccount(null);
    setForm({ name: "", bankName: "", accountNumber: "", lastBalance: "0", currency: "UZS" });
    setSaveError(null);
    setShowAddEdit(true);
  };

  const openEdit = (acc: BankAccount) => {
    setEditingAccount(acc);
    setForm({
      name: acc.name,
      bankName: acc.bankName || "",
      accountNumber: acc.accountNumber || "",
      lastBalance: String(acc.lastBalance),
      currency: acc.currency
    });
    setSaveError(null);
    setShowAddEdit(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);
    const isEdit = !!editingAccount;
    const url = isEdit ? `/v2/api/bank-accounts/${editingAccount.id}` : "/v2/api/bank-accounts";
    const method = isEdit ? "PUT" : "POST";

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          lastBalance: parseFloat(form.lastBalance) || 0
        })
      });

      if (res.ok) {
        setShowAddEdit(false);
        loadAccounts();
      } else {
        const err = await res.json();
        setSaveError(`Ошибка сохранения: ${err.error}`);
      }
    } catch {
      setSaveError("Ошибка сети. Попробуйте снова.");
    }
  };

  const openDeleteConfirm = async (acc: BankAccount) => {
    setDeleteTarget({ account: acc, transactionCount: 0, periodCount: 0, loading: true });
    try {
      const res = await fetch(`/v2/api/bank-accounts/${acc.id}/stats`);
      const data = await res.json();
      setDeleteTarget({ account: acc, transactionCount: data.transactionCount, periodCount: data.periodCount, loading: false });
    } catch {
      setDeleteTarget({ account: acc, transactionCount: 0, periodCount: 0, loading: false });
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/v2/api/bank-accounts/${deleteTarget.account.id}`, { method: "DELETE" });
      if (res.ok) {
        setDeleteTarget(null);
        loadAccounts();
      } else {
        const err = await res.json();
        setDeleteTarget(prev => prev ? { ...prev, error: `Ошибка удаления: ${err.error}` } : null);
      }
    } catch {
      setDeleteTarget(prev => prev ? { ...prev, error: "Ошибка сети. Попробуйте снова." } : null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[300px] text-gray-500 font-medium">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-300 mr-3"></div>
        Загрузка счетов...
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b border-gray-200">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Банковские счета</h1>
          <p className="text-xs text-gray-400 mt-0.5">Управление расчетными и валютными счетами организации</p>
        </div>
        <div className="flex items-center gap-4">
          {/* CB Rate input */}
          <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded px-2.5 py-1 text-xs">
            <span className="text-gray-400 font-semibold">Курс ЦБ:</span>
            <input
              type="number"
              value={usdRate}
              min="0.01"
              onChange={(e) => setUsdRate(parseFloat(e.target.value) || 1)}
              className="w-16 font-bold text-gray-800 outline-hidden bg-transparent border-b border-gray-300 focus:border-black text-center"
            />
            <span className="text-gray-500 font-semibold">UZS/$</span>
          </div>

          <button
            onClick={openAdd}
            className="bg-black hover:opacity-80 text-white text-xs font-bold py-2.5 px-4.5 rounded transition duration-200 shadow-sm"
          >
            + Добавить счёт
          </button>
        </div>
      </div>

      {/* Grid List */}
      {accounts.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-200 rounded p-12 text-center text-gray-400">
          <CreditCard className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm font-semibold">Счета не найдены</p>
          <p className="text-xs mt-1">Добавьте ваш первый расчётный счёт, чтобы начать импорт выписок.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {accounts.map((acc) => {
            const isUsd = acc.currency === "USD";
            const balanceNum = parseFloat(String(acc.lastBalance)) || 0;
            const convertedBalance = isUsd ? balanceNum * usdRate : balanceNum;

            return (
              <div
                key={acc.id}
                className="bg-white rounded border border-gray-200 p-5 shadow-sm hover:shadow-md transition duration-300 flex flex-col justify-between"
              >
                <div>
                  {/* Title Bar */}
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                        {isUsd ? <DollarSign size={15} className="text-gray-400" /> : <CreditCard size={15} className="text-gray-400" />}
                        {acc.name}
                      </h3>
                      <p className="text-xs text-gray-400 font-medium mt-0.5">{acc.bankName || "Без банка"}</p>
                    </div>
                    
                    {/* Action menu */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEdit(acc)}
                        className="p-1.5 text-gray-400 hover:text-black hover:bg-gray-50 rounded transition"
                        title="Редактировать"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => openDeleteConfirm(acc)}
                        className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-gray-50 rounded transition"
                        title="Удалить"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Account Number */}
                  <div className="mt-4 font-mono text-[11px] text-gray-400 bg-gray-50 px-2.5 py-1.5 rounded border border-gray-100 flex justify-between items-center">
                    <span className="font-semibold text-gray-500 uppercase tracking-wider text-[9px]">Номер счёта</span>
                    <span>{acc.accountNumber || "—"}</span>
                  </div>

                  {/* Balance details */}
                  <div className="mt-5 space-y-1">
                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Текущий баланс</div>
                    <div className="text-xl font-black text-gray-800">
                      {isUsd ? `${new Intl.NumberFormat("en-US").format(balanceNum)} USD` : formatSum(balanceNum)}
                    </div>
                    {isUsd && (
                      <div className="text-[11px] text-gray-400 font-semibold">
                        ≈ {formatSum(convertedBalance)}
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer Buttons */}
                <div className="grid grid-cols-2 gap-3 mt-6 pt-4 border-t border-gray-100">
                  <a
                    href={`/v2/cashflow?accountId=${acc.id}`}
                    className="text-center bg-gray-50 hover:bg-gray-100 text-gray-700 text-xs font-semibold py-2 rounded border border-gray-150 transition"
                  >
                    Cash Flow
                  </a>
                  <a
                    href={`/v2/transactions?accountId=${acc.id}`}
                    className="text-center bg-gray-50 hover:bg-gray-100 text-gray-700 text-xs font-semibold py-2 rounded border border-gray-150 transition"
                  >
                    Операции
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal form */}
      {showAddEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded p-6 max-w-md w-full mx-4 border border-gray-100 shadow-2xl space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-gray-100">
              <h3 className="text-base font-bold text-gray-800">
                {editingAccount ? "Редактировать банковский счёт" : "Добавить банковский счёт"}
              </h3>
              <button onClick={() => setShowAddEdit(false)} className="text-gray-400 hover:text-gray-600 text-lg">×</button>
            </div>
            
            <form onSubmit={handleSave} className="space-y-4 text-xs">
              {saveError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded text-xs text-rose-800 font-semibold">
                  {saveError}
                </div>
              )}
              <div>
                <label className="block font-semibold text-gray-500 mb-1">Название счёта *</label>
                <input
                  type="text"
                  required
                  placeholder="Например, Основной UZS"
                  value={form.name}
                  onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full bg-gray-50 border border-gray-200 rounded px-3 py-2 text-sm text-gray-700 outline-hidden focus:border-black"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-gray-500 mb-1">Валюта</label>
                  <select
                    value={form.currency}
                    onChange={(e) => setForm(prev => ({ ...prev, currency: e.target.value }))}
                    className="w-full bg-gray-50 border border-gray-200 rounded px-3 py-2 text-sm text-gray-700 outline-hidden focus:border-black"
                  >
                    <option value="UZS">UZS</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-gray-500 mb-1">Текущий баланс</label>
                  <input
                    type="number"
                    value={form.lastBalance}
                    onChange={(e) => setForm(prev => ({ ...prev, lastBalance: e.target.value }))}
                    className="w-full bg-gray-50 border border-gray-200 rounded px-3 py-2 text-sm text-gray-700 outline-hidden focus:border-black"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-gray-500 mb-1">Название банка</label>
                <input
                  type="text"
                  placeholder="Например, Asaka Bank"
                  value={form.bankName}
                  onChange={(e) => setForm(prev => ({ ...prev, bankName: e.target.value }))}
                  className="w-full bg-gray-50 border border-gray-200 rounded px-3 py-2 text-sm text-gray-700 outline-hidden focus:border-black"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-500 mb-1">Номер счёта</label>
                <input
                  type="text"
                  placeholder="20208000600001234567"
                  value={form.accountNumber}
                  onChange={(e) => setForm(prev => ({ ...prev, accountNumber: e.target.value }))}
                  className="w-full bg-gray-50 border border-gray-200 rounded px-3 py-2 text-sm text-gray-700 outline-hidden focus:border-black"
                />
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddEdit(false)}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold py-2.5 rounded transition"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-black hover:opacity-80 text-white text-sm font-semibold py-2.5 rounded transition shadow-sm"
                >
                  Сохранить
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Delete confirm modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded border border-gray-200 shadow-xl max-w-sm w-full p-6 space-y-4">
            <div className="flex items-start justify-between">
              <h3 className="text-sm font-bold text-gray-900">Удалить счёт?</h3>
              <button onClick={() => setDeleteTarget(null)} className="text-gray-400 hover:text-gray-600 p-1">
                <X size={16} />
              </button>
            </div>

            {deleteTarget.loading ? (
              <div className="flex items-center gap-2 text-xs text-gray-500 py-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-300" />
                Проверяем связанные данные...
              </div>
            ) : (
              <>
                <p className="text-sm font-semibold text-gray-800">«{deleteTarget.account.name}»</p>
                {deleteTarget.transactionCount > 0 ? (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800 space-y-1">
                    <p className="font-bold flex items-center gap-1.5">
                      <AlertTriangle size={13} />
                      Этот счёт связан с {deleteTarget.transactionCount} транзакциями
                      {deleteTarget.periodCount > 0 && ` за ${deleteTarget.periodCount} период${deleteTarget.periodCount > 1 ? "а" : ""}`}.
                    </p>
                    <p>После удаления транзакции останутся в системе, но потеряют привязку к счёту.</p>
                  </div>
                ) : (
                  <p className="text-xs text-gray-500">Транзакций нет. Счёт можно удалить без последствий.</p>
                )}
                {deleteTarget.error && (
                  <div className="p-2 bg-rose-50 border border-rose-200 rounded text-xs text-rose-700 font-semibold">
                    {deleteTarget.error}
                  </div>
                )}
              </>
            )}

            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 text-xs border border-gray-200 text-gray-700 font-bold py-2.5 rounded hover:bg-gray-50 transition"
              >
                Отмена
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteTarget.loading}
                className="flex-1 text-xs bg-rose-600 hover:bg-rose-700 text-white font-bold py-2.5 rounded transition disabled:opacity-50"
              >
                {deleteTarget.transactionCount > 0 ? "Всё равно удалить" : "Удалить"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

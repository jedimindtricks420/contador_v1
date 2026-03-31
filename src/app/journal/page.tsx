"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Trash2, Loader2, ArrowRightLeft, Lock as LockIcon, Bot } from "lucide-react";
import SearchableSelect from "@/components/SearchableSelect";
import { useUI } from "@/lib/ui-context";

interface Account {
  id: string;
  code: string;
  name: string;
  type?: string;
}

interface Counterparty {
  id: string;
  name: string;
}

interface Transaction {
  id: string;
  date: string;
  period: string;
  description: string;
  amount: number;
  debit: Account;
  credit: Account;
  counterparty?: Counterparty | null;
  is_deleted: boolean;
}

export default function JournalPage() {
  const queryClient = useQueryClient();
  const { isChatOpen } = useUI();
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split("T")[0],
    period: new Date().toLocaleDateString("ru-RU", { month: "2-digit", year: "numeric" }),
    debit_id: "",
    credit_id: "",
    amount: "",
    counterparty_id: "",
    description: "",
  });

  const { data: accounts } = useQuery<Account[]>({
    queryKey: ["accounts"],
    queryFn: () => fetch("/api/accounts").then((res) => res.json()),
  });

  const { data: obStatus } = useQuery({
    queryKey: ["opening-balance"],
    queryFn: () => fetch("/api/reports/opening-balance").then((res) => res.json()),
    refetchInterval: 3000,
  });

  const { data: counterparties } = useQuery<Counterparty[]>({
    queryKey: ["counterparties"],
    queryFn: () => fetch("/api/counterparties").then((res) => res.json()),
  });

  const { data: transactions, isLoading } = useQuery<Transaction[]>({
    queryKey: ["transactions"],
    queryFn: () => fetch("/api/transactions").then((res) => res.json()),
  });

  const addTransaction = useMutation({
    mutationFn: (data: any) =>
      fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, amount: parseFloat(data.amount) }),
      }).then(async (res) => {
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Ошибка при сохранении");
        }
        return res.json();
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      setFormData((prev) => ({ ...prev, amount: "", description: "" }));
    },
    onError: (error: any) => alert(error.message),
  });

  const deleteTransaction = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/transactions/${id}`, { method: "DELETE" }).then((res) => res.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["transactions"] }),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addTransaction.mutate(formData);
  };

  return (
    <div className="space-y-8 min-h-screen">
      <header className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-gray-900 uppercase tracking-widest">Журнал операций</h2>
      </header>

      {/* Opening Balance Widget - No changes to UI code */}
      {obStatus && (obStatus.debit > 0 || obStatus.credit > 0) && (
        <div className="bg-white border-2 border-dashed border-gray-100 p-6 rounded-lg mb-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <div className={`w-2 h-2 rounded-full animate-pulse ${Math.abs(obStatus.difference) < 0.01 ? 'bg-green-500' : 'bg-amber-500'}`} />
              <h3 className="text-sm font-bold uppercase tracking-widest text-gray-900 border-b-2 border-black inline-block pb-0.5">
                Баланс ввода остатков (0000)
              </h3>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Дебет (Σ)</p>
                <p className="text-sm font-bold tabular-nums">{obStatus.debit?.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Кредит (Σ)</p>
                <p className="text-sm font-bold tabular-nums">{obStatus.credit?.toLocaleString()}</p>
              </div>
              <div className="col-span-2">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Разница</p>
                <div className="flex items-center space-x-2">
                  <p className={`text-sm font-bold tabular-nums ${Math.abs(obStatus.difference) < 0.01 ? 'text-green-600' : 'text-amber-600'}`}>
                    {obStatus.difference?.toLocaleString()}
                  </p>
                  {Math.abs(obStatus.difference) < 0.01 ? (
                    <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded font-bold uppercase tracking-tighter">✅ Баланс ок</span>
                  ) : (
                    <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded font-bold uppercase tracking-tighter">⚠️ Не сбалансировано</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {Math.abs(obStatus.difference) < 0.01 && !obStatus.isFixed && (
              <button
                onClick={() => {
                   if (confirm('Это заблокирует редактирование остатков. Продолжить?')) {
                     fetch('/api/settings', {
                       method: 'POST',
                       headers: { 'Content-Type': 'application/json' },
                       body: JSON.stringify({ is_initial_balance_fixed: true })
                     }).then(() => queryClient.invalidateQueries({ queryKey: ["opening-balance", "settings"] }));
                   }
                }}
                className="bg-black text-white text-[10px] font-bold uppercase tracking-widest px-4 py-2 rounded hover:opacity-80 transition-opacity underline underline-offset-4"
              >
                Зафиксировать остатки
              </button>
            )}
            {obStatus.isFixed && (
               <div className="bg-gray-100 text-gray-500 text-[10px] font-bold uppercase tracking-widest px-4 py-2 rounded flex items-center space-x-2">
                 <LockIcon size={12} />
                 <span>Остатки подтверждены</span>
               </div>
            )}
          </div>
        </div>
      )}

      {/* Input Form */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm ring-1 ring-black/5">
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Дата</label>
            <input
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              className="w-full border-gray-200 border text-sm rounded px-3 py-2 outline-none focus:border-black transition-all"
              required
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Период</label>
            <input
              type="text"
              value={formData.period}
              onChange={(e) => setFormData({ ...formData, period: e.target.value })}
              className="w-full border-gray-200 border text-sm rounded px-3 py-2 outline-none focus:border-black transition-all font-mono"
              required
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Дебет</label>
            <SearchableSelect
              options={accounts || []}
              value={formData.debit_id}
              onChange={(val: string) => setFormData({ ...formData, debit_id: val })}
              placeholder="Счет..."
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Кредит</label>
            <SearchableSelect
              options={accounts || []}
              value={formData.credit_id}
              onChange={(val: string) => setFormData({ ...formData, credit_id: val })}
              placeholder="Счет..."
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Сумма</label>
            <input
              type="number"
              step="0.01"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              className="w-full border-gray-200 border text-sm rounded px-3 py-2 outline-none focus:border-black transition-all font-bold"
              required
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Контрагент</label>
            <SearchableSelect
              options={counterparties || []}
              value={formData.counterparty_id}
              onChange={(val: string) => setFormData({ ...formData, counterparty_id: val })}
              placeholder="—"
            />
          </div>
          <div className="space-y-1 md:col-span-2">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Описание</label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full border-gray-200 border text-sm rounded px-3 py-2 outline-none focus:border-black transition-all"
              required
            />
          </div>
          <div className="md:col-start-4 flex items-end">
            <button
              type="submit"
              disabled={addTransaction.isPending}
              className="w-full bg-black text-white rounded py-2 text-sm font-bold flex items-center justify-center space-x-2 hover:bg-gray-800 transition-all shadow-sm"
            >
              {addTransaction.isPending ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />}
              <span className="uppercase tracking-widest">Провести</span>
            </button>
          </div>
        </form>
      </div>

      {/* Table Area */}
      <div className="bg-white border border-gray-200 rounded overflow-x-auto shadow-sm ring-1 ring-black/5">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="bg-gray-50 uppercase tracking-widest text-[9px] font-bold text-gray-400">
              <th className="px-6 py-3 border-b border-gray-200">Дата</th>
              <th className="px-6 py-3 border-b border-gray-200">Дт / Кт</th>
              <th className="px-6 py-3 border-b border-gray-200 text-right">Сумма</th>
              <th className="px-6 py-3 border-b border-gray-200">Описание</th>
              <th className="px-6 py-3 border-b border-gray-200 text-center"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr><td colSpan={5} className="p-8 text-center"><Loader2 className="animate-spin mx-auto text-gray-300" /></td></tr>
            ) : transactions?.map((tx) => (
              <tr key={tx.id} className={`${tx.is_deleted ? 'opacity-30' : ''} hover:bg-gray-50 transition-colors group`}>
                <td className="px-6 py-3">
                  <div className="font-bold text-gray-700">{new Date(tx.date).toLocaleDateString('ru-RU')}</div>
                  <div className="text-[8px] text-gray-400 font-mono tracking-tighter">{tx.period}</div>
                </td>
                <td className="px-6 py-3 font-bold">
                   <div className="flex items-center space-x-2 text-gray-900 tracking-tighter uppercase">
                      <span>{tx.debit.code}</span>
                      <ArrowRightLeft size={10} className="text-gray-300" />
                      <span>{tx.credit.code}</span>
                   </div>
                </td>
                <td className="px-6 py-3 text-right font-bold text-gray-900 tabular-nums">{tx.amount.toLocaleString('ru-RU', { minimumFractionDigits: 2 })}</td>
                <td className="px-6 py-3">
                  <div className="font-bold text-sm tracking-tight text-gray-800">{tx.description}</div>
                  <div className="text-[9px] text-gray-400 uppercase tracking-wide font-medium">{tx.counterparty?.name}</div>
                </td>
                <td className="px-6 py-3 text-center">
                  {!tx.is_deleted && (
                    <button 
                      onClick={() => { if(confirm('Удалить операцию?')) deleteTransaction.mutate(tx.id) }} 
                      className="text-gray-300 hover:text-red-500 transition-colors p-1"
                    >
                       <Trash2 size={14} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Trash2, Loader2, ArrowRightLeft } from "lucide-react";

interface Account {
  id: string;
  code: string;
  name: string;
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
    <div className="space-y-8">
      <header>
        <h2 className="text-xl font-bold text-gray-900">Журнал операций</h2>
      </header>

      <div className="bg-white border border-gray-200 p-6 rounded shadow-sm">
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Дата</label>
            <input
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              className="w-full border-gray-200 border text-sm rounded px-3 py-2 outline-none focus:border-black"
              required
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Период</label>
            <input
              type="text"
              value={formData.period}
              onChange={(e) => setFormData({ ...formData, period: e.target.value })}
              className="w-full border-gray-200 border text-sm rounded px-3 py-2 outline-none focus:border-black"
              required
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Дебет</label>
            <select
              value={formData.debit_id}
              onChange={(e) => setFormData({ ...formData, debit_id: e.target.value })}
              className="w-full border-gray-200 border text-sm rounded px-3 py-2 outline-none focus:border-black"
              required
            >
              <option value="">Счет...</option>
              {accounts?.map((acc) => (
                <option key={acc.id} value={acc.id}>{acc.code} - {acc.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Кредит</label>
            <select
              value={formData.credit_id}
              onChange={(e) => setFormData({ ...formData, credit_id: e.target.value })}
              className="w-full border-gray-200 border text-sm rounded px-3 py-2 outline-none focus:border-black"
              required
            >
              <option value="">Счет...</option>
              {accounts?.map((acc) => (
                <option key={acc.id} value={acc.id}>{acc.code} - {acc.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Сумма</label>
            <input
              type="number"
              step="0.01"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              className="w-full border-gray-200 border text-sm rounded px-3 py-2 outline-none focus:border-black"
              required
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Контрагент</label>
            <select
              value={formData.counterparty_id}
              onChange={(e) => setFormData({ ...formData, counterparty_id: e.target.value })}
              className="w-full border-gray-200 border text-sm rounded px-3 py-2 outline-none focus:border-black"
            >
              <option value="">—</option>
              {counterparties?.map((cp) => (
                <option key={cp.id} value={cp.id}>{cp.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1 md:col-span-2">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Описание</label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full border-gray-200 border text-sm rounded px-3 py-2 outline-none focus:border-black"
              required
            />
          </div>
          <div className="md:col-start-4 flex items-end">
            <button
              type="submit"
              disabled={addTransaction.isPending}
              className="w-full bg-black text-white rounded py-2 text-sm font-bold flex items-center justify-center space-x-2"
            >
              {addTransaction.isPending ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />}
              <span>Провести</span>
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white border border-gray-200 rounded overflow-x-auto shadow-sm">
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
              <tr><td colSpan={5} className="p-8 text-center"><Loader2 className="animate-spin mx-auto" /></td></tr>
            ) : transactions?.map((tx) => (
              <tr key={tx.id} className={tx.is_deleted ? 'opacity-30' : ''}>
                <td className="px-6 py-3">
                  <div className="font-bold">{new Date(tx.date).toLocaleDateString('ru-RU')}</div>
                  <div className="text-[8px] text-gray-400">{tx.period}</div>
                </td>
                <td className="px-6 py-3 font-bold">
                   <div className="flex items-center space-x-2">
                      <span>{tx.debit.code}</span>
                      <ArrowRightLeft size={10} className="text-gray-300" />
                      <span>{tx.credit.code}</span>
                   </div>
                </td>
                <td className="px-6 py-3 text-right font-bold">{tx.amount.toLocaleString('ru-RU', { minimumFractionDigits: 2 })}</td>
                <td className="px-6 py-3">
                  <div className="font-medium">{tx.description}</div>
                  <div className="text-[9px] text-gray-400">{tx.counterparty?.name}</div>
                </td>
                <td className="px-6 py-3 text-center">
                  {!tx.is_deleted && (
                    <button onClick={() => { if(confirm('Удалить?')) deleteTransaction.mutate(tx.id) }} className="text-gray-300 hover:text-red-500">
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

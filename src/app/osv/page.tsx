"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2, ArrowRight, X } from "lucide-react";

interface OSVEntry {
  code: string;
  name: string;
  type: string;
  debitTurnover: number;
  creditTurnover: number;
  balanceDebit: number;
  balanceCredit: number;
}

interface Account {
    code: string;
    name: string;
}

interface Transaction {
  id: string;
  date: string;
  description: string;
  debit: Account;
  credit: Account;
  amount: number;
}

export default function OSVPage() {
  const [period, setPeriod] = useState(new Date().toLocaleDateString("ru-RU", { month: "2-digit", year: "numeric" }));
  const [selectedAccount, setSelectedAccount] = useState<OSVEntry | null>(null);

  const { data: osv, isLoading } = useQuery<OSVEntry[]>({
    queryKey: ["osv", period],
    queryFn: () => fetch(`/api/reports/osv?period=${period}`).then((res) => res.json()),
  });

  const totals = osv?.reduce((acc, curr) => ({
    debitTurnover: acc.debitTurnover + curr.debitTurnover,
    creditTurnover: acc.creditTurnover + curr.creditTurnover,
    balanceDebit: acc.balanceDebit + curr.balanceDebit,
    balanceCredit: acc.balanceCredit + curr.balanceCredit,
  }), { debitTurnover: 0, creditTurnover: 0, balanceDebit: 0, balanceCredit: 0 });

  return (
    <div className="space-y-8">
      <header className="flex justify-between items-end">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Оборотно-сальдовая ведомость</h2>
        </div>
        <div className="flex items-center space-x-2">
          <input 
            type="text" 
            value={period} 
            onChange={(e) => setPeriod(e.target.value)}
            className="border-b border-gray-300 px-2 py-1 text-sm font-bold focus:border-black outline-none w-24 text-center bg-transparent"
          />
        </div>
      </header>

      <div className="bg-white border border-gray-200 rounded shadow-sm overflow-hidden overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="bg-gray-50 uppercase tracking-widest text-[9px] font-bold text-gray-400">
              <th className="px-6 py-4 border-b border-gray-200">Счет</th>
              <th className="px-6 py-4 border-b border-gray-200">Наименование</th>
              <th className="px-6 py-4 border-b border-gray-200 text-right">Оборот Дт</th>
              <th className="px-6 py-4 border-b border-gray-200 text-right">Оборот Кт</th>
              <th className="px-6 py-4 border-b border-gray-200 text-right">Сальдо Дт</th>
              <th className="px-6 py-4 border-b border-gray-200 text-right">Сальдо Кт</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr><td colSpan={6} className="p-20 text-center"><Loader2 className="animate-spin mx-auto text-gray-200" /></td></tr>
            ) : osv?.map((row) => (
              <tr key={row.code} onClick={() => setSelectedAccount(row)} className="hover:bg-gray-50 cursor-pointer transition-colors group">
                <td className="px-6 py-4 font-bold">{row.code}</td>
                <td className="px-6 py-4 text-gray-600 flex items-center">{row.name} <ArrowRight size={10} className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity text-gray-300" /></td>
                <td className="px-6 py-4 text-right">{row.debitTurnover.toLocaleString('ru-RU')}</td>
                <td className="px-6 py-4 text-right">{row.creditTurnover.toLocaleString('ru-RU')}</td>
                <td className="px-6 py-4 text-right font-bold">{row.balanceDebit > 0 ? row.balanceDebit.toLocaleString('ru-RU') : '—'}</td>
                <td className="px-6 py-4 text-right font-bold">{row.balanceCredit > 0 ? row.balanceCredit.toLocaleString('ru-RU') : '—'}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-gray-100 font-bold">
            <tr>
              <td colSpan={2} className="px-6 py-4 uppercase tracking-widest text-[9px]">Итого</td>
              <td className="px-6 py-4 text-right">{totals?.debitTurnover.toLocaleString('ru-RU')}</td>
              <td className="px-6 py-4 text-right">{totals?.creditTurnover.toLocaleString('ru-RU')}</td>
              <td className="px-6 py-4 text-right">{totals?.balanceDebit.toLocaleString('ru-RU')}</td>
              <td className="px-6 py-4 text-right">{totals?.balanceCredit.toLocaleString('ru-RU')}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {selectedAccount && (
        <AccountDetails account={selectedAccount} period={period} onClose={() => setSelectedAccount(null)} />
      )}
    </div>
  );
}

function AccountDetails({ account, period, onClose }: { account: OSVEntry, period: string, onClose: () => void }) {
  const { data: transactions, isLoading } = useQuery<Transaction[]>({
    queryKey: ["transactions", account.code, period],
    queryFn: () => fetch(`/api/transactions?accountCode=${account.code}&period=${period}`).then((res) => res.json()),
  });

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/10 transition-opacity" onClick={onClose} />
      <div className="relative w-full max-w-xl bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
        <header className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <div>
            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-widest">{account.code} — {account.name}</h3>
            <p className="text-[9px] font-bold text-gray-400 mt-1 uppercase">Детализация: {period}</p>
          </div>
          <button onClick={onClose} className="text-gray-300 hover:text-black transition-colors"><X size={18} /></button>
        </header>

        <div className="flex-1 overflow-y-auto p-6">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="uppercase tracking-widest text-[9px] font-bold text-gray-400 border-b border-gray-100">
                <th className="pb-3 px-2 text-left">Дата</th>
                <th className="pb-3 px-2 text-left">Корр.</th>
                <th className="pb-3 px-2 text-left">Описание</th>
                <th className="pb-3 px-2 text-right">Сумма</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading ? (
                <tr><td colSpan={4} className="py-12 text-center text-gray-400"><Loader2 className="animate-spin mx-auto" /></td></tr>
              ) : transactions?.length === 0 ? (
                <tr><td colSpan={4} className="py-12 text-center text-gray-400 font-bold uppercase tracking-widest text-[10px]">Нет данных</td></tr>
              ) : transactions?.map((tx) => (
                <tr key={tx.id} className="hover:bg-gray-50">
                  <td className="py-3 px-2 text-gray-400">{new Date(tx.date).toLocaleDateString('ru-RU')}</td>
                  <td className="py-3 px-2 font-bold">{tx.debit.code === account.code ? tx.credit.code : tx.debit.code}</td>
                  <td className="py-3 px-2 text-gray-500 truncate max-w-[150px]">{tx.description}</td>
                  <td className={`py-3 px-2 text-right font-bold ${tx.debit.code === account.code ? 'text-black' : 'text-gray-300'}`}>
                    {tx.amount.toLocaleString('ru-RU', { minimumFractionDigits: 0 })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

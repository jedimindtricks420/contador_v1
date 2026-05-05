"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2, ArrowRight, X } from "lucide-react";

interface OSVEntry {
  code: string;
  name: string;
  type: string;
  // Начальное сальдо (S1)
  balanceStartDebit: number;
  balanceStartCredit: number;
  // Обороты за период
  debitTurnover: number;
  creditTurnover: number;
  // Конечное сальдо (S2)
  balanceEndDebit: number;
  balanceEndCredit: number;
}

interface Account {
  code: string;
  name: string;
}

interface Transaction {
  id: string;
  date: string;
  description: string;
  period: string;
  debit: Account;
  credit: Account;
  amount: number;
}

function formatNum(n: number): string {
  if (n === 0) return "—";
  return n.toLocaleString("ru-RU");
}

// Формат периода по умолчанию: MM.YYYY
function currentPeriod(): string {
  const d = new Date();
  return `${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
}

export default function OSVPage() {
  const [period, setPeriod] = useState(currentPeriod());
  const [selectedAccount, setSelectedAccount] = useState<OSVEntry | null>(null);

  const { data: osv, isLoading } = useQuery<OSVEntry[]>({
    queryKey: ["osv", period],
    queryFn: () =>
      fetch(`/api/reports/osv?period=${period}`).then((res) => res.json()),
    enabled: !!period,
  });

  // Итоговые строки — суммируем все колонки
  const totals = osv?.reduce(
    (acc, curr) => ({
      balanceStartDebit:  acc.balanceStartDebit  + curr.balanceStartDebit,
      balanceStartCredit: acc.balanceStartCredit + curr.balanceStartCredit,
      debitTurnover:      acc.debitTurnover      + curr.debitTurnover,
      creditTurnover:     acc.creditTurnover     + curr.creditTurnover,
      balanceEndDebit:    acc.balanceEndDebit    + curr.balanceEndDebit,
      balanceEndCredit:   acc.balanceEndCredit   + curr.balanceEndCredit,
    }),
    {
      balanceStartDebit:  0,
      balanceStartCredit: 0,
      debitTurnover:      0,
      creditTurnover:     0,
      balanceEndDebit:    0,
      balanceEndCredit:   0,
    }
  );

  // Проверка равенства оборотов (закон двойной записи)
  const turnoversMatch =
    totals && Math.abs(totals.debitTurnover - totals.creditTurnover) < 0.01;

  return (
    <div className="space-y-8">
      <header className="flex justify-between items-end">
        <div>
          <h2 className="text-xl font-bold text-gray-900">
            Оборотно-сальдовая ведомость
          </h2>
          <p className="text-sm text-gray-400 mt-1">
            Период: формат MM.YYYY — например, 05.2025
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <label className="text-xs text-gray-400 font-bold uppercase tracking-widest">
            Период
          </label>
          <input
            type="text"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            placeholder="MM.YYYY"
            className="border-b border-gray-300 px-2 py-1 text-sm font-bold focus:border-black outline-none w-28 text-center bg-transparent"
          />
        </div>
      </header>

      {/* Проверка баланса оборотов */}
      {totals && !isLoading && (
        <div
          className={`inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest px-4 py-2 rounded-full border ${
            turnoversMatch
              ? "bg-black text-white border-black"
              : "bg-red-500 text-white border-red-500"
          }`}
        >
          {turnoversMatch
            ? "✓ Дт оборот = Кт оборот (закон двойной записи)"
            : `⚠ Дт оборот ≠ Кт оборот (разница: ${Math.abs(
                totals.debitTurnover - totals.creditTurnover
              ).toLocaleString("ru-RU")})`}
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded shadow-sm overflow-hidden overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="bg-gray-50 uppercase tracking-widest text-[9px] font-bold text-gray-400">
              <th className="px-4 py-4 border-b border-gray-200" rowSpan={2}>
                Счет
              </th>
              <th className="px-4 py-4 border-b border-gray-200" rowSpan={2}>
                Наименование
              </th>
              <th
                className="px-4 py-2 border-b border-gray-200 text-center border-l border-gray-200"
                colSpan={2}
              >
                Сальдо нач. (S1)
              </th>
              <th
                className="px-4 py-2 border-b border-gray-200 text-center border-l border-gray-200"
                colSpan={2}
              >
                Обороты
              </th>
              <th
                className="px-4 py-2 border-b border-gray-200 text-center border-l border-gray-200"
                colSpan={2}
              >
                Сальдо кон. (S2)
              </th>
            </tr>
            <tr className="bg-gray-50 text-[9px] font-bold text-gray-400 uppercase tracking-widest">
              <th className="px-4 py-2 border-b border-gray-200 text-right border-l border-gray-200">
                Дт
              </th>
              <th className="px-4 py-2 border-b border-gray-200 text-right">
                Кт
              </th>
              <th className="px-4 py-2 border-b border-gray-200 text-right border-l border-gray-200">
                Дт
              </th>
              <th className="px-4 py-2 border-b border-gray-200 text-right">
                Кт
              </th>
              <th className="px-4 py-2 border-b border-gray-200 text-right border-l border-gray-200">
                Дт
              </th>
              <th className="px-4 py-2 border-b border-gray-200 text-right">
                Кт
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr>
                <td colSpan={8} className="p-20 text-center">
                  <Loader2 className="animate-spin mx-auto text-gray-200" />
                </td>
              </tr>
            ) : osv?.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="p-12 text-center text-gray-400 text-xs font-bold uppercase tracking-widest"
                >
                  Нет данных за выбранный период
                </td>
              </tr>
            ) : (
              osv?.map((row) => (
                <tr
                  key={row.code}
                  onClick={() => setSelectedAccount(row)}
                  className="hover:bg-gray-50 cursor-pointer transition-colors group"
                >
                  <td className="px-4 py-3 font-bold">{row.code}</td>
                  <td className="px-4 py-3 text-gray-600 flex items-center">
                    {row.name}
                    <ArrowRight
                      size={10}
                      className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity text-gray-300"
                    />
                  </td>
                  <td className="px-4 py-3 text-right border-l border-gray-100">
                    {formatNum(row.balanceStartDebit)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {formatNum(row.balanceStartCredit)}
                  </td>
                  <td className="px-4 py-3 text-right border-l border-gray-100">
                    {formatNum(row.debitTurnover)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {formatNum(row.creditTurnover)}
                  </td>
                  <td className="px-4 py-3 text-right font-bold border-l border-gray-100">
                    {formatNum(row.balanceEndDebit)}
                  </td>
                  <td className="px-4 py-3 text-right font-bold">
                    {formatNum(row.balanceEndCredit)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot className="bg-gray-100 font-bold">
            <tr>
              <td
                colSpan={2}
                className="px-4 py-4 uppercase tracking-widest text-[9px]"
              >
                Итого
              </td>
              <td className="px-4 py-4 text-right border-l border-gray-200">
                {totals?.balanceStartDebit.toLocaleString("ru-RU")}
              </td>
              <td className="px-4 py-4 text-right">
                {totals?.balanceStartCredit.toLocaleString("ru-RU")}
              </td>
              <td className="px-4 py-4 text-right border-l border-gray-200">
                {totals?.debitTurnover.toLocaleString("ru-RU")}
              </td>
              <td className="px-4 py-4 text-right">
                {totals?.creditTurnover.toLocaleString("ru-RU")}
              </td>
              <td className="px-4 py-4 text-right border-l border-gray-200">
                {totals?.balanceEndDebit.toLocaleString("ru-RU")}
              </td>
              <td className="px-4 py-4 text-right">
                {totals?.balanceEndCredit.toLocaleString("ru-RU")}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {selectedAccount && (
        <AccountDetails
          account={selectedAccount}
          period={period}
          onClose={() => setSelectedAccount(null)}
        />
      )}
    </div>
  );
}

function AccountDetails({
  account,
  period,
  onClose,
}: {
  account: OSVEntry;
  period: string;
  onClose: () => void;
}) {
  const { data: transactions, isLoading } = useQuery<Transaction[]>({
    queryKey: ["transactions", account.code, period],
    // Передаём period — теперь API реально фильтрует по нему
    queryFn: () =>
      fetch(
        `/api/transactions?account=${account.code}&period=${period}`
      ).then((res) => res.json()),
  });

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className="absolute inset-0 bg-black/10 transition-opacity"
        onClick={onClose}
      />
      <div className="relative w-full max-w-xl bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
        <header className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <div>
            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-widest">
              {account.code} — {account.name}
            </h3>
            <p className="text-[9px] font-bold text-gray-400 mt-1 uppercase">
              Детализация: {period}
            </p>
            <div className="flex gap-4 mt-2 text-[10px] text-gray-500">
              <span>
                S1 Дт:{" "}
                <b>{account.balanceStartDebit.toLocaleString("ru-RU")}</b>
              </span>
              <span>
                S1 Кт:{" "}
                <b>{account.balanceStartCredit.toLocaleString("ru-RU")}</b>
              </span>
              <span>
                S2 Дт: <b>{account.balanceEndDebit.toLocaleString("ru-RU")}</b>
              </span>
              <span>
                S2 Кт:{" "}
                <b>{account.balanceEndCredit.toLocaleString("ru-RU")}</b>
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-300 hover:text-black transition-colors"
          >
            <X size={18} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-6">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="uppercase tracking-widest text-[9px] font-bold text-gray-400 border-b border-gray-100">
                <th className="pb-3 px-2 text-left">Дата</th>
                <th className="pb-3 px-2 text-left">Корр.</th>
                <th className="pb-3 px-2 text-left">Описание</th>
                <th className="pb-3 px-2 text-right">Дт</th>
                <th className="pb-3 px-2 text-right">Кт</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-gray-400">
                    <Loader2 className="animate-spin mx-auto" />
                  </td>
                </tr>
              ) : transactions?.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="py-12 text-center text-gray-400 font-bold uppercase tracking-widest text-[10px]"
                  >
                    Нет операций в периоде {period}
                  </td>
                </tr>
              ) : (
                transactions?.map((tx) => {
                  const isDebit = tx.debit.code === account.code;
                  return (
                    <tr key={tx.id} className="hover:bg-gray-50">
                      <td className="py-3 px-2 text-gray-400">
                        {new Date(tx.date).toLocaleDateString("ru-RU")}
                      </td>
                      <td className="py-3 px-2 font-bold">
                        {isDebit ? tx.credit.code : tx.debit.code}
                      </td>
                      <td className="py-3 px-2 text-gray-500 truncate max-w-[130px]">
                        {tx.description}
                      </td>
                      <td className="py-3 px-2 text-right font-bold">
                        {isDebit
                          ? tx.amount.toLocaleString("ru-RU", {
                              minimumFractionDigits: 0,
                            })
                          : "—"}
                      </td>
                      <td className="py-3 px-2 text-right text-gray-400">
                        {!isDebit
                          ? tx.amount.toLocaleString("ru-RU", {
                              minimumFractionDigits: 0,
                            })
                          : "—"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

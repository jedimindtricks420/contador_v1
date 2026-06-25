"use client";
import { useEffect, useState } from "react";
import { CheckCircle2, AlertTriangle, RefreshCw } from "lucide-react";
import { formatSum } from "@/lib/format";

interface Transaction {
  id: string;
  date: string;
  amount: number;
  direction: "CREDIT" | "DEBIT";
  description: string;
  counterpartyHint: string | null;
  counterpartyInn: string | null;
  status: string;
}

interface Step3RegistryProps {
  periodId: string;
  onNext: () => void;
  onPrev: () => void;
}

export default function Step3Registry({ periodId, onNext, onPrev }: Step3RegistryProps) {
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [docTypes, setDocTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [selectedDocTypes, setSelectedDocTypes] = useState<Record<string, string>>({});

  const loadRegistry = async () => {
    setLoadError(false);
    try {
      const [txRes, docRes] = await Promise.all([
        fetch(`/v2/api/transactions?periodId=${periodId}`),
        fetch("/v2/api/document-types")
      ]);
      const txData = await txRes.json();
      const docData = await docRes.json();

      setDocTypes(docData);
      // Filter in-memory to find only IMPORTED or NEEDS_CLARIFICATION (uncategorized)
      const uncategorized = (txData.items || []).filter(
        (t: Transaction) => t.status === "IMPORTED" || t.status === "NEEDS_CLARIFICATION"
      );
      setTxs(uncategorized);
    } catch (err) {
      console.error(err);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRegistry();
  }, [periodId]);

  const handleClassify = async (txId: string, docTypeId: string) => {
    try {
      const res = await fetch(`/v2/api/transactions/${txId}/category`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentTypeId: docTypeId, createRule: false })
      });
      if (res.ok) {
        // Remove from list
        setTxs(prev => prev.filter(t => t.id !== txId));
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-6 text-gray-500 font-medium">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-300 mr-2"></div>
        Загрузка реестра...
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="bg-rose-50 border border-rose-200 rounded p-8 text-center space-y-3">
        <AlertTriangle className="h-8 w-8 text-rose-400 mx-auto" />
        <p className="text-sm font-bold text-rose-800">Не удалось загрузить реестр операций</p>
        <p className="text-xs text-rose-600">Проверьте подключение к сети и попробуйте снова.</p>
        <button
          onClick={() => { setLoading(true); loadRegistry(); }}
          className="inline-flex items-center gap-1.5 text-xs bg-rose-600 hover:bg-rose-700 text-white font-bold py-2 px-4 rounded transition"
        >
          <RefreshCw size={12} />Повторить
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-base font-bold text-gray-800">Шаг 3. Проверка реестра транзакций</h2>
          <p className="text-xs text-gray-400 mt-1">
            Проверьте транзакции без назначенной категории. Для корректной проводки периода желательно распределить все операции.
          </p>
        </div>
        <a
          href="/v2/transactions"
          target="_blank"
          className="text-xs font-bold text-black bg-gray-100 px-3 py-1.5 rounded hover:underline whitespace-nowrap"
        >
          Реестр в новой вкладке ↗
        </a>
      </div>

      <div className="bg-gray-50 rounded p-3.5 border border-gray-150 flex justify-between items-center text-xs">
        <span className="font-semibold text-gray-600">
          Операций без категории: <span className="font-extrabold text-gray-800">{txs.length}</span>
        </span>
        {txs.length > 0 && (
          <span className="text-[10px] text-gray-600 font-bold bg-gray-50 px-2 py-0.5 rounded border border-gray-200 uppercase tracking-wider">
            Требуют внимания
          </span>
        )}
      </div>

      {txs.length === 0 ? (
        <div className="bg-gray-50/20 border border-gray-200 rounded p-8 text-center text-xs space-y-2">
          <CheckCircle2 className="h-8 w-8 text-green-500 mx-auto" />
          <h3 className="font-bold text-gray-700">Все операции распределены!</h3>
          <p className="text-gray-500">В этом периоде нет транзакций без категории.</p>
        </div>
      ) : (
        <div className="overflow-hidden border border-gray-200 rounded">
          <div className="overflow-x-auto max-h-[300px]">
            <table className="w-full text-left border-collapse text-[11px]">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 font-bold">
                  <th className="p-2.5">Дата</th>
                  <th className="p-2.5">Контрагент</th>
                  <th className="p-2.5">Сумма</th>
                  <th className="p-2.5">Назначение платежа</th>
                  <th className="p-2.5">Категория</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-medium">
                {txs.map((tx) => (
                  <tr key={tx.id} className="hover:bg-gray-50/50">
                    <td className="p-2.5 text-gray-500 whitespace-nowrap">
                      {new Date(tx.date).toLocaleDateString("ru-RU")}
                    </td>
                    <td className="p-2.5">
                      <div className="font-bold text-gray-700">{tx.counterpartyHint || "—"}</div>
                      {tx.counterpartyInn && <div className="text-[9px] font-mono text-gray-400">ИНН: {tx.counterpartyInn}</div>}
                    </td>
                    <td className="p-2.5 font-bold whitespace-nowrap">
                      <span className={tx.direction === "CREDIT" ? "text-gray-700" : "text-rose-600"}>
                        {tx.direction === "CREDIT" ? "+" : "-"}{formatSum(tx.amount)}
                      </span>
                    </td>
                    <td className="p-2.5 text-gray-500 truncate max-w-[200px]" title={tx.description}>
                      {tx.description}
                    </td>
                    <td className="p-2.5">
                      <div className="flex items-center gap-1.5">
                        <select
                          value={selectedDocTypes[tx.id] || ""}
                          onChange={(e) => setSelectedDocTypes(prev => ({ ...prev, [tx.id]: e.target.value }))}
                          className="bg-white border border-gray-200 rounded px-2 py-1 outline-hidden text-[10px] flex-1"
                        >
                          <option value="">— Очистить / Пропустить —</option>
                          {docTypes.map((t) => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                          ))}
                        </select>
                        {selectedDocTypes[tx.id] && (
                          <button
                            onClick={() => handleClassify(tx.id, selectedDocTypes[tx.id])}
                            className="text-[10px] bg-black text-white font-bold px-2 py-1 rounded hover:opacity-80 transition whitespace-nowrap"
                          >
                            ✓
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Nav Buttons */}
      <div className="flex justify-between items-center pt-4 border-t border-gray-100">
        <button
          onClick={onPrev}
          className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold py-2 px-5 rounded transition"
        >
          ← Назад
        </button>
        <button
          onClick={onNext}
          className="text-xs bg-gray-800 hover:bg-gray-900 text-white font-bold py-2 px-6 rounded transition"
        >
          {txs.length > 0 ? "Продолжить с предупреждением →" : "Продолжить →"}
        </button>
      </div>
    </div>
  );
}

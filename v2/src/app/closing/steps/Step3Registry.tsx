"use client";
import { useEffect, useState, useMemo } from "react";
import { CheckCircle2, AlertTriangle, RefreshCw, Pencil, X } from "lucide-react";
import { formatSum } from "@/lib/format";

interface DocType {
  id: string;
  name: string;
  code: string;
}

interface Transaction {
  id: string;
  date: string;
  amount: number;
  direction: "CREDIT" | "DEBIT";
  description: string;
  counterpartyHint: string | null;
  counterpartyInn: string | null;
  status: string;
  document: {
    id: string;
    type: { id: string; name: string; code: string };
  } | null;
}

interface Step3RegistryProps {
  periodId: string;
  onNext: () => void;
  onPrev: () => void;
}

const UNCATEGORIZED = ["IMPORTED", "NEEDS_CLARIFICATION"];

export default function Step3Registry({ periodId, onNext, onPrev }: Step3RegistryProps) {
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [docTypes, setDocTypes] = useState<DocType[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [filter, setFilter] = useState<"all" | "uncategorized" | "ai">("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedDocTypes, setSelectedDocTypes] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

  const loadRegistry = async () => {
    setLoadError(false);
    try {
      const [txRes, docRes] = await Promise.all([
        fetch(`/v2/api/transactions?periodId=${periodId}&status=IMPORTED,NEEDS_CLARIFICATION,AUTO_MATCHED&limit=2000`),
        fetch("/v2/api/document-types")
      ]);
      const txData = await txRes.json();
      const docData = await docRes.json();

      setDocTypes(docData);

      // Sort: uncategorized first, then AI-matched
      const sorted = (txData.items || []).slice().sort((a: Transaction, b: Transaction) => {
        const aUn = UNCATEGORIZED.includes(a.status);
        const bUn = UNCATEGORIZED.includes(b.status);
        if (aUn && !bUn) return -1;
        if (!aUn && bUn) return 1;
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      });

      setTxs(sorted);
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
    setSaving(txId);
    try {
      const res = await fetch(`/v2/api/transactions/${txId}/category`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentTypeId: docTypeId, createRule: false })
      });
      if (res.ok) {
        const docType = docTypes.find((d) => d.id === docTypeId);
        setTxs((prev) =>
          prev.map((t) =>
            t.id === txId
              ? {
                  ...t,
                  status: "CONFIRMED",
                  document: docType
                    ? { id: "", type: { id: docTypeId, name: docType.name, code: docType.code } }
                    : t.document
                }
              : t
          )
        );
        setEditingId(null);
        setSelectedDocTypes((prev) => { const n = { ...prev }; delete n[txId]; return n; });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(null);
    }
  };

  const uncategorizedCount = useMemo(() => txs.filter((t) => UNCATEGORIZED.includes(t.status)).length, [txs]);
  const aiCount = useMemo(() => txs.filter((t) => t.status === "AUTO_MATCHED").length, [txs]);

  const filteredTxs = useMemo(() => {
    if (filter === "uncategorized") return txs.filter((t) => UNCATEGORIZED.includes(t.status));
    if (filter === "ai") return txs.filter((t) => t.status === "AUTO_MATCHED");
    return txs;
  }, [txs, filter]);

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
    <div className="space-y-5">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-base font-bold text-gray-800">Шаг 3. Проверка реестра транзакций</h2>
          <p className="text-xs text-gray-400 mt-1">
            Проверьте что ИИ правильно распознал категории. Исправьте ошибки и назначьте категории вручную если нужно.
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

      {/* Summary + Filters */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setFilter("all")}
          className={`text-[11px] font-bold px-3 py-1.5 rounded border transition ${filter === "all" ? "bg-black text-white border-black" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"}`}
        >
          Все ({txs.length})
        </button>
        <button
          onClick={() => setFilter("uncategorized")}
          className={`text-[11px] font-bold px-3 py-1.5 rounded border transition ${filter === "uncategorized" ? "bg-rose-600 text-white border-rose-600" : "bg-white text-rose-600 border-rose-200 hover:border-rose-400"}`}
        >
          Без категории ({uncategorizedCount})
        </button>
        <button
          onClick={() => setFilter("ai")}
          className={`text-[11px] font-bold px-3 py-1.5 rounded border transition ${filter === "ai" ? "bg-blue-600 text-white border-blue-600" : "bg-white text-blue-600 border-blue-200 hover:border-blue-400"}`}
        >
          Распознано ИИ ({aiCount})
        </button>
      </div>

      {filteredTxs.length === 0 ? (
        <div className="bg-gray-50/20 border border-gray-200 rounded p-8 text-center text-xs space-y-2">
          <CheckCircle2 className="h-8 w-8 text-green-500 mx-auto" />
          <h3 className="font-bold text-gray-700">
            {filter === "uncategorized" ? "Все операции распределены!" : filter === "ai" ? "ИИ не распознал ни одной операции" : "Нет транзакций в этом периоде"}
          </h3>
          <p className="text-gray-500">
            {filter === "uncategorized" ? "В этом периоде нет транзакций без категории." : filter === "ai" ? "Возможно, все операции распределены правилами или требуют ручной классификации." : "Импортируйте банковскую выписку на шаге 1."}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden border border-gray-200 rounded">
          <div className="overflow-x-auto overflow-y-auto max-h-[420px]">
            <table className="w-full text-left border-collapse text-[11px]">
              <thead className="sticky top-0 z-10">
                <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 font-bold">
                  <th className="p-2.5 w-[80px]">Дата</th>
                  <th className="p-2.5 w-[130px]">Контрагент</th>
                  <th className="p-2.5 w-[100px]">Сумма</th>
                  <th className="p-2.5">Назначение платежа</th>
                  <th className="p-2.5 w-[220px]">Категория</th>
                  <th className="p-2.5 w-[80px]">Статус</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-medium">
                {filteredTxs.map((tx) => {
                  const isUncategorized = UNCATEGORIZED.includes(tx.status);
                  const isEditing = editingId === tx.id;
                  const currentTypeId = tx.document?.type?.id || "";
                  const selectValue = isEditing
                    ? (selectedDocTypes[tx.id] ?? currentTypeId)
                    : (selectedDocTypes[tx.id] || "");

                  return (
                    <tr key={tx.id} className={`hover:bg-gray-50/50 ${isUncategorized ? "bg-rose-50/30" : ""}`}>
                      <td className="p-2.5 text-gray-500 whitespace-nowrap">
                        {new Date(tx.date).toLocaleDateString("ru-RU")}
                      </td>
                      <td className="p-2.5">
                        <div className="font-bold text-gray-700 truncate max-w-[120px]" title={tx.counterpartyHint || ""}>
                          {tx.counterpartyHint || "—"}
                        </div>
                        {tx.counterpartyInn && (
                          <div className="text-[9px] font-mono text-gray-400">ИНН: {tx.counterpartyInn}</div>
                        )}
                      </td>
                      <td className="p-2.5 font-bold whitespace-nowrap">
                        <span className={tx.direction === "CREDIT" ? "text-gray-700" : "text-rose-600"}>
                          {tx.direction === "CREDIT" ? "+" : "−"}{formatSum(tx.amount)}
                        </span>
                      </td>
                      <td className="p-2.5 text-gray-500 truncate max-w-[180px]" title={tx.description}>
                        {tx.description}
                      </td>
                      <td className="p-2.5">
                        {/* Uncategorized: always show select */}
                        {isUncategorized && (
                          <div className="flex items-center gap-1.5">
                            <select
                              value={selectedDocTypes[tx.id] || ""}
                              onChange={(e) => setSelectedDocTypes((prev) => ({ ...prev, [tx.id]: e.target.value }))}
                              className="bg-white border border-gray-200 rounded px-2 py-1 outline-hidden text-[10px] flex-1"
                            >
                              <option value="">— Выберите категорию —</option>
                              {docTypes.map((t) => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                              ))}
                            </select>
                            {selectedDocTypes[tx.id] && (
                              <button
                                onClick={() => handleClassify(tx.id, selectedDocTypes[tx.id])}
                                disabled={saving === tx.id}
                                className="text-[10px] bg-black text-white font-bold px-2 py-1 rounded hover:opacity-80 transition whitespace-nowrap disabled:opacity-50"
                              >
                                {saving === tx.id ? "..." : "✓"}
                              </button>
                            )}
                          </div>
                        )}

                        {/* AI matched or confirmed: show category + edit button */}
                        {!isUncategorized && !isEditing && (
                          <div className="flex items-center gap-1.5 group">
                            <span className="text-[10px] text-gray-700 font-semibold leading-tight flex-1">
                              {tx.document?.type?.name || "—"}
                            </span>
                            <button
                              onClick={() => {
                                setEditingId(tx.id);
                                setSelectedDocTypes((prev) => ({ ...prev, [tx.id]: currentTypeId }));
                              }}
                              className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-black transition-opacity"
                              title="Изменить категорию"
                            >
                              <Pencil size={11} />
                            </button>
                          </div>
                        )}

                        {/* Editing mode for AI-classified row */}
                        {!isUncategorized && isEditing && (
                          <div className="flex items-center gap-1.5">
                            <select
                              value={selectValue}
                              onChange={(e) => setSelectedDocTypes((prev) => ({ ...prev, [tx.id]: e.target.value }))}
                              className="bg-white border border-black rounded px-2 py-1 outline-hidden text-[10px] flex-1"
                            >
                              <option value="">— Выберите категорию —</option>
                              {docTypes.map((t) => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                              ))}
                            </select>
                            <button
                              onClick={() => {
                                const val = selectedDocTypes[tx.id] ?? currentTypeId;
                                if (val) handleClassify(tx.id, val);
                              }}
                              disabled={saving === tx.id}
                              className="text-[10px] bg-black text-white font-bold px-2 py-1 rounded hover:opacity-80 transition whitespace-nowrap disabled:opacity-50"
                            >
                              {saving === tx.id ? "..." : "✓"}
                            </button>
                            <button
                              onClick={() => { setEditingId(null); setSelectedDocTypes((prev) => { const n = { ...prev }; delete n[tx.id]; return n; }); }}
                              className="text-gray-400 hover:text-black transition"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="p-2.5">
                        {isUncategorized ? (
                          <span className="text-[9px] font-bold bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded uppercase tracking-wide">
                            {tx.status === "NEEDS_CLARIFICATION" ? "Не распознан" : "Новый"}
                          </span>
                        ) : tx.status === "AUTO_MATCHED" ? (
                          <span className="text-[9px] font-bold bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded uppercase tracking-wide">
                            ИИ
                          </span>
                        ) : (
                          <span className="text-[9px] font-bold bg-green-100 text-green-700 px-1.5 py-0.5 rounded uppercase tracking-wide">
                            ✓
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
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
          {uncategorizedCount > 0 ? `Продолжить (${uncategorizedCount} без категории) →` : "Продолжить →"}
        </button>
      </div>
    </div>
  );
}

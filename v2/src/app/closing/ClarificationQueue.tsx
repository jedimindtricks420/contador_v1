"use client";
import { useEffect, useState } from "react";
import { CheckCircle2, Briefcase, AlertTriangle, RefreshCw } from "lucide-react";
import { formatSum } from "@/lib/format";

interface Transaction {
  id: string;
  date: string;
  amount: number;
  direction: "CREDIT" | "DEBIT";
  description: string;
}

interface ClarificationGroup {
  groupId: string;
  counterpartyHint: string;
  counterpartyInn: string | null;
  transactions: Transaction[];
  aiSuggestion: {
    categoryId: string;
    confidence: number;
    extractedCounterparty: string;
    extractedInn: string;
    vatApplicable: boolean;
  } | null;
}

interface DocumentType {
  id: string;
  code: string;
  name: string;
}

interface ClarificationQueueProps {
  periodId: string;
  onDone: () => void;
  onBack?: () => void;
}

export default function ClarificationQueue({ periodId, onDone, onBack }: ClarificationQueueProps) {
  const [groups, setGroups] = useState<ClarificationGroup[]>([]);
  const [docTypes, setDocTypes] = useState<DocumentType[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [answeringGroupId, setAnsweringGroupId] = useState<string | null>(null);
  const [dismissedGroups, setDismissedGroups] = useState<string[]>([]);
  const [showSkipAllConfirm, setShowSkipAllConfirm] = useState(false);

  // Category selections per group
  const [selectedCategories, setSelectedCategories] = useState<Record<string, string>>({});
  const [rememberSelections, setRememberSelections] = useState<Record<string, boolean>>({});

  const loadQueue = async () => {
    try {
      const [queueRes, docTypesRes] = await Promise.all([
        fetch(`/v2/api/clarification/queue?periodId=${periodId}`),
        fetch("/v2/api/document-types")
      ]);

      const queueData = await queueRes.json();
      const docTypesData = await docTypesRes.json();

      setGroups(queueData);
      setDocTypes(docTypesData);

      // Pre-select AI suggestion category where available
      const initialCats: Record<string, string> = {};
      const initialRemember: Record<string, boolean> = {};

      queueData.forEach((g: ClarificationGroup) => {
        if (g.aiSuggestion) {
          initialCats[g.groupId] = g.aiSuggestion.categoryId;
        } else if (docTypesData.length > 0) {
          initialCats[g.groupId] = docTypesData[0].id;
        }
        initialRemember[g.groupId] = true;
      });

      setSelectedCategories(initialCats);
      setRememberSelections(initialRemember);
    } catch (err) {
      console.error("Failed to load clarification queue:", err);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQueue();
  }, [periodId]);

  const handleAnswer = async (group: ClarificationGroup, forceCategoryId?: string) => {
    const categoryId = forceCategoryId || selectedCategories[group.groupId];
    if (!categoryId) return;

    setAnsweringGroupId(group.groupId);

    const matchType = group.counterpartyInn ? "INN" : "KEYWORD";
    const matchValue = group.counterpartyInn || group.counterpartyHint;

    try {
      const res = await fetch("/v2/api/clarification/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transactionIds: group.transactions.map(t => t.id),
          documentTypeId: categoryId,
          createRule: rememberSelections[group.groupId],
          ruleMatchType: matchType,
          ruleMatchValue: matchValue
        })
      });

      if (res.ok) {
        // Trigger fade out
        setDismissedGroups(prev => [...prev, group.groupId]);
        setTimeout(() => {
          setGroups(prev => prev.filter(g => g.groupId !== group.groupId));
          setAnsweringGroupId(null);
        }, 300);
      }
    } catch (err) {
      console.error("Failed to answer clarification:", err);
      setAnsweringGroupId(null);
    }
  };

  const handleRetry = () => {
    setLoadError(false);
    setLoading(true);
    loadQueue();
  };

  const handleSkip = (groupId: string) => {
    setDismissedGroups(prev => [...prev, groupId]);
    setTimeout(() => {
      setGroups(prev => prev.filter(g => g.groupId !== groupId));
    }, 300);
  };

  // If all groups are dismissed/processed, trigger onDone
  useEffect(() => {
    if (!loading && groups.length === 0) {
      onDone();
    }
  }, [groups, loading]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-gray-500 font-medium">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-300 mr-3"></div>
        Загрузка вопросов...
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="bg-rose-50 border border-rose-200 rounded p-8 text-center space-y-3">
        <AlertTriangle className="h-8 w-8 text-rose-400 mx-auto" />
        <p className="text-sm font-bold text-rose-800">Не удалось загрузить очередь уточнений</p>
        <p className="text-xs text-rose-600">Проверьте подключение к сети и попробуйте снова.</p>
        <button
          onClick={handleRetry}
          className="inline-flex items-center gap-1.5 text-xs bg-rose-600 hover:bg-rose-700 text-white font-bold py-2 px-4 rounded transition"
        >
          <RefreshCw size={12} />Повторить
        </button>
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="bg-white rounded p-8 border border-gray-200 text-center space-y-3">
        <CheckCircle2 className="h-10 w-10 text-green-500 mx-auto" />
        <h3 className="text-base font-bold text-gray-800">Все операции классифицированы!</h3>
        <p className="text-sm text-gray-500 max-w-sm mx-auto">
          Для этого периода не осталось операций, требующих ручного уточнения. Вы можете переходить к следующему шагу.
        </p>
        <button
          onClick={onDone}
          className="mt-2 bg-black hover:opacity-80 text-white text-sm font-semibold py-2 px-6 rounded transition"
        >
          Далее
        </button>
      </div>
    );
  }

  return (
    <>
    <div className="space-y-6">
      {/* Queue Header & Progress */}
      <div className="bg-gray-50 rounded p-4 border border-gray-200 flex flex-col md:flex-row justify-between items-center gap-4 text-xs">
        <div>
          <div className="font-bold text-gray-700 text-sm">Очередь уточняющих вопросов</div>
          <div className="text-gray-400">Ответьте на вопросы, чтобы завершить классификацию операций периода</div>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          {onBack && (
            <button
              onClick={onBack}
              className="text-xs bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 py-1.5 px-3 rounded font-semibold transition"
            >
              ← Назад
            </button>
          )}
          <div className="font-semibold text-gray-700 whitespace-nowrap">Осталось групп: {groups.length}</div>
          <button
            onClick={() => setShowSkipAllConfirm(true)}
            className="text-xs bg-gray-200 hover:bg-gray-300 text-gray-700 py-1.5 px-3 rounded font-semibold transition"
          >
            Пропустить всё
          </button>
        </div>
      </div>

      {/* Cards List */}
      <div className="space-y-6">
        {groups.map((group) => {
          const isDismissing = dismissedGroups.includes(group.groupId);
          const isAnswering = answeringGroupId === group.groupId;
          const aiRecType = group.aiSuggestion 
            ? docTypes.find(t => t.id === group.aiSuggestion?.categoryId) 
            : null;

          const groupTotal = group.transactions.reduce((sum, t) => sum + t.amount, 0);

          return (
            <div
              key={group.groupId}
              className={`bg-white rounded border border-gray-200 shadow-sm overflow-hidden transition-all duration-300 transform ${
                isDismissing ? "opacity-0 scale-95 max-h-0 py-0 my-0 border-none" : "opacity-100 scale-100"
              }`}
            >
              {/* Card Header */}
              <div className="bg-gray-50/50 p-5 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Briefcase size={16} className="text-gray-400 shrink-0" />
                    <h3 className="text-sm font-bold text-gray-800">{group.counterpartyHint}</h3>
                    {group.counterpartyInn && (
                      <span className="bg-gray-100 text-gray-500 font-mono px-2 py-0.5 rounded-sm text-[10px]">
                        ИНН: {group.counterpartyInn}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    Сумма группы: {formatSum(groupTotal)} ({group.transactions.length} опер.)
                  </p>
                </div>
                <button
                  onClick={() => handleSkip(group.groupId)}
                  className="text-xs text-gray-400 hover:text-gray-600 font-semibold self-start md:self-auto"
                >
                  Пропустить
                </button>
              </div>

              {/* Transactions List */}
              <div className="p-5 border-b border-gray-100 space-y-2.5 max-h-[220px] overflow-y-auto">
                {group.transactions.map((tx) => (
                  <div key={tx.id} className="flex justify-between items-start gap-4 text-xs py-1">
                    <div className="space-y-0.5">
                      <div className="font-semibold text-gray-700">{tx.description}</div>
                      <div className="text-gray-400">{tx.date}</div>
                    </div>
                    <span className="font-bold text-gray-800 whitespace-nowrap">{formatSum(tx.amount)}</span>
                  </div>
                ))}
              </div>

              {/* Category Clarification Options */}
              <div className="p-5 bg-gray-50/20 space-y-4">
                <div className="text-xs font-semibold text-gray-500">Что это за операции?</div>

                <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                  {/* AI Recommendation Shortcut */}
                  {aiRecType && (
                    <div className="bg-gray-100 border border-gray-300 rounded p-3 flex items-center justify-between gap-4 w-full md:w-auto">
                      <div>
                        <div className="text-[10px] text-black font-bold uppercase tracking-wider">Рекомендация ИИ</div>
                        <div className="text-xs font-bold text-black">{aiRecType.name}</div>
                        <div className="text-[10px] text-black">Уверенность: {group.aiSuggestion?.confidence}%</div>
                      </div>
                      <button
                        onClick={() => handleAnswer(group, aiRecType.id)}
                        disabled={isAnswering}
                        className="bg-black hover:opacity-80 text-white text-xs font-bold py-1.5 px-3.5 rounded transition whitespace-nowrap disabled:opacity-50"
                      >
                        Это верно
                      </button>
                    </div>
                  )}

                  {/* Fallback Selector & Form Submit */}
                  <div className="flex items-center gap-3 w-full md:w-auto flex-1 md:justify-end">
                    <select
                      value={selectedCategories[group.groupId] || ""}
                      onChange={(e) =>
                        setSelectedCategories(prev => ({ ...prev, [group.groupId]: e.target.value }))
                      }
                      className="bg-white border border-gray-200 rounded px-3 py-2 text-xs text-gray-700 outline-hidden focus:border-black flex-1 md:flex-none md:min-w-[220px]"
                    >
                      {docTypes.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>

                    <button
                      onClick={() => handleAnswer(group)}
                      disabled={isAnswering}
                      className="bg-gray-800 hover:bg-gray-900 text-white text-xs font-bold py-2 px-5 rounded transition disabled:opacity-50"
                    >
                      {isAnswering ? "..." : "Выбрать"}
                    </button>
                  </div>
                </div>

                {/* Remember Rule Checkbox */}
                <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                  <input
                    type="checkbox"
                    id={`rem-${group.groupId}`}
                    checked={rememberSelections[group.groupId] || false}
                    onChange={(e) =>
                      setRememberSelections(prev => ({
                        ...prev,
                        [group.groupId]: e.target.checked
                      }))
                    }
                    className="h-3.5 w-3.5 text-black border-gray-300 rounded focus:ring-black"
                  />
                  <label htmlFor={`rem-${group.groupId}`} className="text-[11px] text-gray-500 cursor-pointer select-none">
                    Запомнить мой выбор для контрагента {group.counterpartyHint} (создать правило)
                  </label>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>

    {/* Skip all confirm modal */}

    {showSkipAllConfirm && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div className="bg-white rounded border border-gray-200 shadow-xl max-w-sm w-full p-6 space-y-4">
          <div className="flex items-start gap-2">
            <AlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" />
            <h3 className="text-sm font-bold text-gray-800">Пропустить все операции?</h3>
          </div>
          <p className="text-xs text-gray-600 leading-relaxed">
            <strong>{groups.length} групп</strong> операций останутся без категории. Их можно будет классифицировать позже в разделе «Реестр операций».
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => setShowSkipAllConfirm(false)}
              className="flex-1 text-xs border border-gray-200 text-gray-700 font-bold py-2.5 rounded hover:bg-gray-50 transition"
            >
              Отмена
            </button>
            <button
              onClick={() => { setShowSkipAllConfirm(false); onDone(); }}
              className="flex-1 text-xs bg-gray-800 hover:bg-gray-900 text-white font-bold py-2.5 rounded transition"
            >
              Пропустить все →
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}

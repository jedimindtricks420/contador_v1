"use client";

import { useEffect, useState } from "react";
import { Wrench, Pencil, Bot, X, Trash2, AlertTriangle, Zap } from "lucide-react";
import ClientLayout from "@/components/Layout/ClientLayout";
import { formatDate } from "@/lib/format";

interface DocumentType {
  id: string;
  code: string;
  name: string;
}

interface Rule {
  id: string;
  matchType: "INN" | "KEYWORD" | "AMOUNT_RANGE" | "TREASURY_ACCOUNT";
  matchValue: string;
  categoryId: string;
  direction: "DEBIT" | "CREDIT" | null;
  createdFrom: "USER_ANSWER" | "MANUAL" | "AI_SUGGESTED";
  createdAt: string;
  documentType: {
    name: string;
    code: string;
  };
  order: number;
}

const TYPE_LABELS: Record<string, { label: string; desc: string; bg: string; text: string }> = {
  INN: {
    label: "ИНН контрагента",
    desc: "Точное совпадение по ИНН отправителя/получателя",
    bg: "bg-gray-100 border-gray-300",
    text: "text-black",
  },
  KEYWORD: {
    label: "Ключевое слово",
    desc: "Поиск подстроки в назначении платежа (без учёта регистра)",
    bg: "bg-gray-100 border-gray-200",
    text: "text-gray-700",
  },
  AMOUNT_RANGE: {
    label: "Диапазон сумм",
    desc: "Диапазон сумм транзакции, формат: Мин - Макс (например: 1000-5000)",
    bg: "bg-gray-50 border-gray-200",
    text: "text-gray-600",
  },
  TREASURY_ACCOUNT: {
    label: "Казначейский счёт",
    desc: "Совпадение ИНН казначейства или ключевого слова в назначении",
    bg: "bg-gray-50 border-gray-200",
    text: "text-gray-700",
  },
};

const SOURCE_LABELS: Record<string, { label: string; bg: string; text: string }> = {
  USER_ANSWER: {
    label: "Авто (из ответа)",
    bg: "bg-gray-100 border-gray-200",
    text: "text-gray-700",
  },
  MANUAL: {
    label: "Вручную",
    bg: "bg-gray-100 border-gray-200",
    text: "text-gray-700",
  },
  AI_SUGGESTED: {
    label: "AI",
    bg: "bg-violet-50 border-violet-200",
    text: "text-violet-700",
  },
};

export default function RulesPage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [categories, setCategories] = useState<DocumentType[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("ALL");

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<Rule | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);

  // Bulk-apply after creating a new rule
  const [bulkApply, setBulkApply] = useState<{
    ruleId: string;
    matchType: string;
    matchValue: string;
    transactions: Array<{ id: string; date: string; amount: number; direction: string; description: string; counterpartyHint: string | null }>;
  } | null>(null);
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set());
  const [bulkApplying, setBulkApplying] = useState(false);

  // Delete confirm
  const [deleteRuleTarget, setDeleteRuleTarget] = useState<Rule | null>(null);
  const [deleteError, setDeleteError] = useState<string>("");
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Reorder state
  const [reordering, setReordering] = useState(false);
  const [sortFilterWarning, setSortFilterWarning] = useState(false);

  // Form Fields
  const [formType, setFormType] = useState<Rule["matchType"]>("INN");
  const [formValue, setFormValue] = useState("");
  const [formCategory, setFormCategory] = useState("");
  const [formDirection, setFormDirection] = useState<"" | "DEBIT" | "CREDIT">("");

  const loadData = async () => {
    setLoading(true);
    try {
      const [rulesRes, categoriesRes] = await Promise.all([
        fetch("/v2/api/rules"),
        fetch("/v2/api/document-types"),
      ]);

      if (rulesRes.ok && categoriesRes.ok) {
        const rulesData = await rulesRes.json();
        const categoriesData = await categoriesRes.json();
        setRules(rulesData);
        setCategories(categoriesData);

        if (categoriesData.length > 0) {
          setFormCategory(categoriesData[0].id);
        }
      }
    } catch (err) {
      console.error("Failed to load rules page data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openCreateModal = () => {
    setEditingRule(null);
    setFormType("INN");
    setFormValue("");
    setFormDirection("");
    if (categories.length > 0) {
      setFormCategory(categories[0].id);
    }
    setModalError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (rule: Rule) => {
    setEditingRule(rule);
    setFormType(rule.matchType);
    setFormValue(rule.matchValue);
    setFormCategory(rule.categoryId);
    setFormDirection((rule.direction as "" | "DEBIT" | "CREDIT") || "");
    setModalError(null);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);

    // Basic Validations
    if (!formValue.trim()) {
      setModalError("Значение правила не может быть пустым");
      return;
    }

    if (formType === "AMOUNT_RANGE") {
      const cleaned = formValue.replace(/\s/g, "");
      const parts = cleaned.split("-");
      if (parts.length !== 2 || isNaN(Number(parts[0])) || isNaN(Number(parts[1]))) {
        setModalError("Для диапазона сумм используйте формат: Мин - Макс (например, 1000 - 5000)");
        return;
      }
    }

    const payload = {
      matchType: formType,
      matchValue: formValue.trim(),
      categoryId: formCategory,
      direction: formDirection || null,
    };

    try {
      let res;
      if (editingRule) {
        res = await fetch(`/v2/api/rules/${editingRule.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch("/v2/api/rules", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      if (res.ok) {
        const savedRule = await res.json();
        setIsModalOpen(false);
        loadData();

        // For new rules only: check if similar unclassified transactions exist
        if (!editingRule && (formType === "INN" || formType === "KEYWORD")) {
          try {
            const dirParam = formDirection ? `&direction=${encodeURIComponent(formDirection)}` : "";
            const previewRes = await fetch(
              `/v2/api/rules/preview?matchType=${encodeURIComponent(formType)}&matchValue=${encodeURIComponent(formValue.trim())}${dirParam}`
            );
            if (previewRes.ok) {
              const previewData = await previewRes.json();
              if ((previewData.transactions || []).length > 0) {
                setBulkApply({
                  ruleId: savedRule.id,
                  matchType: formType,
                  matchValue: formValue.trim(),
                  transactions: previewData.transactions,
                });
                setBulkSelected(new Set(previewData.transactions.map((t: any) => t.id)));
              }
            }
          } catch {
            // non-critical
          }
        }
      } else {
        const errData = await res.json();
        setModalError(errData.error || "Произошла ошибка при сохранении правила");
      }
    } catch (err) {
      console.error(err);
      setModalError("Не удалось связаться с сервером");
    }
  };

  const handleDeleteConfirmed = async () => {
    if (!deleteRuleTarget) return;
    setDeleteLoading(true);
    setDeleteError("");
    try {
      const res = await fetch(`/v2/api/rules/${deleteRuleTarget.id}`, { method: "DELETE" });
      if (res.ok) {
        setDeleteRuleTarget(null);
        loadData();
      } else {
        const data = await res.json().catch(() => ({}));
        setDeleteError(data.error || "Не удалось удалить правило");
      }
    } catch {
      setDeleteError("Ошибка сети при удалении");
    } finally {
      setDeleteLoading(false);
    }
  };

  const moveRule = async (index: number, direction: "up" | "down") => {
    if (filterType !== "ALL" || searchTerm) {
      setSortFilterWarning(true);
      return;
    }

    const newRules = [...rules];
    if (direction === "up" && index > 0) {
      [newRules[index - 1], newRules[index]] = [newRules[index], newRules[index - 1]];
    } else if (direction === "down" && index < newRules.length - 1) {
      [newRules[index + 1], newRules[index]] = [newRules[index], newRules[index + 1]];
    } else {
      return;
    }

    setRules(newRules);
    setReordering(true);
    const ids = newRules.map(r => r.id);
    try {
      await fetch("/v2/api/rules/reorder", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
    } catch (err) {
      console.error("Failed to reorder", err);
    } finally {
      setReordering(false);
    }
  };

  // Filters rules based on search query and type filter
  const filteredRules = rules.filter((rule) => {
    const matchesSearch =
      rule.matchValue.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rule.documentType.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rule.documentType.code.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesType = filterType === "ALL" || rule.matchType === filterType;
    return matchesSearch && matchesType;
  });

  const handleBulkApply = async () => {
    if (!bulkApply || bulkSelected.size === 0) return;
    setBulkApplying(true);
    try {
      await fetch(`/v2/api/rules/${bulkApply.ruleId}/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactionIds: Array.from(bulkSelected) }),
      });
    } catch (err) {
      console.error("Bulk apply failed:", err);
    } finally {
      setBulkApplying(false);
      setBulkApply(null);
      setBulkSelected(new Set());
    }
  };

  const manualCount = rules.filter((r) => r.createdFrom === "MANUAL").length;
  const autoCount = rules.filter((r) => r.createdFrom === "USER_ANSWER").length;

  return (
    <>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-6 border-b border-gray-200">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Правила автоматической классификации</h1>
            <p className="text-xs text-gray-400 mt-0.5">
              Настройка правил для распределения входящих банковских операций по категориям и счетам
            </p>
          </div>
          <button
            onClick={openCreateModal}
            className="bg-black hover:opacity-80 text-white text-xs font-bold py-2.5 px-6 rounded transition duration-200 shadow-sm flex items-center gap-2"
          >
            <span>+</span> Добавить правило
          </button>
        </div>

        {/* Stats Blocks */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-5 rounded border border-gray-200 flex items-center justify-between shadow-sm">
            <div>
              <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Всего правил</div>
              <div className="text-2xl font-bold text-gray-800 mt-1">{rules.length}</div>
            </div>
            <div className="h-10 w-10 rounded bg-gray-100 flex items-center justify-center">
              <Wrench size={20} className="text-gray-700" />
            </div>
          </div>
          <div className="bg-white p-5 rounded border border-gray-200 flex items-center justify-between shadow-sm">
            <div>
              <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Создано вручную</div>
              <div className="text-2xl font-bold text-gray-800 mt-1">{manualCount}</div>
            </div>
            <div className="h-10 w-10 rounded bg-gray-50 flex items-center justify-center">
              <Pencil size={20} className="text-gray-600" />
            </div>
          </div>
          <div className="bg-white p-5 rounded border border-gray-200 flex items-center justify-between shadow-sm">
            <div>
              <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Автоматические правила</div>
              <div className="text-2xl font-bold text-gray-800 mt-1">{autoCount}</div>
            </div>
            <div className="h-10 w-10 rounded bg-gray-100 flex items-center justify-center">
              <Bot size={20} className="text-gray-700" />
            </div>
          </div>
        </div>

        {/* Sort filter warning */}
        {sortFilterWarning && (
          <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded p-3 text-xs text-amber-800 font-semibold">
            <span>Сортировка доступна только при сброшенных фильтрах. Сбросьте поиск и тип, чтобы изменить порядок правил.</span>
            <button onClick={() => setSortFilterWarning(false)} className="ml-3 text-amber-600 hover:text-amber-800">
              <X size={14} />
            </button>
          </div>
        )}

        {/* Search and Filters */}
        <div className="bg-white rounded border border-gray-200 p-4 flex flex-col md:flex-row gap-4 justify-between items-center shadow-sm">
          <div className="relative w-full md:w-80">
            <input
              type="text"
              placeholder="Поиск по значению или категории..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-gray-50 hover:bg-gray-100/70 focus:bg-white border border-gray-200 rounded pl-3 pr-8 py-2 text-xs text-gray-700 outline-hidden focus:border-black transition duration-200"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600 text-xs"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="flex gap-2 w-full md:w-auto overflow-x-auto">
            <span className="text-xs text-gray-400 font-semibold self-center hidden md:inline">Тип:</span>
            {["ALL", "INN", "KEYWORD", "AMOUNT_RANGE", "TREASURY_ACCOUNT"].map((type) => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`text-xs font-semibold py-1.5 px-3 rounded border transition duration-200 whitespace-nowrap ${
                  filterType === type
                    ? "bg-gray-800 border-gray-800 text-white"
                    : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
              >
                {type === "ALL" ? "Все" : TYPE_LABELS[type]?.label || type}
              </button>
            ))}
          </div>
        </div>

        {/* Rules Table */}
        <div className="bg-white rounded border border-gray-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  <th className="py-3 px-5">Тип сопоставления</th>
                  <th className="py-3 px-5">Искомый шаблон / Значение</th>
                  <th className="py-3 px-5">Категория (Document Type)</th>
                  <th className="py-3 px-4">Направление</th>
                  <th className="py-3 px-5">Источник</th>
                  <th className="py-3 px-5">Дата создания</th>
                  <th className="py-3 px-5 text-right">Действия</th>
                </tr>
              </thead>
              <tbody className="text-xs text-gray-700 divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-gray-400 font-medium">
                      <div className="flex justify-center items-center gap-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-300"></div>
                        Загрузка правил...
                      </div>
                    </td>
                  </tr>
                ) : filteredRules.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-16 text-center text-gray-400 space-y-2">
                      <div className="text-3xl">⚙️</div>
                      {rules.length === 0 ? (
                        <>
                          <div className="font-semibold text-gray-700">Правил пока нет</div>
                          <div className="text-[11px] text-gray-400 max-w-sm mx-auto">
                            Настройте новое правило классификации, чтобы операции автоматически сопоставлялись при импорте.
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="font-semibold text-gray-700">Ничего не найдено</div>
                          <div className="text-[11px] text-gray-400 max-w-sm mx-auto">
                            Ни одно правило не соответствует выбранным фильтрам.
                          </div>
                        </>
                      )}
                    </td>
                  </tr>
                ) : (
                  filteredRules.map((rule) => {
                    const typeStyle = TYPE_LABELS[rule.matchType] || {
                      label: rule.matchType,
                      bg: "bg-gray-50 border-gray-100",
                      text: "text-gray-700",
                    };
                    const srcStyle = SOURCE_LABELS[rule.createdFrom] || {
                      label: rule.createdFrom,
                      bg: "bg-gray-50 border-gray-100",
                      text: "text-gray-700",
                    };

                    return (
                      <tr key={rule.id} className="hover:bg-gray-50/50 transition duration-150">
                        <td className="py-3.5 px-5">
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-semibold border ${typeStyle.bg} ${typeStyle.text}`}
                          >
                            {typeStyle.label}
                          </span>
                        </td>
                        <td className="py-3.5 px-5 font-mono text-gray-900 font-semibold max-w-[280px] truncate">
                          {rule.matchValue}
                        </td>
                        <td className="py-3.5 px-5 font-medium">
                          <div className="text-gray-800">{rule.documentType.name}</div>
                          <div className="text-[10px] text-gray-400 uppercase font-mono mt-0.5">
                            {rule.documentType.code}
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          {rule.direction ? (
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${rule.direction === "CREDIT" ? "bg-green-50 border-green-200 text-green-700" : "bg-rose-50 border-rose-200 text-rose-700"}`}>
                              {rule.direction === "CREDIT" ? "Вход" : "Выход"}
                            </span>
                          ) : (
                            <span className="text-[10px] text-gray-300">—</span>
                          )}
                        </td>
                        <td className="py-3.5 px-5">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${srcStyle.bg} ${srcStyle.text}`}
                          >
                            {srcStyle.label}
                          </span>
                        </td>
                        <td className="py-3.5 px-5 text-gray-400 font-medium">
                          {formatDate(rule.createdAt)}
                        </td>
                        <td className="py-3.5 px-5 text-right space-x-1 whitespace-nowrap">
                          {filterType === "ALL" && !searchTerm && (
                            <>
                              <button
                                onClick={() => moveRule(rules.findIndex(r => r.id === rule.id), "up")}
                                disabled={rules.findIndex(r => r.id === rule.id) === 0 || reordering}
                                className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                                title="Вверх"
                              >
                                ↑
                              </button>
                              <button
                                onClick={() => moveRule(rules.findIndex(r => r.id === rule.id), "down")}
                                disabled={rules.findIndex(r => r.id === rule.id) === rules.length - 1 || reordering}
                                className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                                title="Вниз"
                              >
                                ↓
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => openEditModal(rule)}
                            title="Редактировать"
                            className="p-1.5 rounded-md hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => { setDeleteRuleTarget(rule); setDeleteError(""); }}
                            title="Удалить"
                            className="p-1.5 rounded-md hover:bg-rose-50 text-gray-400 hover:text-rose-600 transition"
                          >
                            <Trash2 size={14} />
                          </button>
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

      {/* Delete rule confirm modal */}
      {deleteRuleTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded border border-gray-200 shadow-xl max-w-sm w-full p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle size={16} className="text-rose-500 shrink-0 mt-0.5" />
                <h3 className="text-sm font-bold text-gray-900">Удалить правило?</h3>
              </div>
              <button onClick={() => setDeleteRuleTarget(null)} className="text-gray-400 hover:text-gray-600 p-1">
                <X size={16} />
              </button>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-700">{deleteRuleTarget.matchValue}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">→ {deleteRuleTarget.documentType.name}</p>
            </div>
            <p className="text-xs text-gray-600">Правило будет удалено. Новые транзакции по этому контрагенту нужно будет классифицировать вручную.</p>
            {deleteError && (
              <div className="p-2 bg-rose-50 border border-rose-200 rounded text-xs text-rose-700 font-semibold">
                {deleteError}
              </div>
            )}
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setDeleteRuleTarget(null)}
                disabled={deleteLoading}
                className="flex-1 text-xs border border-gray-200 text-gray-700 font-bold py-2.5 rounded hover:bg-gray-50 transition"
              >
                Отмена
              </button>
              <button
                onClick={handleDeleteConfirmed}
                disabled={deleteLoading}
                className="flex-1 text-xs bg-rose-600 hover:bg-rose-700 text-white font-bold py-2.5 rounded transition disabled:opacity-50"
              >
                {deleteLoading ? "Удаляем..." : "Удалить"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Elegant Form Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded shadow-xl border border-gray-200 w-full max-w-lg overflow-hidden transform transition duration-300 scale-100">
            {/* Modal Header */}
            <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-sm font-bold text-gray-800">
                {editingRule ? "Редактирование правила" : "Добавить новое правило"}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-sm p-1 rounded-md"
              >
                <X size={14} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSave} className="p-6 space-y-4">
              {modalError && (
                <div className="p-3 bg-rose-50 border border-rose-100 rounded text-rose-700 text-xs font-semibold">
                  <AlertTriangle size={13} className="inline mr-1.5" />{modalError}
                </div>
              )}

              {/* Match Type */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-500">Тип сопоставления</label>
                <select
                  value={formType}
                  onChange={(e) => setFormType(e.target.value as Rule["matchType"])}
                  className="w-full bg-white border border-gray-200 rounded px-3 py-2 text-xs text-gray-700 outline-hidden focus:border-black"
                >
                  <option value="INN">ИНН контрагента</option>
                  <option value="KEYWORD">Ключевое слово</option>
                  <option value="AMOUNT_RANGE">Диапазон сумм</option>
                  <option value="TREASURY_ACCOUNT">Казначейский счёт</option>
                </select>
                <p className="text-[10px] text-gray-400 font-medium">
                  {TYPE_LABELS[formType]?.desc}
                </p>
              </div>

              {/* Match Value */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-500">Шаблон поиска / Искомое значение</label>
                <input
                  type="text"
                  value={formValue}
                  onChange={(e) => setFormValue(e.target.value)}
                  placeholder={
                    formType === "INN"
                      ? "Например: 301234567"
                      : formType === "AMOUNT_RANGE"
                      ? "Например: 500000 - 1500000"
                      : "Например: Аренда помещения"
                  }
                  className="w-full bg-white border border-gray-200 rounded px-3 py-2 text-xs text-gray-700 outline-hidden focus:border-black"
                  required
                />
              </div>

              {/* Direction filter */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-500">Направление (опционально)</label>
                <select
                  value={formDirection}
                  onChange={(e) => setFormDirection(e.target.value as "" | "DEBIT" | "CREDIT")}
                  className="w-full bg-white border border-gray-200 rounded px-3 py-2 text-xs text-gray-700 outline-hidden focus:border-black"
                >
                  <option value="">Любое (входящие и исходящие)</option>
                  <option value="CREDIT">Только входящие (CREDIT)</option>
                  <option value="DEBIT">Только исходящие (DEBIT)</option>
                </select>
                <p className="text-[10px] text-gray-400 font-medium">
                  Если задано, правило сработает только для операций нужного направления
                </p>
              </div>

              {/* Document Type Category */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-500">Назначить категорию операции</label>
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded px-3 py-2 text-xs text-gray-700 outline-hidden focus:border-black"
                  required
                >
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name} ({cat.code})
                    </option>
                  ))}
                </select>
              </div>

              {/* Footer Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold py-2 px-4 rounded transition duration-150"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="bg-black hover:opacity-80 text-white text-xs font-bold py-2 px-5 rounded transition duration-150 shadow-sm"
                >
                  Сохранить
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk-apply modal: shown after creating a new rule if unclassified transactions match */}
      {bulkApply && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-gray-200 shadow-xl w-full max-w-lg rounded p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <Zap size={16} className="text-amber-500 shrink-0" />
                <h3 className="text-sm font-bold text-gray-900">Применить правило к похожим операциям?</h3>
              </div>
              <button onClick={() => { setBulkApply(null); setBulkSelected(new Set()); }} className="text-gray-400 hover:text-gray-600 p-1">
                <X size={14} />
              </button>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">
              Найдено <strong className="text-gray-800">{bulkApply.transactions.length}</strong> необработанных операций с{" "}
              {bulkApply.matchType === "INN" ? `ИНН «${bulkApply.matchValue}»` : `ключевым словом «${bulkApply.matchValue}»`}.
              Отметьте те, к которым применить правило прямо сейчас.
            </p>

            <div className="border border-gray-200 rounded overflow-hidden max-h-56 overflow-y-auto">
              <table className="w-full text-left text-[11px]">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                    <th className="p-2 w-8">
                      <input
                        type="checkbox"
                        checked={bulkSelected.size === bulkApply.transactions.length}
                        onChange={e => {
                          if (e.target.checked) setBulkSelected(new Set(bulkApply.transactions.map(t => t.id)));
                          else setBulkSelected(new Set());
                        }}
                        className="rounded"
                      />
                    </th>
                    <th className="p-2">Дата</th>
                    <th className="p-2">Сумма</th>
                    <th className="p-2">Описание</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-medium">
                  {bulkApply.transactions.map(tx => (
                    <tr key={tx.id} className="hover:bg-gray-50/50">
                      <td className="p-2">
                        <input
                          type="checkbox"
                          checked={bulkSelected.has(tx.id)}
                          onChange={e => {
                            const next = new Set(bulkSelected);
                            e.target.checked ? next.add(tx.id) : next.delete(tx.id);
                            setBulkSelected(next);
                          }}
                          className="rounded"
                        />
                      </td>
                      <td className="p-2 text-gray-500 whitespace-nowrap">{tx.date}</td>
                      <td className={`p-2 font-mono whitespace-nowrap ${tx.direction === "CREDIT" ? "text-green-700" : "text-rose-700"}`}>
                        {tx.direction === "CREDIT" ? "+" : "−"}{Number(tx.amount).toLocaleString("ru")}
                      </td>
                      <td className="p-2 text-gray-600 max-w-[180px] truncate" title={tx.description}>
                        {tx.counterpartyHint || tx.description}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-3 pt-1">
              <button
                onClick={() => { setBulkApply(null); setBulkSelected(new Set()); }}
                disabled={bulkApplying}
                className="text-xs border border-gray-200 text-gray-700 font-medium py-2 px-4 rounded hover:bg-gray-50 transition"
              >
                Пропустить
              </button>
              <button
                onClick={handleBulkApply}
                disabled={bulkApplying || bulkSelected.size === 0}
                className="text-xs bg-black text-white font-bold py-2 px-5 rounded hover:opacity-80 transition disabled:opacity-40"
              >
                {bulkApplying ? "Применяем..." : `Применить к ${bulkSelected.size} операциям`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Save } from "lucide-react";

interface ITaxDeadlineTemplate {
  id: string;
  type: string;
  dayOfMonth: number;
  frequency: "MONTHLY" | "QUARTERLY" | "ANNUALLY";
  taxRegime: string | null;
  isActive: boolean;
}

const TAX_TYPES = [
  { value: "VAT", label: "НДС (Налог на добавленную стоимость)" },
  { value: "TURNOVER_TAX", label: "Налог с оборота" },
  { value: "PROFIT_TAX", label: "Налог на прибыль" },
  { value: "PERSONAL_INCOME_TAX", label: "НДФЛ (Налог на доходы физических лиц)" },
  { value: "SOCIAL_TAX", label: "Социальный налог" },
  { value: "STATISTICS", label: "Статистическая отчётность" },
];

const FREQUENCIES = [
  { value: "MONTHLY", label: "Ежемесячно" },
  { value: "QUARTERLY", label: "Ежеквартально" },
  { value: "ANNUALLY", label: "Ежегодно" },
];

export default function TaxCalendarSettingsPage() {
  const [templates, setTemplates] = useState<ITaxDeadlineTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Create Form State
  const [showCreate, setShowCreate] = useState(false);
  const [newType, setNewType] = useState("VAT");
  const [newDay, setNewDay] = useState(20);
  const [newFreq, setNewFreq] = useState("MONTHLY");

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const res = await fetch("/v2/api/settings/tax-deadlines");
      const data = await res.json();
      setTemplates(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (id: string, field: string, value: any) => {
    const template = templates.find((t) => t.id === id);
    if (!template) return;

    const updated = { ...template, [field]: value };
    setTemplates(templates.map((t) => (t.id === id ? updated : t)));

    try {
      await fetch("/v2/api/settings/tax-deadlines", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updated),
      });
    } catch (err) {
      console.error(err);
      loadTemplates(); // Revert on failure
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetch("/v2/api/settings/tax-deadlines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: newType,
          dayOfMonth: newDay,
          frequency: newFreq,
          isActive: true,
        }),
      });
      setShowCreate(false);
      loadTemplates();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Удалить это правило календаря?")) return;
    try {
      await fetch(`/v2/api/settings/tax-deadlines?id=${id}`, { method: "DELETE" });
      setTemplates(templates.filter(t => t.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex justify-between items-start md:items-center flex-col md:flex-row gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Налоговый календарь</h1>
          <p className="text-gray-500 mt-1">
            Настройка шаблонов сроков сдачи отчётности и уплаты налогов
          </p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 text-sm font-medium py-2 px-4 rounded transition-colors flex items-center gap-2 shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Добавить правило
        </button>
      </div>

      {showCreate && (
        <div className="bg-gray-100 border border-gray-300 rounded p-6 animate-fade-in">
          <h3 className="font-semibold text-black mb-4">Новое правило календаря</h3>
          <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div>
              <label className="block text-xs font-medium text-black mb-1">Тип события</label>
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded outline-none focus:ring-2 focus:ring-black text-sm"
              >
                {TAX_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-black mb-1">Периодичность</label>
              <select
                value={newFreq}
                onChange={(e) => setNewFreq(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded outline-none focus:ring-2 focus:ring-black text-sm"
              >
                {FREQUENCIES.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-black mb-1">Число месяца</label>
              <input
                type="number"
                min="1"
                max="31"
                value={newDay}
                onChange={(e) => setNewDay(parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded outline-none focus:ring-2 focus:ring-black text-sm"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                className="flex-1 bg-black text-white font-medium py-2 px-4 rounded hover:opacity-80 transition-opacity text-sm"
              >
                Сохранить
              </button>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="px-3 py-2 text-black hover:bg-gray-100 rounded text-sm font-medium"
              >
                Отмена
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="py-12 flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-300"></div>
          </div>
        ) : templates.length === 0 ? (
          <div className="py-12 text-center text-gray-500">
            Нет настроенных шаблонов налогового календаря. Добавьте новые правила выше.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  <th className="py-3 px-6">Событие / Налог</th>
                  <th className="py-3 px-6">Периодичность</th>
                  <th className="py-3 px-6">Срок (число)</th>
                  <th className="py-3 px-6 text-center">Статус</th>
                  <th className="py-3 px-6 text-right">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {templates.map((template) => (
                  <tr key={template.id} className="hover:bg-gray-50">
                    <td className="py-4 px-6 font-medium text-gray-900">
                      {TAX_TYPES.find((t) => t.value === template.type)?.label || template.type}
                      {template.taxRegime && (
                        <span className="ml-2 text-[10px] bg-gray-100 text-black px-2 py-0.5 rounded-full border border-gray-300 uppercase">
                          {template.taxRegime}
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-6">
                      <select
                        value={template.frequency}
                        onChange={(e) => handleUpdate(template.id, "frequency", e.target.value)}
                        className="bg-transparent border-none text-gray-600 outline-none hover:text-gray-900 cursor-pointer text-sm"
                      >
                        {FREQUENCIES.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                      </select>
                    </td>
                    <td className="py-4 px-6">
                      <input
                        type="number"
                        min="1"
                        max="31"
                        value={template.dayOfMonth}
                        onChange={(e) => handleUpdate(template.id, "dayOfMonth", parseInt(e.target.value))}
                        className="w-16 px-2 py-1 border border-gray-200 rounded text-center text-gray-900 focus:border-black outline-none text-sm"
                      />
                    </td>
                    <td className="py-4 px-6 text-center">
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox" 
                          className="sr-only peer" 
                          checked={template.isActive}
                          onChange={(e) => handleUpdate(template.id, "isActive", e.target.checked)}
                        />
                        <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-black"></div>
                      </label>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <button
                        onClick={() => handleDelete(template.id)}
                        className="text-gray-400 hover:text-red-600 transition-colors p-1"
                        title="Удалить"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

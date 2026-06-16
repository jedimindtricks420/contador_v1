"use client";

import { useEffect, useState } from "react";
import { Save } from "lucide-react";

export default function OpenItemsDeadlinesPage() {
  const [deadlines, setDeadlines] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetch("/v2/api/settings/open-item-deadlines")
      .then((res) => res.json())
      .then((data) => {
        setDeadlines(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccess(false);

    try {
      await fetch("/v2/api/settings/open-item-deadlines", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(deadlines),
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const updateDeadline = (code: string, days: number) => {
    setDeadlines({ ...deadlines, [code]: days });
  };

  const items = [
    { code: "6310", label: "Авансы полученные" },
    { code: "4310", label: "Авансы выданные" },
    { code: "4220", label: "Подотчетные суммы" },
    { code: "5110_UNIDENTIFIED", label: "Невыясненные поступления" },
  ];

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-300"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Сроки риска для открытых позиций</h1>
        <p className="text-gray-500 mt-1">
          Настройка количества дней, после которых открытая позиция помечается статусом риска.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
            {items.map((item) => (
              <div key={item.code} className="flex flex-col space-y-2">
                <label className="text-sm font-medium text-gray-700">{item.label}</label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min="1"
                    max="3650"
                    value={deadlines[item.code] || 0}
                    onChange={(e) => updateDeadline(item.code, parseInt(e.target.value))}
                    className="w-24 px-3 py-2 border border-gray-300 rounded outline-none focus:ring-2 focus:ring-black text-center"
                  />
                  <span className="text-sm text-gray-500">дней</span>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="bg-black hover:opacity-80 text-white font-medium py-2.5 px-6 rounded transition-colors flex items-center gap-2 disabled:opacity-70"
          >
            {saving ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            ) : (
              <Save className="w-4 h-4" />
            )}
            {success ? "Сохранено!" : "Сохранить"}
          </button>
        </div>
      </form>
    </div>
  );
}

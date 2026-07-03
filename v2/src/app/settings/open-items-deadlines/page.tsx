"use client";

import { useEffect, useState } from "react";
import { Save, AlertCircle } from "lucide-react";

interface BufferAccount {
  code: string;
  name: string;
  days: number;
}

export default function OpenItemsDeadlinesPage() {
  const [accounts, setAccounts] = useState<BufferAccount[]>([]);
  const [deadlines, setDeadlines] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const loadAccounts = () => {
    setLoading(true);
    setLoadError(null);
    fetch("/v2/api/settings/open-item-deadlines")
      .then((res) => res.json())
      .then((data) => {
        const list: BufferAccount[] = data.accounts || [];
        setAccounts(list);
        setDeadlines(Object.fromEntries(list.map((a) => [a.code, a.days])));
      })
      .catch((err) => {
        console.error(err);
        setLoadError("Не удалось загрузить список буферных счетов");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadAccounts();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccess(false);
    setSaveError(null);

    try {
      const res = await fetch("/v2/api/settings/open-item-deadlines", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(deadlines),
      });
      if (res.ok) {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      } else {
        const err = await res.json();
        setSaveError(err.error || "Ошибка сохранения");
      }
    } catch (err) {
      console.error(err);
      setSaveError("Ошибка сети. Попробуйте снова.");
    } finally {
      setSaving(false);
    }
  };

  const updateDeadline = (code: string, days: number) => {
    setDeadlines({ ...deadlines, [code]: days });
  };

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
          Список буферных счетов и значения по умолчанию берутся напрямую из движка проводок —
          новые типы документов с open-item попадают сюда автоматически.
        </p>
      </div>

      {loadError && (
        <div className="flex items-start gap-2 p-3 bg-rose-50 border border-rose-200 rounded text-xs text-rose-800 font-semibold">
          <AlertCircle size={13} className="shrink-0 mt-0.5" />
          {loadError}
          <button onClick={loadAccounts} className="ml-auto underline">Повторить</button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6">
          {accounts.length === 0 ? (
            <p className="text-sm text-gray-400 italic">Буферные счета не найдены.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
              {accounts.map((item) => (
                <div key={item.code} className="flex flex-col space-y-2">
                  <label className="text-sm font-medium text-gray-700">
                    {item.name} <span className="text-gray-400 font-normal">({item.code})</span>
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min="1"
                      max="3650"
                      value={deadlines[item.code] ?? item.days}
                      onChange={(e) => updateDeadline(item.code, parseInt(e.target.value) || 0)}
                      className="w-24 px-3 py-2 border border-gray-300 rounded outline-none focus:ring-2 focus:ring-black text-center"
                    />
                    <span className="text-sm text-gray-500">дней</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {saveError && (
          <div className="px-6 py-3 bg-rose-50 border-t border-rose-200 text-xs text-rose-800 font-semibold">
            {saveError}
          </div>
        )}

        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end">
          <button
            type="submit"
            disabled={saving || accounts.length === 0}
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

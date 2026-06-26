"use client";

import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { ACTIVITY_CATEGORIES } from "@/lib/activityCategories";

interface OrgSettings {
  name: string;
  inn: string | null;
  taxRegime: "VAT" | "TURNOVER_TAX";
  isVatPayer: boolean;
  activityGroup: string | null;
  activityDescription: string | null;
  activityCustom: string | null;
  aiConfidenceThreshold: number;
  maxClarificationQuestions: number;
  turnoverTaxRate: number;
}

export default function OrgSettingsPage() {
  const [settings, setSettings] = useState<OrgSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetch("/v2/api/settings/org")
      .then((res) => res.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setSettings({ ...data, turnoverTaxRate: data.turnoverTaxRate ?? 0.04 });
        setLoading(false);
      })
      .catch((err) => {
        setError("Failed to load settings");
        setLoading(false);
      });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const res = await fetch("/v2/api/settings/org", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });

      if (res.ok) {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      } else {
        const data = await res.json();
        setError(data.error || "Failed to save settings");
      }
    } catch (err) {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-300"></div>
      </div>
    );
  }

  if (!settings) return null;

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Настройки организации</h1>
        <p className="text-gray-500 mt-1">
          Управление основными параметрами вашей компании и настройками ИИ-ассистента
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8 bg-white p-8 rounded shadow-sm border border-gray-200">
        
        {/* Basic Info */}
        <div className="space-y-6">
          <h2 className="text-lg font-semibold text-gray-900 border-b border-gray-100 pb-2">Основные данные</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Название организации</label>
              <input
                type="text"
                value={settings.name || ""}
                onChange={(e) => setSettings({ ...settings, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded outline-none focus:ring-2 focus:ring-black"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ИНН (9 цифр)</label>
              <input
                type="text"
                value={settings.inn || ""}
                onChange={(e) => setSettings({ ...settings, inn: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded outline-none focus:ring-2 focus:ring-black"
                pattern="[0-9]{9}"
                title="ИНН должен состоять из 9 цифр"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Вид деятельности</label>
            <p className="text-xs text-gray-500 mb-2">
              Помогает ИИ точнее классифицировать транзакции — он будет понимать, что типично для вашего бизнеса.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <select
                value={settings.activityGroup || ""}
                onChange={(e) => {
                  const group = e.target.value;
                  setSettings({ ...settings, activityGroup: group, activityDescription: "", activityCustom: "" });
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded outline-none focus:ring-2 focus:ring-black bg-white"
              >
                <option value="">— Выберите группу —</option>
                {ACTIVITY_CATEGORIES.map((cat) => (
                  <option key={cat.group} value={cat.group}>{cat.group}</option>
                ))}
              </select>

              {settings.activityGroup && (
                <select
                  value={settings.activityDescription || ""}
                  onChange={(e) => setSettings({ ...settings, activityDescription: e.target.value, activityCustom: "" })}
                  className="w-full px-3 py-2 border border-gray-300 rounded outline-none focus:ring-2 focus:ring-black bg-white"
                >
                  <option value="">— Выберите вид деятельности —</option>
                  {ACTIVITY_CATEGORIES.find((c) => c.group === settings.activityGroup)?.items.map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
              )}
            </div>

            {settings.activityDescription === "Другое (укажу вручную)" && (
              <input
                type="text"
                value={settings.activityCustom || ""}
                onChange={(e) => setSettings({ ...settings, activityCustom: e.target.value })}
                placeholder="Опишите вид деятельности своими словами..."
                className="mt-3 w-full px-3 py-2 border border-gray-300 rounded outline-none focus:ring-2 focus:ring-black"
              />
            )}

            {(settings.activityDescription && settings.activityDescription !== "Другое (укажу вручную)") && (
              <p className="mt-2 text-xs text-green-700 bg-green-50 px-3 py-1.5 rounded border border-green-100">
                ИИ будет учитывать: <strong>{settings.activityDescription}</strong>
              </p>
            )}
            {settings.activityDescription === "Другое (укажу вручную)" && settings.activityCustom && (
              <p className="mt-2 text-xs text-green-700 bg-green-50 px-3 py-1.5 rounded border border-green-100">
                ИИ будет учитывать: <strong>{settings.activityCustom}</strong>
              </p>
            )}
          </div>
        </div>

        {/* Taxes */}
        <div className="space-y-6">
          <h2 className="text-lg font-semibold text-gray-900 border-b border-gray-100 pb-2">Налогообложение</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Налоговый режим</label>
              <select
                value={settings.taxRegime}
                onChange={(e) => setSettings({ ...settings, taxRegime: e.target.value as "VAT" | "TURNOVER_TAX" })}
                className="w-full px-3 py-2 border border-gray-300 rounded outline-none focus:ring-2 focus:ring-black"
              >
                <option value="TURNOVER_TAX">Налог с оборота (УСН)</option>
                <option value="VAT">Общеустановленный (НДС + Налог на прибыль)</option>
              </select>
            </div>
            <div className="flex items-center mt-6">
              <label className="flex items-center cursor-pointer gap-3">
                <input
                  type="checkbox"
                  checked={settings.isVatPayer}
                  onChange={(e) => setSettings({ ...settings, isVatPayer: e.target.checked })}
                  className="w-5 h-5 text-black border-gray-300 rounded focus:ring-black"
                />
                <span className="text-sm font-medium text-gray-700">Плательщик НДС</span>
              </label>
            </div>
          </div>

          {settings.taxRegime === "TURNOVER_TAX" && (
            <div className="max-w-xs">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Ставка налога с оборота ({Math.round((settings.turnoverTaxRate ?? 0.04) * 100)}%)
              </label>
              <p className="text-[11px] text-gray-500 mb-2">От 1% до 4% — зависит от вида деятельности.</p>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="1"
                  max="4"
                  step="1"
                  value={Math.round((settings.turnoverTaxRate ?? 0.04) * 100)}
                  onChange={(e) => {
                    const pct = Math.max(1, Math.min(4, parseInt(e.target.value) || 4));
                    setSettings({ ...settings, turnoverTaxRate: pct / 100 });
                  }}
                  className="w-20 px-3 py-2 border border-gray-300 rounded outline-none focus:ring-2 focus:ring-black text-center font-semibold"
                />
                <span className="text-sm text-gray-600 font-medium">%</span>
              </div>
            </div>
          )}
        </div>

        {/* AI Settings */}
        <div className="space-y-6">
          <h2 className="text-lg font-semibold text-gray-900 border-b border-gray-100 pb-2">Настройки ИИ-ассистента</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Порог уверенности ИИ ({settings.aiConfidenceThreshold}%)
              </label>
              <p className="text-[11px] text-gray-500 mb-2">Операции с уверенностью ИИ ниже этого порога будут отправляться в ручной разбор.</p>
              <input
                type="range"
                min="0"
                max="100"
                value={settings.aiConfidenceThreshold || 70}
                onChange={(e) => setSettings({ ...settings, aiConfidenceThreshold: parseInt(e.target.value) })}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Лимит вопросов от ИИ (за сессию закрытия)
              </label>
              <p className="text-[11px] text-gray-500 mb-2">Максимальное количество уточняющих вопросов, которое задаст ИИ.</p>
              <input
                type="number"
                min="0"
                max="50"
                value={settings.maxClarificationQuestions || 10}
                onChange={(e) => setSettings({ ...settings, maxClarificationQuestions: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded outline-none focus:ring-2 focus:ring-black"
              />
            </div>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-50 text-red-700 rounded border border-red-100">
            {error}
          </div>
        )}

        <div className="pt-4 flex justify-end">
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
            {success ? "Сохранено!" : "Сохранить настройки"}
          </button>
        </div>
      </form>
    </div>
  );
}

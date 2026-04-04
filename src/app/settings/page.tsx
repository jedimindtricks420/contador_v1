"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Lock, Save, Loader2, AlertCircle } from "lucide-react";

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const [closedDate, setClosedDate] = useState("");
  const [openingDate, setOpeningDate] = useState("");
  const [isFixed, setIsFixed] = useState(false);

  const { data: settings, isLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: () => fetch("/api/settings").then((res) => res.json()),
  });

  useEffect(() => {
    if (settings?.closed_period_date) {
      setClosedDate(new Date(settings.closed_period_date).toISOString().split("T")[0]);
    }
    if (settings?.opening_balance_date) {
      setOpeningDate(new Date(settings.opening_balance_date).toISOString().split("T")[0]);
    }
    if (settings?.is_initial_balance_fixed !== undefined) {
      setIsFixed(settings.is_initial_balance_fixed);
    }
  }, [settings]);

  const updateSettings = useMutation({
    mutationFn: (vals: { closed_period_date?: string, opening_balance_date?: string, is_initial_balance_fixed?: boolean }) =>
      fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(vals),
      }).then((res) => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      alert("Настройки сохранены");
    },
  });

  return (
    <div className="max-w-2xl space-y-10">
      <header>
        <h2 className="text-xl font-bold text-gray-900">Настройки системы</h2>
        <p className="text-sm text-gray-500 mt-1">Управление глобальными параметрами учета и безопасности.</p>
      </header>

      <div className="bg-white border border-gray-200 rounded-lg shadow-sm divide-y divide-gray-100">
        {/* Closed Period Section */}
        <div className="p-8 space-y-6">
          <div className="flex items-start space-x-4">
            <div className="w-10 h-10 rounded bg-gray-50 flex items-center justify-center text-gray-400">
              <Lock size={20} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-widest">Закрытие периода</h3>
              <p className="text-xs text-gray-500 mt-1 max-w-sm leading-relaxed">
                Запрещает создание, редактирование и удаление проводок до указанной даты включительно. Это необходимо для фиксации отчетности.
              </p>
            </div>
          </div>

          <div className="pl-14 space-y-4">
            <div className="flex items-center space-x-4">
              <input 
                type="date" 
                value={closedDate}
                onChange={(e) => setClosedDate(e.target.value)}
                className="border border-gray-200 rounded px-4 py-2 text-sm font-bold focus:ring-1 focus:ring-black outline-none"
              />
              <button 
                onClick={() => updateSettings.mutate({ closed_period_date: closedDate })}
                disabled={updateSettings.isPending || !closedDate}
                className="bg-black text-white px-6 py-2 rounded text-sm font-bold flex items-center space-x-2 transition-opacity hover:opacity-80 disabled:bg-gray-200"
              >
                {updateSettings.isPending ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                <span>Сохранить изменения</span>
              </button>
            </div>
            
            <div className="bg-gray-50 border border-gray-100 p-4 rounded-lg flex items-start space-x-3">
              <AlertCircle size={16} className="text-gray-400 mt-0.5" />
              <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide leading-normal">
                Внимание: Изменение даты закрытия периода повлияет на возможность редактирования исторических данных.
              </p>
            </div>
          </div>
        </div>

        {/* Opening Balance Section */}
        <div className="p-8 space-y-6">
          <div className="flex items-start space-x-4">
            <div className="w-10 h-10 rounded bg-gray-50 flex items-center justify-center text-gray-400">
              <span className="font-bold text-xs">0000</span>
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-widest">Ввод начальных остатков</h3>
              <p className="text-xs text-gray-500 mt-1 max-w-sm leading-relaxed">
                Укажите дату первого дня учета. Все записи по техническому счету 0000 должны быть привязаны к этой дате.
              </p>
            </div>
          </div>

          <div className="pl-14 space-y-4">
            <div className="flex items-center space-x-4">
              <input 
                type="date" 
                value={openingDate}
                onChange={(e) => setOpeningDate(e.target.value)}
                className="border border-gray-200 rounded px-4 py-2 text-sm font-bold focus:ring-1 focus:ring-black outline-none"
              />
              <button 
                onClick={() => updateSettings.mutate({ opening_balance_date: openingDate })}
                disabled={updateSettings.isPending || !openingDate}
                className="bg-black text-white px-6 py-2 rounded text-sm font-bold flex items-center space-x-2 transition-opacity hover:opacity-80 disabled:bg-gray-200"
              >
                {updateSettings.isPending ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                <span>Установить дату</span>
              </button>
            </div>
          </div>
        </div>

        {/* OpenAI API Key Section (MYAPI only) */}
        {settings?.organization?.subscription?.plan === 'MYAPI' && (
          <div className="p-8 space-y-6">
            <div className="flex items-start space-x-4">
              <div className="w-10 h-10 rounded bg-gray-50 flex items-center justify-center text-gray-400">
                <span className="font-bold text-xs">AI</span>
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-widest">OpenAI API Key (BYOK)</h3>
                <p className="text-xs text-gray-500 mt-1 max-w-sm leading-relaxed">
                  Ваш личный ключ будет использоваться для всех запросов к ИИ. Лимиты Contador на этот тариф не распространяются.
                </p>
              </div>
            </div>

            <div className="pl-14 space-y-4">
              <div className="flex items-center space-x-4">
                <input 
                  type="password" 
                  placeholder="sk-..."
                  defaultValue={settings?.organization?.subscription?.custom_api_key || ""}
                  onBlur={(e) => {
                    if (e.target.value !== settings?.organization?.subscription?.custom_api_key) {
                      updateSettings.mutate({ custom_api_key: e.target.value } as any);
                    }
                  }}
                  className="border border-gray-200 rounded px-4 py-2 text-sm font-mono w-full focus:ring-1 focus:ring-black outline-none"
                />
              </div>
            </div>
          </div>
        )}

        {/* Other Settings Placeholder */}
        <div className="p-8 flex justify-between items-center opacity-40 grayscale text-gray-400">
            <div>
                 <h3 className="text-sm font-bold uppercase tracking-widest">Резервное копирование</h3>
                 <p className="text-xs mt-1">Автоматический дамп базы данных каждые 24 часа.</p>
            </div>
            <span className="text-[10px] font-bold bg-gray-200 px-2 py-0.5 rounded tracking-widest uppercase">Активно</span>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Search, Plus, Loader2, ToggleLeft, ToggleRight, X } from "lucide-react";

// Section labels by code prefix
const SECTIONS: Record<string, string> = {
  "0": "Долгосрочные активы (0xxx)",
  "1": "Товарно-материальные запасы (1xxx)",
  "2": "Производство и готовая продукция (2xxx)",
  "3": "Расходы будущих периодов (3xxx)",
  "4": "Дебиторская задолженность (4xxx)",
  "5": "Денежные средства (5xxx)",
  "6": "Краткосрочные обязательства (6xxx)",
  "7": "Долгосрочные обязательства (7xxx)",
  "8": "Собственный капитал (8xxx)",
  "9": "Доходы и расходы (9xxx)",
  "0_off": "Забалансовые счета (001–016)",
};

function getSection(code: string): string {
  if (!code) return "Прочее";
  if (/^0\d{2}$/.test(code)) return "0_off"; // 001–016
  const first = code[0];
  return SECTIONS[first] || "Прочее";
}

export default function AccountsSettingsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [masterSearch, setMasterSearch] = useState("");
  const [toastMsg, setToastMsg] = useState("");

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(""), 3500);
  };

  // All org accounts (both active and inactive) for settings
  const { data: accounts = [], isLoading: loadingAccounts } = useQuery({
    queryKey: ["accounts-all"],
    queryFn: () => fetch("/api/accounts/all").then((r) => r.json()),
  });

  // All master accounts for the "add" block
  const { data: masterAccounts = [], isLoading: loadingMaster } = useQuery({
    queryKey: ["master-accounts"],
    queryFn: () => fetch("/api/accounts/master").then((r) => r.json()),
  });

  const toggleMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/accounts/${id}/toggle`, { method: "PATCH" }).then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error);
        return data;
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts-all"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["master-accounts"] });
    },
    onError: (e: any) => showToast(e.message),
  });

  const addMutation = useMutation({
    mutationFn: (master_account_id: string) =>
      fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ master_account_id }),
      }).then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error);
        return data;
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts-all"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["master-accounts"] });
      showToast("Счёт добавлен");
    },
    onError: (e: any) => showToast(e.message),
  });

  // Group accounts by section
  const filtered = accounts.filter(
    (a: any) =>
      a.code.includes(search) ||
      a.name.toLowerCase().includes(search.toLowerCase())
  );

  const grouped = filtered.reduce((acc: Record<string, any[]>, account: any) => {
    const section = getSection(account.code);
    if (!acc[section]) acc[section] = [];
    acc[section].push(account);
    return acc;
  }, {});

  const filteredMaster = masterAccounts.filter(
    (m: any) =>
      m.code.includes(masterSearch) ||
      m.name.toLowerCase().includes(masterSearch.toLowerCase())
  );

  return (
    <div className="max-w-4xl space-y-10">
      {/* Toast */}
      {toastMsg && (
        <div className="fixed top-4 right-4 z-50 bg-red-600 text-white px-4 py-3 rounded-lg text-sm font-medium shadow-lg">
          {toastMsg}
        </div>
      )}

      <header>
        <h2 className="text-xl font-bold text-gray-900">Настройки счетов</h2>
        <p className="text-sm text-gray-500 mt-1">
          Управляйте активными счетами организации и добавляйте новые из плана НСБУ.
        </p>
      </header>

      {/* Block 1: Active accounts */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-widest">
              Счета организации
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              Отключённые счета не отображаются в журнале, но сохраняют исторические данные.
            </p>
          </div>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Поиск по коду или названию"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-4 py-2 border border-gray-200 rounded text-xs font-medium outline-none focus:ring-1 focus:ring-black w-64"
            />
          </div>
        </div>

        {loadingAccounts ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={24} className="animate-spin text-gray-400" />
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {Object.entries(grouped).map(([section, sectionAccounts]) => (
              <div key={section}>
                <div className="px-6 py-2 bg-gray-50">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                    {SECTIONS[section] || section}
                  </p>
                </div>
                {(sectionAccounts as any[]).map((account) => (
                  <div
                    key={account.id}
                    className={`flex items-center justify-between px-6 py-3 hover:bg-gray-50 transition-colors
                      ${!account.is_active ? "opacity-50" : ""}`}
                  >
                    <div className="flex items-center space-x-3">
                      <span className="text-xs font-mono font-bold text-gray-500 w-12">{account.code}</span>
                      <span className="text-sm font-medium text-gray-800">{account.name}</span>
                      {account.is_custom && (
                        <span className="text-[10px] bg-blue-50 text-blue-600 font-bold px-1.5 py-0.5 rounded uppercase tracking-wide">
                          Кастом
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => toggleMutation.mutate(account.id)}
                      disabled={toggleMutation.isPending}
                      className="text-gray-400 hover:text-black transition-colors"
                      title={account.is_active ? "Отключить счёт" : "Включить счёт"}
                    >
                      {account.is_active
                        ? <ToggleRight size={24} className="text-black" />
                        : <ToggleLeft size={24} />
                      }
                    </button>
                  </div>
                ))}
              </div>
            ))}
            {filtered.length === 0 && (
              <p className="text-center text-sm text-gray-400 py-8">Счета не найдены</p>
            )}
          </div>
        )}
      </div>

      {/* Block 2: Add from NSBU plan */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-widest">
              Добавить из плана НСБУ
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              Счета НСБУ №21, которые ещё не добавлены в вашу организацию.
            </p>
          </div>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Поиск"
              value={masterSearch}
              onChange={(e) => setMasterSearch(e.target.value)}
              className="pl-8 pr-4 py-2 border border-gray-200 rounded text-xs font-medium outline-none focus:ring-1 focus:ring-black w-64"
            />
          </div>
        </div>

        {loadingMaster ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={24} className="animate-spin text-gray-400" />
          </div>
        ) : (
          <div className="divide-y divide-gray-50 max-h-96 overflow-y-auto">
            {filteredMaster.map((master: any) => (
              <div
                key={master.id}
                className="flex items-center justify-between px-6 py-3 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <span className="text-xs font-mono font-bold text-gray-500 w-12">{master.code}</span>
                  <span className="text-sm font-medium text-gray-800">{master.name}</span>
                </div>
                <button
                  onClick={() => addMutation.mutate(master.id)}
                  disabled={addMutation.isPending}
                  className="flex items-center space-x-1 text-xs font-bold text-gray-500 hover:text-black transition-colors px-3 py-1.5 border border-gray-200 rounded hover:border-black"
                >
                  <Plus size={12} />
                  <span>Добавить</span>
                </button>
              </div>
            ))}
            {filteredMaster.length === 0 && (
              <p className="text-center text-sm text-gray-400 py-8">
                Все счета НСБУ уже добавлены в организацию
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

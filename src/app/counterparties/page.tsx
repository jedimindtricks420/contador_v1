"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Users, Search, Loader2, Trash2 } from "lucide-react";

interface Counterparty {
  id: string;
  name: string;
  inn: string | null;
}

export default function CounterpartiesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [formData, setFormData] = useState({ name: "", inn: "" });

  const { data: counterparties, isLoading } = useQuery<Counterparty[]>({
    queryKey: ["counterparties"],
    queryFn: () => fetch("/api/counterparties").then((res) => res.json()),
  });

  const createCounterparty = useMutation({
    mutationFn: (data: any) =>
      fetch("/api/counterparties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then((res) => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["counterparties"] });
      setFormData({ name: "", inn: "" });
    },
  });

  const deleteCounterparty = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/counterparties/${id}`, { method: "DELETE" }).then(async (res) => {
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Ошибка при удалении");
        }
        return res.json();
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["counterparties"] });
    },
    onError: (error: any) => {
      alert(error.message);
    }
  });

  const filtered = counterparties?.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) || 
    c.inn?.includes(search)
  );

  return (
    <div className="space-y-8">
      <header>
        <h2 className="text-xl font-bold text-gray-900">Контрагенты</h2>
        <p className="text-sm text-gray-500 mt-1">База данных клиентов, поставщиков и партнеров компании.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Creation Form */}
        <div className="bg-white border border-gray-200 p-6 rounded-lg shadow-sm h-fit space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-widest text-gray-900 mb-2">Новый контрагент</h3>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase">Наименование</label>
            <input 
              type="text" 
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              className="w-full border-gray-200 border text-sm rounded px-3 py-2 outline-none focus:ring-1 focus:ring-black"
              placeholder="Название компании"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase">ИНН / ПИНФЛ</label>
            <input 
              type="text" 
              value={formData.inn}
              onChange={(e) => setFormData({...formData, inn: e.target.value})}
              className="w-full border-gray-200 border text-sm rounded px-3 py-2 outline-none focus:ring-1 focus:ring-black"
              placeholder="123456789"
            />
          </div>
          <button 
            onClick={() => createCounterparty.mutate(formData)}
            disabled={!formData.name || createCounterparty.isPending}
            className="w-full bg-black text-white py-2 rounded text-sm font-bold flex items-center justify-center space-x-2 disabled:bg-gray-300 transition-colors"
          >
            {createCounterparty.isPending ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />}
            <span>Добавить</span>
          </button>
        </div>

        {/* List */}
        <div className="md:col-span-2 space-y-4">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input 
              type="text" 
              placeholder="Поиск по названию или ИНН..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded text-sm outline-none focus:ring-1 focus:ring-black transition-all"
            />
          </div>

          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-6 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Контрагент</th>
                  <th className="px-6 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">ИНН</th>
                  <th className="px-6 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {isLoading ? (
                   <tr><td colSpan={3} className="py-12"><Loader2 className="animate-spin mx-auto text-gray-200" /></td></tr>
                ) : filtered?.length === 0 ? (
                  <tr><td colSpan={3} className="py-12 text-center text-xs text-gray-400 uppercase tracking-widest">Ничего не найдено</td></tr>
                ) : filtered?.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50 transition-colors group">
                    <td className="px-6 py-4 flex items-center space-x-3">
                      <div className="w-8 h-8 rounded bg-gray-100 flex items-center justify-center text-gray-400 group-hover:bg-black group-hover:text-white transition-colors">
                        <Users size={14} />
                      </div>
                      <span className="text-sm font-bold text-gray-900">{c.name}</span>
                    </td>
                    <td className="px-6 py-4 text-xs font-medium text-gray-500">{c.inn || '—'}</td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => { if(confirm(`Удалить контрагента "${c.name}"?`)) deleteCounterparty.mutate(c.id) }}
                        className="text-gray-300 hover:text-red-500 transition-colors focus:outline-none disabled:opacity-50"
                        title="Удалить"
                        disabled={deleteCounterparty.isPending}
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

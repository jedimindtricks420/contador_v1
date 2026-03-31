"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { 
  Building2, 
  Trash2, 
  Edit3, 
  Loader2, 
  AlertTriangle, 
  Check, 
  X,
  History
} from "lucide-react";

type Organization = {
  id: string;
  name: string;
  inn: string | null;
  is_active: boolean;
  onboarding_state: string;
};

export default function OrganizationsPage() {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editInn, setEditInn] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [errorHeader, setErrorHeader] = useState("");

  const { data: organizations = [], isLoading } = useQuery<Organization[]>({
    queryKey: ["organizations"],
    queryFn: () => fetch("/api/organizations").then((res) => res.json()),
  });

  const updateMutation = useMutation({
    mutationFn: (vals: { id: string, name: string, inn: string }) =>
      fetch(`/api/organizations/${vals.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: vals.name, inn: vals.inn }),
      }).then((res) => res.json().then(data => res.ok ? data : Promise.reject(data))),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
      setEditingId(null);
    },
    onError: (err: any) => setErrorHeader(err.error || "Ошибка обновления"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/organizations/${id}`, { method: "DELETE" })
      .then((res) => res.json().then(data => res.ok ? data : Promise.reject(data))),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
      setDeletingId(null);
      // Reload is needed to update session cookies or active org context globally
      window.location.reload();
    },
    onError: (err: any) => setErrorHeader(err.error || "Ошибка удаления"),
  });

  return (
    <div className="max-w-4xl space-y-10 pb-20">
      {/* Toast Error */}
      {errorHeader && (
        <div className="fixed top-4 right-4 z-50 bg-red-600 text-white px-4 py-3 rounded-lg text-sm font-medium shadow-lg flex items-center space-x-2">
            <AlertTriangle size={16} />
            <span>{errorHeader}</span>
            <button onClick={() => setErrorHeader("")}><X size={16} /></button>
        </div>
      )}

      <header>
        <h2 className="text-xl font-bold text-gray-900">Мои компании</h2>
        <p className="text-sm text-gray-500 mt-1">Управление юридическими лицами и их настройками.</p>
      </header>

      <div className="bg-white border border-gray-200 rounded-lg shadow-sm divide-y divide-gray-100 overflow-hidden">
        {isLoading ? (
          <div className="p-12 flex justify-center text-gray-400">
            <Loader2 className="animate-spin" size={24} />
          </div>
        ) : organizations.length === 0 ? (
          <div className="p-12 text-center text-sm text-gray-500 uppercase tracking-widest font-bold">
            У вас нет созданных организаций
          </div>
        ) : (
          organizations.map((org) => (
            <div key={org.id} className="p-6 transition-colors hover:bg-gray-50/50">
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-4">
                  <div className={`w-10 h-10 rounded flex items-center justify-center shrink-0 
                    ${org.is_active ? 'bg-black text-white' : 'bg-gray-50 text-gray-400 border border-gray-100'}`}>
                    <Building2 size={20} strokeWidth={1.5} />
                  </div>
                  
                  {editingId === org.id ? (
                    <div className="space-y-4">
                      <div className="space-y-3">
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="w-full sm:w-80 px-4 py-2 border border-gray-200 rounded text-sm font-bold focus:ring-1 focus:ring-black outline-none"
                          placeholder="Название организации"
                          autoFocus
                        />
                        <input
                          type="text"
                          value={editInn}
                          onChange={(e) => setEditInn(e.target.value)}
                          className="w-full sm:w-80 px-4 py-2 border border-gray-200 rounded text-sm font-medium focus:ring-1 focus:ring-black outline-none"
                          placeholder="ИНН (необязательно)"
                        />
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => updateMutation.mutate({ id: org.id, name: editName, inn: editInn })}
                          disabled={updateMutation.isPending}
                          className="bg-black text-white px-4 py-1.5 rounded text-xs font-bold flex items-center space-x-1.5 hover:opacity-80 transition-opacity disabled:bg-gray-200"
                        >
                          {updateMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                          <span>Сохранить</span>
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="px-4 py-1.5 border border-gray-200 rounded text-xs font-bold text-gray-500 hover:bg-white hover:text-black transition-all"
                        >
                          Отмена
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center space-x-3">
                        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-widest">{org.name}</h3>
                        {org.is_active && (
                          <span className="text-[10px] font-bold bg-black text-white px-1.5 py-0.5 rounded uppercase tracking-tighter animate-pulse">
                            Активна
                          </span>
                        )}
                        <span className={`text-[10px] font-bold border px-1.5 py-0.5 rounded uppercase tracking-tighter
                          ${org.onboarding_state === 'COMPLETED' ? 'text-green-600 border-green-100 bg-green-50' : 'text-orange-600 border-orange-100 bg-orange-50'}`}>
                          {org.onboarding_state === 'COMPLETED' ? 'Настроена' : 'В процессе'}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mt-1 uppercase tracking-widest font-medium">
                        ИНН: {org.inn || "не указан"}
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex items-center space-x-1">
                  {editingId !== org.id && (
                    <>
                      <button
                        onClick={() => {
                          setEditingId(org.id);
                          setEditName(org.name);
                          setEditInn(org.inn || "");
                        }}
                        className="p-2 text-gray-400 hover:text-black hover:bg-white rounded transition-all"
                        title="Редактировать"
                      >
                        <Edit3 size={18} />
                      </button>
                      
                      <button
                        onClick={() => setDeletingId(org.id)}
                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-all"
                        title="Удалить"
                      >
                        <Trash2 size={18} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Delete Confirmation Modal Overlay */}
      {deletingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white border border-gray-200 rounded-lg shadow-2xl p-8 max-w-md w-full animate-in zoom-in-95 duration-200">
            <div className="flex items-center space-x-3 text-red-600 mb-6 font-bold uppercase tracking-widest text-sm">
                <AlertTriangle />
                <span>Опасная операция</span>
            </div>
            
            <h3 className="text-lg font-bold text-gray-900 mb-2">Удалить организацию?</h3>
            <p className="text-sm text-gray-500 leading-relaxed mb-8 font-medium">
                Это действие **необратимо**. Все счета, транзакции, контрагенты и настройки данной организации будут удалены навсегда. Вы действительно хотите продолжить?
            </p>

            <div className="flex flex-col space-y-3">
              <button
                onClick={() => deleteMutation.mutate(deletingId)}
                disabled={deleteMutation.isPending}
                className="w-full bg-red-600 text-white py-3 rounded text-sm font-bold flex items-center justify-center space-x-2 hover:bg-red-700 transition-colors disabled:bg-gray-200"
              >
                {deleteMutation.isPending ? <Loader2 className="animate-spin" size={18} /> : (
                  <>
                    <Trash2 size={18} />
                    <span>Да, удалить всё навсегда</span>
                  </>
                )}
              </button>
              <button
                onClick={() => setDeletingId(null)}
                disabled={deleteMutation.isPending}
                className="w-full py-3 text-sm font-bold text-gray-400 hover:text-black transition-colors uppercase tracking-widest"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

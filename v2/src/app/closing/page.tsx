"use client";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Calendar, Lock, Archive, FileText, Trash2, X } from "lucide-react";
import ClientLayout from "@/components/Layout/ClientLayout";
import { periodLabel } from "@/lib/format";
import ClosingWizard from "./ClosingWizard";
import Step1Import from "./steps/Step1Import";

interface Period {
  id: string;
  year: number;
  month: number;
  status: string;
  mode: string;
  _count?: { stagedTransactions: number; documents: number };
}

const MONTHS = ["Январь","Февраль","Март","Апрель","Май","Июнь","Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"];

function ClosingPageContent() {
  const searchParams = useSearchParams();
  const stepParam = parseInt(searchParams.get("step") || "1") || 1;
  const createPeriodParam = searchParams.get("createPeriod"); // format YYYY-MM

  const [periods, setPeriods] = useState<Period[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<Period | null>(null);
  const [loading, setLoading] = useState(true);
  const [closureStats, setClosureStats] = useState<any | null>(null);
  const [finalizingHistorical, setFinalizingHistorical] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createYear, setCreateYear] = useState(new Date().getFullYear());
  const [createMonth, setCreateMonth] = useState(new Date().getMonth() + 1);
  const [createMode, setCreateMode] = useState<"ACTIVE" | "HISTORICAL">("ACTIVE");
  const [creating, setCreating] = useState(false);
  const [deletingPeriod, setDeletingPeriod] = useState<Period | null>(null);
  const [periodDeleteLoading, setPeriodDeleteLoading] = useState(false);
  const [reopening, setReopening] = useState(false);

  const loadPeriods = async (autoSelectId?: string) => {
    try {
      const res = await fetch("/v2/api/periods");
      const list = await res.json();
      setPeriods(list);
      if (list.length > 0) {
        if (autoSelectId) {
          const target = list.find((p: any) => p.id === autoSelectId);
          setSelectedPeriod(target || list.find((p: any) => p.status === "OPEN") || list[0]);
        } else {
          const active = list.find((p: any) => p.status === "OPEN") || list[0];
          setSelectedPeriod(active);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const res = await fetch("/v2/api/dashboard");
      const d = await res.json();
      setClosureStats(d.stats);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreatePeriod = async () => {
    setCreating(true);
    try {
      const res = await fetch("/v2/api/periods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year: createYear, month: createMonth, mode: createMode })
      });
      if (res.ok) {
        const newPeriod = await res.json();
        setShowCreateForm(false);
        await loadPeriods(newPeriod.id);
      } else {
        const err = await res.json();
        alert(`Ошибка: ${err.error}`);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setCreating(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      if (createPeriodParam) {
        const [y, m] = createPeriodParam.split("-").map(Number);
        if (y && m) {
          const res = await fetch("/v2/api/periods", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ year: y, month: m, mode: "ACTIVE" })
          });
          if (res.ok) {
            const newP = await res.json();
            await loadPeriods(newP.id);
            return;
          }
        }
      }
      loadPeriods();
    };
    init();
  }, []);

  useEffect(() => { if (selectedPeriod) loadStats(); }, [selectedPeriod]);

  const handleDeletePeriod = async () => {
    if (!deletingPeriod) return;
    setPeriodDeleteLoading(true);
    try {
      const res = await fetch(`/v2/api/periods/${deletingPeriod.id}`, { method: "DELETE" });
      if (res.ok) {
        setDeletingPeriod(null);
        setSelectedPeriod(null);
        loadPeriods();
      } else {
        const data = await res.json();
        alert(`Ошибка: ${data.error}`);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setPeriodDeleteLoading(false);
    }
  };

  const handleReopenPeriod = async () => {
    if (!selectedPeriod) return;
    if (!confirm(`Переоткрыть период ${periodLabel(selectedPeriod.year, selectedPeriod.month)}? Проводки закрытия будут удалены.`)) return;
    setReopening(true);
    try {
      const res = await fetch(`/v2/api/periods/${selectedPeriod.id}/reopen`, { method: "POST" });
      if (res.ok) {
        await loadPeriods(selectedPeriod.id);
      } else {
        const data = await res.json();
        alert(`Ошибка: ${data.error}`);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setReopening(false);
    }
  };

  const handleFinalizeHistorical = async () => {
    if (!selectedPeriod) return;
    setFinalizingHistorical(true);
    try {
      const res = await fetch(`/v2/api/closing/${selectedPeriod.id}/finalize`, { method: "POST" });
      if (res.ok) {
        alert("Исторический период успешно закрыт и архивирован!");
        loadPeriods();
      } else {
        const data = await res.json();
        alert(`Ошибка закрытия: ${data.error}`);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setFinalizingHistorical(false);
    }
  };

  if (loading) {
    return (
      <ClientLayout>
        <div className="flex flex-col items-center justify-center h-[60vh] text-gray-400">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black mb-4"></div>
          <span className="text-sm font-medium uppercase tracking-widest">Загрузка мастера закрытия...</span>
        </div>
      </ClientLayout>
    );
  }

  return (
    <ClientLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b border-gray-200">
          <div>
            <h1 className="text-xl font-bold text-gray-900 uppercase">Мастер закрытия месяца</h1>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Пошаговый процесс сверки и фиксации данных периода</p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-gray-500">Период:</span>
            {periods.length === 0 ? (
              <span className="text-sm font-semibold text-gray-400 italic">Нет периодов</span>
            ) : (
              <select
                value={selectedPeriod?.id || ""}
                onChange={(e) => {
                  const p = periods.find((x) => x.id === e.target.value);
                  if (p) setSelectedPeriod(p);
                }}
                className="bg-white border border-gray-200 px-3 py-1.5 text-xs text-gray-700 font-semibold outline-none focus:border-black"
              >
                {periods.map((p) => (
                  <option key={p.id} value={p.id}>
                    {periodLabel(p.year, p.month)} ({p.status === "CLOSED" ? "Закрыт" : "Открыт"} · {p.mode === "HISTORICAL" ? "Архив" : "Активный"})
                  </option>
                ))}
              </select>
            )}
            {selectedPeriod && selectedPeriod.status !== "CLOSED" && (
              <button
                onClick={() => setDeletingPeriod(selectedPeriod)}
                className="text-xs border border-gray-200 text-gray-400 hover:text-rose-600 hover:border-rose-200 py-1.5 px-2 transition"
                title="Удалить период"
              >
                <Trash2 size={13} />
              </button>
            )}
            <button
              onClick={() => setShowCreateForm(true)}
              className="text-xs bg-black text-white font-bold py-1.5 px-3 hover:opacity-80 transition"
            >
              + Период
            </button>
          </div>
        </div>

        {/* Empty state */}
        {periods.length === 0 && !showCreateForm && (
          <div className="bg-white border border-gray-200 p-12 shadow-sm text-center space-y-4">
            <Calendar className="h-10 w-10 text-gray-300 mx-auto" />
            <h2 className="text-sm font-bold text-gray-800">Нет отчётных периодов</h2>
            <p className="text-xs text-gray-500 max-w-sm mx-auto">
              Создайте первый период или загрузите банковскую выписку — период создастся автоматически.
            </p>
            <div className="flex gap-3 justify-center pt-2">
              <button
                onClick={() => setShowCreateForm(true)}
                className="text-xs bg-black text-white font-bold py-2 px-5 hover:opacity-80 transition"
              >
                + Создать период
              </button>
              <a href="/v2/dashboard" className="text-xs border border-gray-300 text-gray-700 font-bold py-2 px-5 hover:bg-gray-50 transition">
                На главную →
              </a>
            </div>
          </div>
        )}

        {/* Create period form */}
        {showCreateForm && (
          <div className="bg-white border border-gray-200 p-6 shadow-sm space-y-4 max-w-sm">
            <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">Создать отчётный период</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Год</label>
                <input
                  type="number"
                  min="2020"
                  max="2099"
                  value={createYear}
                  onChange={(e) => setCreateYear(parseInt(e.target.value) || new Date().getFullYear())}
                  className="w-full border border-gray-200 px-3 py-2 text-sm text-gray-700 outline-none focus:border-black"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Месяц</label>
                <select
                  value={createMonth}
                  onChange={(e) => setCreateMonth(parseInt(e.target.value))}
                  className="w-full border border-gray-200 px-3 py-2 text-sm text-gray-700 outline-none focus:border-black"
                >
                  {MONTHS.map((m, i) => (
                    <option key={i + 1} value={i + 1}>{m}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Тип периода</label>
              <select
                value={createMode}
                onChange={(e) => setCreateMode(e.target.value as "ACTIVE" | "HISTORICAL")}
                className="w-full border border-gray-200 px-3 py-2 text-sm text-gray-700 outline-none focus:border-black"
              >
                <option value="ACTIVE">Активный (полный wizard)</option>
                <option value="HISTORICAL">Архивный (только импорт + закрытие)</option>
              </select>
            </div>
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setShowCreateForm(false)}
                className="flex-1 border border-gray-200 text-gray-700 text-xs font-bold py-2 hover:bg-gray-50 transition"
              >
                Отмена
              </button>
              <button
                onClick={handleCreatePeriod}
                disabled={creating}
                className="flex-1 bg-black text-white text-xs font-bold py-2 hover:opacity-80 transition disabled:opacity-50"
              >
                {creating ? "Создаём..." : "Создать"}
              </button>
            </div>
          </div>
        )}

        {selectedPeriod && (
          <div className="space-y-6">
            {selectedPeriod.status === "CLOSED" ? (
              <div className="bg-white border border-gray-200 p-8 shadow-sm space-y-6 text-center max-w-lg mx-auto">
                <Lock className="h-10 w-10 text-gray-400 mx-auto" />
                <div>
                  <h2 className="text-sm font-black text-gray-800 uppercase tracking-wide">Период закрыт</h2>
                  <p className="text-xs text-gray-500 mt-1">
                    {periodLabel(selectedPeriod.year, selectedPeriod.month)} — проводки зафиксированы и защищены от изменений.
                  </p>
                </div>
                <div className="flex gap-3 justify-center pt-2 flex-wrap">
                  <a
                    href="/v2/reports/osv"
                    className="flex items-center gap-1.5 text-xs border border-gray-200 text-gray-700 font-bold py-2 px-5 hover:bg-gray-50 transition"
                  >
                    <FileText size={13} />Перейти к отчётам
                  </a>
                  <button
                    onClick={handleReopenPeriod}
                    disabled={reopening}
                    className="text-xs border border-amber-200 text-amber-600 hover:bg-amber-50 font-semibold py-2 px-5 transition disabled:opacity-50"
                  >
                    {reopening ? "Открываем..." : "↩ Переоткрыть"}
                  </button>
                  <a
                    href={`/v2/closing?createPeriod=${selectedPeriod.month === 12 ? selectedPeriod.year + 1 : selectedPeriod.year}-${String(selectedPeriod.month === 12 ? 1 : selectedPeriod.month + 1).padStart(2, "0")}`}
                    className="flex items-center gap-1.5 text-xs bg-black text-white font-bold py-2 px-5 hover:opacity-80 transition"
                  >
                    Следующий месяц →
                  </a>
                </div>
              </div>
            ) : selectedPeriod.mode === "HISTORICAL" ? (
              <div className="bg-white border border-gray-200 p-6 shadow-sm space-y-6">
                <div className="p-3 bg-gray-50 border border-gray-200 text-xs font-semibold text-gray-700 flex items-center gap-2">
                  <Archive size={14} className="text-gray-500 shrink-0" />
                  Этот период является архивным (HISTORICAL). Доступен только импорт выписок.
                </div>
                <Step1Import
                  periodId={selectedPeriod.id}
                  onNext={() => {}}
                  stats={closureStats}
                  onRefreshStats={loadStats}
                />
                <div className="flex justify-end pt-4 border-t border-gray-100">
                  <button
                    onClick={handleFinalizeHistorical}
                    disabled={finalizingHistorical}
                    className="flex items-center gap-1.5 bg-black text-white text-xs font-bold py-2 px-6 hover:opacity-80 transition-opacity disabled:opacity-50"
                  >
                    <Lock size={13} />
                    {finalizingHistorical ? "Закрываем..." : "Зафиксировать и перевести в архив"}
                  </button>
                </div>
              </div>
            ) : (
              <ClosingWizard
                period={selectedPeriod}
                onRefreshList={loadPeriods}
                initialStepParam={stepParam}
              />
            )}
          </div>
        )}
      </div>

      {/* Delete period confirm modal */}
      {deletingPeriod && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded border border-gray-200 shadow-xl max-w-sm w-full p-6 space-y-4">
            <div className="flex items-start justify-between">
              <h3 className="text-sm font-bold text-gray-900">Удалить период?</h3>
              <button onClick={() => setDeletingPeriod(null)} className="text-gray-400 hover:text-gray-600 p-1">
                <X size={16} />
              </button>
            </div>
            <p className="text-sm font-semibold text-gray-800">
              {periodLabel(deletingPeriod.year, deletingPeriod.month)}
            </p>
            <div className="p-3 bg-rose-50 border border-rose-200 rounded text-xs text-rose-800 font-semibold">
              Будут удалены все транзакции, проводки и данные за этот период. Это действие нельзя отменить.
            </div>
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setDeletingPeriod(null)}
                className="flex-1 text-xs border border-gray-200 text-gray-700 font-bold py-2.5 rounded hover:bg-gray-50 transition"
              >
                Отмена
              </button>
              <button
                onClick={handleDeletePeriod}
                disabled={periodDeleteLoading}
                className="flex-1 text-xs bg-rose-600 hover:bg-rose-700 text-white font-bold py-2.5 rounded transition disabled:opacity-50"
              >
                {periodDeleteLoading ? "Удаляем..." : "Удалить период"}
              </button>
            </div>
          </div>
        </div>
      )}
    </ClientLayout>
  );
}

export default function ClosingPage() {
  return (
    <Suspense
      fallback={
        <ClientLayout>
          <div className="flex flex-col items-center justify-center h-[60vh] text-gray-400">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black mb-4"></div>
            <span className="text-sm font-medium uppercase tracking-widest">Загрузка...</span>
          </div>
        </ClientLayout>
      }
    >
      <ClosingPageContent />
    </Suspense>
  );
}

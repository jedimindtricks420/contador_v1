"use client";
import { useEffect, useState } from "react";
import { CheckCircle2, Calendar, CalendarClock, Lock, AlertTriangle, X } from "lucide-react";
import { formatSum } from "@/lib/format";

interface Step7SummaryProps {
  periodId: string;
  onPrev: () => void;
  state: any;
  onFinalized: () => void;
}

const TAX_NAMES: Record<string, string> = {
  VAT: "НДС",
  PERSONAL_INCOME_TAX: "НДФЛ (12%)",
  TURNOVER_TAX: "Налог с оборота",
  PROFIT_TAX: "Налог на прибыль",
  SOCIAL_TAX: "Социальный налог (12%)"
};

export default function Step7Summary({ periodId, onPrev, state, onFinalized }: Step7SummaryProps) {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [stats, setStats] = useState<any | null>(null);
  const [finalizing, setFinalizing] = useState(false);
  const [finalizeError, setFinalizeError] = useState<string | null>(null);
  const [finalResult, setFinalResult] = useState<any | null>(null);
  const [yearEndDone, setYearEndDone] = useState(false);
  const [yearEndLoading, setYearEndLoading] = useState(false);
  const [yearEndError, setYearEndError] = useState<string | null>(null);

  // M-01: confirm modal state
  const [showFinalizeConfirm, setShowFinalizeConfirm] = useState(false);

  // M-02: year-end inline confirm state
  const [yearEndConfirmStep, setYearEndConfirmStep] = useState<"idle" | "confirm">("idle");

  const loadSummaryStats = async () => {
    setLoadError(false);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);
    try {
      const [dashRes, yearEndRes] = await Promise.all([
        fetch(`/v2/api/dashboard?periodId=${periodId}`, { signal: controller.signal }),
        fetch(`/v2/api/closing/year-end/status?periodId=${periodId}`, { signal: controller.signal })
      ]);
      const d = await dashRes.json();
      const yearEndStatus = await yearEndRes.json();
      setStats(d);
      setYearEndDone(yearEndStatus.done === true);
    } catch (err) {
      console.error(err);
      setLoadError(true);
    } finally {
      clearTimeout(timer);
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSummaryStats();
  }, [periodId]);

  const handleFinalize = async () => {
    setShowFinalizeConfirm(false);
    setFinalizing(true);
    setFinalizeError(null);
    try {
      const res = await fetch(`/v2/api/closing/${periodId}/finalize`, {
        method: "POST"
      });
      const data = await res.json();
      if (res.ok) {
        setFinalResult(data);
        onFinalized();
      } else {
        setFinalizeError(`Ошибка при финализации: ${data.error}`);
      }
    } catch {
      setFinalizeError("Ошибка сети. Попробуйте снова.");
    } finally {
      setFinalizing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-6 text-gray-500 font-medium">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-300 mr-2"></div>
        Подготовка сводного отчета...
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="bg-rose-50 border border-rose-200 rounded p-8 text-center space-y-3">
        <AlertTriangle className="h-8 w-8 text-rose-400 mx-auto" />
        <p className="text-sm font-bold text-rose-800">Не удалось загрузить сводные данные</p>
        <p className="text-xs text-rose-600">Проверьте подключение к сети и попробуйте снова.</p>
        <button
          onClick={() => { setLoading(true); loadSummaryStats(); }}
          className="inline-flex items-center gap-1.5 text-xs bg-rose-600 hover:bg-rose-700 text-white font-bold py-2 px-4 rounded transition"
        >
          Повторить
        </button>
      </div>
    );
  }

  const handleYearEnd = async () => {
    setYearEndConfirmStep("idle");
    setYearEndLoading(true);
    setYearEndError(null);
    try {
      const res = await fetch("/v2/api/closing/year-end", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ periodId })
      });
      const data = await res.json();
      if (res.ok) {
        setYearEndDone(true);
      } else {
        if (res.status === 409) {
          setYearEndDone(true);
        } else {
          setYearEndError(`Ошибка: ${data.error}`);
        }
      }
    } catch {
      setYearEndError("Ошибка сети. Попробуйте снова.");
    } finally {
      setYearEndLoading(false);
    }
  };

  if (finalResult) {
    const periodObj = finalResult.period;
    const taxEvents = finalResult.taxEvents || [];
    const closingWarnings: string[] = finalResult.warnings || [];
    const isDecember = periodObj.month === 12;
    const dateLabel = new Date(periodObj.year, periodObj.month - 1, 1).toLocaleDateString("ru-RU", {
      month: "long",
      year: "numeric"
    });

    const nextMonth = periodObj.month === 12 ? 1 : periodObj.month + 1;
    const nextYear = periodObj.month === 12 ? periodObj.year + 1 : periodObj.year;

    return (
      <div className="space-y-6 max-w-xl animate-fade-in">
        <div className="bg-gray-50 border border-gray-200 rounded p-6 text-center space-y-3">
          <CheckCircle2 className="h-10 w-10 text-green-500 mx-auto" />
          <h2 className="text-lg font-black text-gray-700">Месяц успешно закрыт!</h2>
          <p className="text-xs text-gray-700 font-semibold uppercase tracking-wider">
            Отчётный период: {dateLabel}
          </p>
          <p className="text-xs text-gray-500 max-w-md mx-auto">
            Все проводки периода заблокированы. Изменение документов с датой ранее {new Date(periodObj.lockDate).toLocaleDateString("ru-RU")} запрещено.
          </p>
        </div>

        {closingWarnings.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded p-4 space-y-2">
            <div className="text-xs font-bold text-amber-800 flex items-center gap-1.5">
              <AlertTriangle size={14} />Предупреждения при закрытии периода
            </div>
            <ul className="space-y-1.5">
              {closingWarnings.map((w, i) => (
                <li key={i} className="text-xs text-amber-700 leading-relaxed">{w}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Taxes schedule */}
        <div className="bg-white border border-gray-200 rounded p-5 space-y-4">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Налоги к уплате:</h3>
          {taxEvents.length === 0 ? (
            <p className="text-xs text-gray-400 italic">Налоги не начислены.</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {taxEvents.map((t: any) => (
                <div key={t.id} className="py-2.5 flex justify-between items-center text-xs font-semibold text-gray-700">
                  <span>{TAX_NAMES[t.type] || t.type}</span>
                  <div className="text-right">
                    <div className="font-extrabold text-gray-800">{formatSum(t.estimatedAmount)}</div>
                    <div className="text-[10px] text-gray-400 font-medium mt-0.5 flex items-center gap-1">
                      <Calendar size={10} />до {new Date(t.dueDate).toLocaleDateString("ru-RU")}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* M-02: Year-end with inline confirm */}
        {isDecember && !yearEndDone && (
          <div className="bg-amber-50 border border-amber-200 rounded p-4 space-y-3">
            <div className="text-xs font-bold text-amber-800 flex items-center gap-1.5">
              <CalendarClock size={14} />Декабрь — закрытие года
            </div>
            <p className="text-xs text-amber-700">
              Перенесите финансовый результат с счёта 9910 на нераспределённую прибыль (8710).
              Это фиксирует итоговую прибыль/убыток года в балансе.
            </p>
            {yearEndConfirmStep === "idle" && (
              <button
                onClick={() => setYearEndConfirmStep("confirm")}
                disabled={yearEndLoading}
                className="text-xs bg-amber-600 hover:bg-amber-700 text-white font-bold py-2 px-5 rounded transition disabled:opacity-50"
              >
                Перенести прибыль в нераспределённую (9910 → 8710)
              </button>
            )}
            {yearEndConfirmStep === "confirm" && (
              <div className="bg-amber-100 border border-amber-300 rounded p-3 space-y-3">
                <p className="text-xs font-semibold text-amber-900">
                  <AlertTriangle size={13} className="inline mr-1.5" />
                  Будет создана проводка Дт 9910 / Кт 8710. Это действие нельзя отменить.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setYearEndConfirmStep("idle")}
                    className="text-xs bg-white border border-amber-300 text-amber-800 font-bold py-1.5 px-4 rounded transition hover:bg-amber-50"
                  >
                    Отмена
                  </button>
                  <button
                    onClick={handleYearEnd}
                    disabled={yearEndLoading}
                    className="text-xs bg-amber-700 hover:bg-amber-800 text-white font-bold py-1.5 px-4 rounded transition disabled:opacity-50"
                  >
                    {yearEndLoading ? "Переносим..." : "Подтвердить перенос"}
                  </button>
                </div>
              </div>
            )}
            {yearEndError && (
              <div className="p-2 bg-rose-50 border border-rose-200 rounded text-xs text-rose-700 font-semibold">
                {yearEndError}
              </div>
            )}
          </div>
        )}
        {yearEndDone && (
          <div className="p-3 bg-green-50 border border-green-200 rounded text-xs font-semibold text-green-700">
            <CheckCircle2 size={14} className="inline mr-1 text-green-600" />Финансовый результат перенесён. Баланс закрыт.
          </div>
        )}

        <div className="flex justify-end gap-3 pt-4 flex-wrap">
          <a
            href="/v2/reports"
            className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-2.5 px-6 rounded transition"
          >
            Перейти к отчётам
          </a>
          <a
            href={`/v2/closing?createPeriod=${nextYear}-${String(nextMonth).padStart(2, "0")}`}
            className="text-xs bg-gray-800 hover:bg-gray-900 text-white font-bold py-2.5 px-6 rounded transition"
          >
            Следующий месяц →
          </a>
        </div>
      </div>
    );
  }

  // Preview before finalize
  const { kpi, stats: summaryStats } = stats || {};
  const hasUnclassified = summaryStats?.needsClarification > 0;

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h2 className="text-base font-bold text-gray-800">Шаг 7. Итоговый экран</h2>
        <p className="text-xs text-gray-400 mt-1">
          Проверьте сводные данные перед окончательной блокировкой отчётного периода.
        </p>
      </div>

      <div className="bg-gray-50 border border-gray-200 rounded p-5 space-y-4 text-xs font-semibold text-gray-600">
        <div className="font-bold text-gray-800 text-sm border-b border-gray-200 pb-2 mb-1">Сводные показатели месяца:</div>
        <div className="flex justify-between">
          <span>Остаток на счетах:</span>
          <span className="font-extrabold text-gray-800">{formatSum(kpi?.totalBalance)}</span>
        </div>
        <div className="flex justify-between">
          <span>Выручка (Доходы):</span>
          <span className="font-extrabold text-gray-700">{formatSum(kpi?.income)}</span>
        </div>
        <div className="flex justify-between">
          <span>Расходы (Accruals):</span>
          <span className="font-extrabold text-rose-600">{formatSum(kpi?.expense)}</span>
        </div>
        <div className="flex justify-between">
          <span>Налоги к уплате:</span>
          <span className="font-extrabold text-gray-600">{formatSum(kpi?.taxesOwed)}</span>
        </div>
        <div className="flex justify-between border-t border-gray-150 pt-3 text-[10px] text-gray-400 font-bold uppercase tracking-wider">
          <span>Открытые позиции:</span>
          <span className="text-gray-600">{summaryStats?.riskItems || 0} позиции</span>
        </div>
        <div className="flex justify-between text-[10px] text-gray-400 font-bold uppercase tracking-wider">
          <span>Операций без категории:</span>
          <span className={hasUnclassified ? "text-rose-500 font-extrabold" : "text-gray-600"}>
            {summaryStats?.needsClarification || 0} опер.
          </span>
        </div>
      </div>

      {hasUnclassified && (
        <div className="p-4 bg-gray-50 border border-gray-200 text-gray-700 rounded text-xs font-semibold">
          <AlertTriangle size={13} className="inline mr-1.5 text-amber-500" />Внимание: У вас остались невыясненные операции ({summaryStats?.needsClarification} шт.). Настоятельно рекомендуется классифицировать их на Шаге 2 или Шаге 3 перед финализацией.
        </div>
      )}

      {finalizeError && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded text-xs text-rose-800 font-semibold">
          {finalizeError}
        </div>
      )}

      {/* Nav Buttons */}
      <div className="flex justify-between items-center pt-4 border-t border-gray-100">
        <button
          onClick={onPrev}
          disabled={finalizing}
          className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold py-2 px-5 rounded transition"
        >
          ← Назад
        </button>
        <button
          onClick={() => setShowFinalizeConfirm(true)}
          disabled={finalizing}
          className="text-xs bg-black hover:opacity-80 disabled:bg-gray-200 text-white font-extrabold py-2.5 px-6 rounded transition shadow-sm flex items-center gap-2"
        >
          {finalizing ? "Закрываем..." : <><Lock size={13} className="inline mr-1.5" />Зафиксировать и закрыть период</>}
        </button>
      </div>

      {/* M-01: Finalize confirm modal */}
      {showFinalizeConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded border border-gray-200 shadow-xl max-w-sm w-full p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <Lock size={16} className="text-gray-700 shrink-0 mt-0.5" />
                <h3 className="text-sm font-bold text-gray-900">Закрыть период?</h3>
              </div>
              <button
                onClick={() => setShowFinalizeConfirm(false)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <X size={16} />
              </button>
            </div>

            <p className="text-xs text-gray-600 leading-relaxed">
              После закрытия все транзакции будут заблокированы от изменений.
              <span className="font-bold text-gray-800"> Это действие нельзя отменить.</span>
            </p>

            {hasUnclassified && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800 font-semibold">
                <AlertTriangle size={12} className="inline mr-1" />
                {summaryStats?.needsClarification} операций без категории. Рекомендуется классифицировать их перед закрытием.
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowFinalizeConfirm(false)}
                className="flex-1 text-xs border border-gray-200 text-gray-700 font-bold py-2.5 px-4 rounded hover:bg-gray-50 transition"
              >
                Отмена
              </button>
              <button
                onClick={handleFinalize}
                disabled={finalizing}
                className="flex-1 text-xs bg-black text-white font-bold py-2.5 px-4 rounded hover:opacity-80 transition disabled:opacity-50"
              >
                {finalizing ? "Закрываем..." : "Закрыть период →"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

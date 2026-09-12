"use client";
import { useEffect, useRef, useState } from "react";
import { Check, AlertTriangle, RefreshCw } from "lucide-react";
import { z } from "zod";
import Step1Import from "./steps/Step1Import";
import Step2Clarification from "./steps/Step2Clarification";
import Step3Registry from "./steps/Step3Registry";
import Step4Accruals from "./steps/Step4Accruals";
import Step5FxDiff from "./steps/Step5FxDiff";
import Step6Soliq from "./steps/Step6Soliq";
import Step7EInvoices from "./steps/Step7EInvoices";
import Step7Summary from "./steps/Step7Summary";

interface Period {
  id: string;
  year: number;
  month: number;
  status: string;
  mode: string;
}

interface ClosingWizardProps {
  period: Period;
  onRefreshList: () => void;
  initialStepParam?: number;
}

const wizardSchema = z.object({ currentStep: z.number().int().min(1).max(8) }).passthrough();
const statsSchema = z.object({ stats: z.object({}).passthrough() });
const pendingSchema = z.array(z.unknown());

async function readJson(url: string, signal: AbortSignal) {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error("Не удалось загрузить данные мастера закрытия");
  const data = await response.json();
  signal.throwIfAborted();
  return data;
}

export default function ClosingWizard(props: ClosingWizardProps) {
  return <PeriodWizard key={props.period.id} {...props} />;
}

function PeriodWizard({ period, onRefreshList, initialStepParam }: ClosingWizardProps) {
  const [activeStep, setActiveStep] = useState<number>(1);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [wizardState, setWizardState] = useState<any>(null);
  const [closureStats, setClosureStats] = useState<any>(null);

  const [hasPendingInvoices, setHasPendingInvoices] = useState<boolean>(false);
  const [retryAttempt, setRetryAttempt] = useState(0);
  const [navigationError, setNavigationError] = useState(false);
  const [navigating, setNavigating] = useState(false);
  const navigationPending = useRef(false);
  const lifetime = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    lifetime.current = controller;
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let disposed = false;
    const timer = setTimeout(() => controller.abort(), 30000);
    async function loadWizardState() {
      try {
        const [pending, state, dashboard] = await Promise.all([
          readJson(`/v2/api/closing/${period.id}/pending-invoices`, controller.signal),
          readJson(`/v2/api/closing/${period.id}/state`, controller.signal),
          readJson(`/v2/api/dashboard?periodId=${period.id}`, controller.signal),
        ]);
        const hasPending = pendingSchema.parse(pending).length > 0;
        const data = wizardSchema.parse(state);
        const statsData = statsSchema.parse(dashboard);
        if (disposed) return;
        setHasPendingInvoices(hasPending);
        setWizardState(data);
        setClosureStats(statsData.stats);
        const maxStep = hasPending ? 8 : 7;
        setActiveStep(initialStepParam && initialStepParam >= 1 && initialStepParam <= maxStep
          ? initialStepParam : Math.min(data.currentStep, maxStep));
      } catch (err) {
        if (!disposed) {
          console.error(err);
          setLoadError(true);
        }
      } finally {
        clearTimeout(timer);
        controller.abort();
        if (!disposed) setLoading(false);
      }
    }
    void loadWizardState();
    return () => {
      disposed = true;
      clearTimeout(timer);
      controller.abort();
    };
  }, [period.id, initialStepParam, retryAttempt]);

  const refreshStats = async () => {
    const controller = lifetime.current;
    if (!controller || controller.signal.aborted) return;
    try {
      const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(30000)]);
      const statsData = statsSchema.parse(await readJson(`/v2/api/dashboard?periodId=${period.id}`, signal));
      setClosureStats(statsData.stats);
    } catch (err) {
      if (!controller.signal.aborted) console.error(err);
    }
  };

  const navigateStep = async (direction: "next" | "prev", stepPayload?: any) => {
    const controller = lifetime.current;
    if (!controller || controller.signal.aborted || navigationPending.current) return;
    navigationPending.current = true;
    setNavigating(true);
    setNavigationError(false);
    try {
      const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(30000)]);
      const pending = pendingSchema.parse(await readJson(`/v2/api/closing/${period.id}/pending-invoices`, signal));
      const hasPending = pending.length > 0;
      setHasPendingInvoices(hasPending);
      if (stepPayload) setWizardState((prev: any) => ({ ...prev, ...stepPayload }));
      const maxStep = hasPending ? 8 : 7;
      setActiveStep(direction === "next" ? Math.min(activeStep + 1, maxStep)
        : activeStep === maxStep ? maxStep - 1 : Math.max(activeStep - 1, 1));
    } catch (err) {
      if (!controller.signal.aborted) {
        console.error(err);
        setNavigationError(true);
      }
    } finally {
      if (!controller.signal.aborted) {
        navigationPending.current = false;
        setNavigating(false);
      }
    }
  };
  const handleNextStep = (stepPayload?: any) => navigateStep("next", stepPayload);
  const handlePrevStep = () => navigateStep("prev");

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[200px] text-gray-500 font-medium">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-300 mr-2"></div>
        Загрузка состояния мастера закрытия...
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="bg-rose-50 border border-rose-200 rounded p-8 text-center space-y-3">
        <AlertTriangle className="h-8 w-8 text-rose-400 mx-auto" />
        <p className="text-sm font-bold text-rose-800">Не удалось загрузить данные мастера закрытия</p>
        <p className="text-xs text-rose-600">Проверьте подключение к сети и попробуйте снова.</p>
        <button
          onClick={() => { setLoading(true); setLoadError(false); setRetryAttempt(attempt => attempt + 1); }}
          className="inline-flex items-center gap-1.5 text-xs bg-rose-600 hover:bg-rose-700 text-white font-bold py-2 px-4 rounded transition"
        >
          <RefreshCw size={12} />Повторить
        </button>
      </div>
    );
  }

  const steps = [
    { num: 1, title: "Импорт выписки", desc: "Проверка импортированных транзакций" },
    { num: 2, title: "Уточнение категорий", desc: "Классификация нераспознанных операций" },
    { num: 3, title: "Проверка реестра", desc: "Контроль нераспределенных платежей" },
    { num: 4, title: "Начисления периода", desc: "ФОТ, амортизация, аренда" },
    { num: 5, title: "Курсовые разницы", desc: "Переоценка валютных счетов" },
    { num: 6, title: "Сверка с Soliq", desc: "Сравнение ЭСФ и авансов" },
    ...(hasPendingInvoices ? [
      { num: 7, title: "Подтверждение ЭСФ", desc: "Ручное закрытие авансов" },
      { num: 8, title: "Финализация", desc: "Блокировка и расчет налогов" }
    ] : [
      { num: 7, title: "Финализация", desc: "Блокировка и расчет налогов" }
    ])
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
      {/* Sidebar Nav */}
      <div className="space-y-3 lg:col-span-1">
        {steps.map((s) => {
          const isCurrent = activeStep === s.num;
          const isCompleted = activeStep > s.num;

          return (
            <button
              key={s.num}
              disabled={navigating}
              onClick={() => { setNavigationError(false); setActiveStep(s.num); }}
              className={`w-full text-left p-4 rounded border transition flex items-start gap-3 ${
                isCurrent
                  ? "bg-white border-gray-300 text-black font-semibold shadow-sm"
                  : isCompleted
                  ? "bg-gray-50/50 border-gray-200 text-gray-500 hover:bg-gray-50"
                  : "bg-white border-gray-200 text-gray-400 hover:bg-gray-50"
              }`}
            >
              <span
                className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                  isCurrent
                    ? "bg-black text-white"
                    : isCompleted
                    ? "bg-gray-200 text-gray-700"
                    : "bg-gray-100 text-gray-400"
                }`}
              >
                {isCompleted ? <Check size={12} /> : s.num}
              </span>
              <div>
                <div className="text-xs font-bold">{s.title}</div>
                <div className="text-[10px] font-medium text-gray-400 mt-0.5">{s.desc}</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Wizard Panels Panel */}
      <div className="lg:col-span-3 bg-white rounded border border-gray-200 p-6 shadow-sm">
        {navigationError && <p role="alert" className="mb-4 text-sm text-rose-700">Не удалось проверить ЭСФ. Повторите переход.</p>}
        {activeStep === 1 && (
          <Step1Import
            periodId={period.id}
            onNext={handleNextStep}
            stats={closureStats}
            onRefreshStats={refreshStats}
          />
        )}
        {activeStep === 2 && (
          <Step2Clarification
            periodId={period.id}
            onNext={handleNextStep}
            onPrev={handlePrevStep}
          />
        )}
        {activeStep === 3 && (
          <Step3Registry
            periodId={period.id}
            onNext={handleNextStep}
            onPrev={handlePrevStep}
          />
        )}
        {activeStep === 4 && (
          <Step4Accruals
            periodId={period.id}
            onNext={handleNextStep}
            onPrev={handlePrevStep}
            initialAccruals={wizardState?.accruals ?? { salaryAmount: 0, depreciationAmount: 0, rentAmount: 0, expenseAccountCode: "" }}
          />
        )}
        {activeStep === 5 && (
          <Step5FxDiff
            periodId={period.id}
            onNext={handleNextStep}
            onPrev={handlePrevStep}
            initialFxDiff={wizardState?.fxDiff ?? { exchangeRate: 0, difference: 0 }}
          />
        )}
        {activeStep === 6 && (
          <Step6Soliq
            periodId={period.id}
            onNext={handleNextStep}
            onPrev={handlePrevStep}
            initialSoliqMatched={wizardState?.soliqMatched ?? { matched: 0, unmatched: 0 }}
          />
        )}
        {activeStep === 7 && hasPendingInvoices && (
          <Step7EInvoices
            periodId={period.id}
            onNext={handleNextStep}
            onPrev={handlePrevStep}
          />
        )}
        {((activeStep === 7 && !hasPendingInvoices) || activeStep === 8) && (
          <Step7Summary
            periodId={period.id}
            onPrev={handlePrevStep}
            state={wizardState}
            onFinalized={onRefreshList}
          />
        )}
      </div>
    </div>
  );
}

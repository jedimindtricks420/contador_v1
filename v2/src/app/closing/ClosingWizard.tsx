"use client";
import { useEffect, useState } from "react";
import { Check, AlertTriangle, RefreshCw } from "lucide-react";
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

export default function ClosingWizard({ period, onRefreshList, initialStepParam }: ClosingWizardProps) {
  const [activeStep, setActiveStep] = useState<number>(1);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [wizardState, setWizardState] = useState<any>(null);
  const [closureStats, setClosureStats] = useState<any>(null);

  const [hasPendingInvoices, setHasPendingInvoices] = useState<boolean>(false);

  const loadWizardState = async () => {
    setLoadError(false);
    try {
      const pendingRes = await fetch(`/v2/api/closing/${period.id}/pending-invoices`);
      let hasPending = false;
      if (pendingRes.ok) {
        const pendingData = await pendingRes.json();
        hasPending = pendingData && pendingData.length > 0;
        setHasPendingInvoices(hasPending);
      }

      const res = await fetch(`/v2/api/closing/${period.id}/state`);
      const data = await res.json();
      setWizardState(data);

      const maxStep = hasPending ? 8 : 7;
      if (initialStepParam && initialStepParam >= 1 && initialStepParam <= maxStep) {
        setActiveStep(initialStepParam);
      } else {
        setActiveStep(Math.min(data.currentStep || 1, maxStep));
      }

      // Load dashboard/stats
      const statsRes = await fetch(`/v2/api/dashboard?periodId=${period.id}`);
      const statsData = await statsRes.json();
      setClosureStats(statsData.stats);
    } catch (err) {
      console.error(err);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWizardState();
  }, [period.id]);

  const refreshStats = async () => {
    try {
      const statsRes = await fetch(`/v2/api/dashboard?periodId=${period.id}`);
      const statsData = await statsRes.json();
      setClosureStats(statsData.stats);
    } catch (err) {
      console.error(err);
    }
  };

  const handleNextStep = async (stepPayload?: any) => {
    if (stepPayload) {
      setWizardState((prev: any) => ({ ...prev, ...stepPayload }));
    }

    try {
      const pendingRes = await fetch(`/v2/api/closing/${period.id}/pending-invoices`);
      let hasPending = false;
      if (pendingRes.ok) {
        const pendingData = await pendingRes.json();
        hasPending = pendingData && pendingData.length > 0;
        setHasPendingInvoices(hasPending);
      }

      const nextStep = activeStep + 1;
      const maxStep = hasPending ? 8 : 7;
      setActiveStep(Math.min(nextStep, maxStep));
    } catch (err) {
      console.error("handleNextStep error:", err);
      setActiveStep((prev) => Math.min(prev + 1, 8));
    }
  };

  const handlePrevStep = async () => {
    try {
      const pendingRes = await fetch(`/v2/api/closing/${period.id}/pending-invoices`);
      let hasPending = false;
      if (pendingRes.ok) {
        const pendingData = await pendingRes.json();
        hasPending = pendingData && pendingData.length > 0;
        setHasPendingInvoices(hasPending);
      }

      if (activeStep === (hasPending ? 8 : 7)) {
        setActiveStep(hasPending ? 7 : 6);
      } else {
        setActiveStep((prev) => Math.max(prev - 1, 1));
      }
    } catch (err) {
      console.error("handlePrevStep error:", err);
      setActiveStep((prev) => Math.max(prev - 1, 1));
    }
  };

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
          onClick={() => { setLoading(true); loadWizardState(); }}
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
              onClick={() => setActiveStep(s.num)}
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
            initialAccruals={wizardState?.accruals ?? { salaryAmount: 0, depreciationAmount: 0, rentAmount: 0 }}
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

import { useState } from "react";
import { createRoot } from "react-dom/client";
import Step6Soliq from "../../src/app/closing/steps/Step6Soliq";
import Step4Accruals from "../../src/app/closing/steps/Step4Accruals";
import Step5FxDiff from "../../src/app/closing/steps/Step5FxDiff";
import CashFlowClient from "../../src/app/cashflow/CashFlowClient";
import "../../src/app/globals.css";

function SoliqHarness() {
  const [result, setResult] = useState<unknown>(null);
  const [periodId, setPeriodId] = useState("synthetic-period");
  const [step, setStep] = useState("soliq");
  return <div className="mx-auto max-w-5xl p-4 sm:p-8">
    <select aria-label="Test step" value={step} className="mb-4 mr-2 border p-1 text-xs"
      onChange={event => { setStep(event.target.value); setResult(null); }}>
      <option value="soliq">Soliq</option>
      <option value="accruals">Accruals</option>
      <option value="fx">FX</option>
      <option value="cashflow">Cashflow</option>
    </select>
    <select aria-label="Test period" value={periodId} className="mb-4 border p-1 text-xs"
      onChange={event => { setPeriodId(event.target.value); setResult(null); }}>
      <option value="synthetic-period">Synthetic September</option>
      <option value="synthetic-next-period">Synthetic October</option>
    </select>
    {step === "soliq" && <Step6Soliq periodId={periodId} initialSoliqMatched={{ matched: 0, unmatched: 0 }}
      onNext={setResult} onPrev={() => setResult({ previous: true })} />}
    {step === "accruals" && <Step4Accruals periodId={periodId}
      initialAccruals={{ salaryAmount: 0, depreciationAmount: 0, rentAmount: 0 }}
      onNext={setResult} onPrev={() => setResult({ previous: true })} />}
    {step === "fx" && <Step5FxDiff periodId={periodId}
      initialFxDiff={{ exchangeRate: 12000, difference: 100 }}
      onNext={setResult} onPrev={() => setResult({ previous: true })} />}
    {step === "cashflow" && <CashFlowClient />}
    {result !== null && <output data-testid="navigation-result">{JSON.stringify(result)}</output>}
  </div>;
}

createRoot(document.getElementById("root")!).render(<SoliqHarness />);
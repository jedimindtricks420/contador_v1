export interface FeatureStep {
  num: number;
  title: string;
  desc: string;
}

export function FeatureSteps({ steps, heading }: { steps: FeatureStep[]; heading?: string }) {
  return (
    <div>
      {heading && <h2 className="text-xl font-semibold text-black">{heading}</h2>}
      <ol className={heading ? "mt-4 space-y-4" : "space-y-4"}>
        {steps.map((step) => (
          <li key={step.num} className="flex gap-4 rounded border border-gray-200 p-4">
            <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-black text-sm font-semibold text-white">
              {step.num}
            </span>
            <div>
              <p className="font-medium text-black">{step.title}</p>
              <p className="mt-1 text-sm text-gray-600">{step.desc}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

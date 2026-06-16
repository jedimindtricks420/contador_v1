"use client";
import ClarificationQueue from "../ClarificationQueue";

interface Step2ClarificationProps {
  periodId: string;
  onNext: () => void;
  onPrev: () => void;
}

export default function Step2Clarification({ periodId, onNext, onPrev }: Step2ClarificationProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-bold text-gray-800">Шаг 2. Уточнение категорий операций</h2>
        <p className="text-xs text-gray-400 mt-1">
          Ниже приведены группы операций, которые искусственный интеллект не смог классифицировать со 100% уверенностью. Выберите категорию или нажмите «Пропустить всё».
        </p>
      </div>

      <div className="border-t border-gray-100 pt-4">
        <ClarificationQueue
          periodId={periodId}
          onDone={onNext}
          onBack={onPrev}
        />
      </div>
    </div>
  );
}

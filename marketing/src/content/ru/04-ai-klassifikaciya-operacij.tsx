import { Hero } from "@/components/marketing/Hero";
import { ProductScreenshot } from "@/components/marketing/ProductScreenshot";
import { FAQ } from "@/components/marketing/FAQ";
import { RelatedPages } from "@/components/marketing/RelatedPages";
import { CTA } from "@/components/marketing/CTA";
import type { Topic } from "@/lib/manifest";

// Evidence: v2/src/app/closing/ClosingWizard.tsx (шаг 2 "Уточнение категорий")
// → ClarificationQueue.tsx; v2/src/lib/constants.ts AI.CONFIDENCE_THRESHOLD=70.
// Доступно ТОЛЬКО как шаг 2 мастера закрытия — не изображается отдельный
// always-available экран и не изображается чат, которого нет в UI.
const EXAMPLES = [
  {
    payment: "Перевод на карту *4521, назначение «по договору»",
    suggested: "Прочие расходы",
    corrected: "Аванс подотчётному лицу",
    note: "Правила не распознали формулировку — AI предложил общую категорию с низкой уверенностью, пользователь уточнил вручную.",
  },
  {
    payment: "Поступление от ООО «Демо-Клиент», договор №14",
    suggested: "Выручка от реализации",
    corrected: "Выручка от реализации",
    note: "Категория предложена с высокой уверенностью и подтверждена без изменений.",
  },
  {
    payment: "Списание на собственный счёт в другом банке",
    suggested: "Прочие расходы",
    corrected: "Внутреннее перемещение денежных средств",
    note: "Перевод между своими счетами — правила и AI не различают такие переводы автоматически, нужна ручная классификация.",
  },
];

export default function Body({ topic }: { topic: Topic }) {
  const faq = topic.locales.ru.faq;
  return (
    <div className="space-y-12">
      <Hero
        h1={topic.locales.ru.h1}
        lead="Часть операций классифицируют правила, остальное проверяет AI-классификатор. Предложенная категория остаётся черновой, пока вы её не подтвердите."
      />

      <section aria-labelledby="h2-how">
        <h2 id="h2-how" className="text-xl font-semibold text-black">
          Как работают правила и AI
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          Классификация происходит на шаге 2 мастера закрытия месяца — «Уточнение категорий»; отдельного
          самостоятельного экрана классификации вне мастера нет. Сначала операции проверяются по правилам; то, что
          правила не распознали, дополнительно обрабатывает AI-классификатор. Это не диалоговый чат — интерфейс
          показывает очередь операций с предложенной категорией для проверки.
        </p>
      </section>

      <ProductScreenshot alt="Очередь уточнения категорий: операция, предложенная категория и кнопка подтверждения" />

      <section aria-labelledby="h2-check">
        <h2 id="h2-check" className="text-xl font-semibold text-black">
          Как проверить результат
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          Ниже — три демонстрационные операции на вымышленных данных: как выглядит предложенная категория и что
          получается после проверки пользователем.
        </p>
        <div className="mt-4 space-y-3">
          {EXAMPLES.map((ex) => (
            <div key={ex.payment} className="rounded border border-gray-200 p-4">
              <p className="text-sm text-gray-500">{ex.payment}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                <span className="rounded bg-[var(--muted-bg)] px-2 py-1 text-gray-600">
                  Предложено AI: {ex.suggested}
                </span>
                <span aria-hidden className="text-gray-400">→</span>
                <span className="rounded bg-black px-2 py-1 font-medium text-white">
                  Подтверждено: {ex.corrected}
                </span>
              </div>
              <p className="mt-2 text-xs text-gray-500">{ex.note}</p>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="h2-clarify">
        <h2 id="h2-clarify" className="text-xl font-semibold text-black">
          Когда нужно уточнение
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          Когда уверенность классификации ниже установленного порога, операция попадает в очередь уточнения, и
          категорию нужно выбрать вручную. Это не означает ошибку системы — некоторые операции (например, переводы
          между своими счетами или платежи с неоднозначной формулировкой) действительно требуют решения человека.
          AI не гарантирует безошибочность и не заменяет бухгалтера — он ускоряет обработку типовых операций.
        </p>
      </section>

      <FAQ items={faq} locale="ru" />
      <RelatedPages topic={topic} locale="ru" />
      <CTA topicId={topic.id} locale="ru" location="bottom" />
    </div>
  );
}

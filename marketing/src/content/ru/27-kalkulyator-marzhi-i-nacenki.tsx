import { Hero } from "@/components/marketing/Hero";
import { CTA } from "@/components/marketing/CTA";
import { RelatedPages } from "@/components/marketing/RelatedPages";
import { ShareButtons } from "@/components/marketing/ShareButtons";
import { MarginCalculator } from "@/components/tools/MarginCalculator";
import { urlFor } from "@/lib/manifest";
import { absoluteUrl } from "@/lib/site";
import type { Topic } from "@/lib/manifest";

// Тип tool, порядок блоков — TASK-0003 §6: H1 → рабочий калькулятор → результат
// → формула → пример → ограничения → связанные материалы → CTA. Формулы и
// граничные случаи — §7 «27. Маржа и наценка»; арифметика — Decimal
// (src/lib/margin.ts), не floating point.
export default function Body({ topic }: { topic: Topic }) {
  const canonicalUrl = absoluteUrl(urlFor(topic, "ru"));

  return (
    <div className="space-y-12">
      <Hero
        h1={topic.locales.ru.h1}
        lead="Введите себестоимость и цену продажи — калькулятор посчитает валовую прибыль на единицу, маржу и наценку."
      />

      <section aria-labelledby="h2-input">
        <h2 id="h2-input" className="text-xl font-semibold text-black">
          Введите цену и себестоимость
        </h2>
        <div className="mt-4">
          <MarginCalculator locale="ru" topicId={topic.id} />
        </div>
      </section>

      <section aria-labelledby="h2-diff">
        <h2 id="h2-diff" className="text-xl font-semibold text-black">
          Чем отличаются проценты
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          Маржа считается от цены продажи: (цена − себестоимость) ÷ цена × 100%. Наценка считается от
          себестоимости: (цена − себестоимость) ÷ себестоимость × 100%. Это разные проценты для одной и той же
          сделки — маржа всегда меньше наценки при одинаковой прибыли.
        </p>
      </section>

      <section aria-labelledby="h2-formula">
        <h2 id="h2-formula" className="text-xl font-semibold text-black">
          Формулы и пример
        </h2>
        <ul className="mt-3 space-y-1 text-sm text-gray-600">
          <li>Валовая прибыль на единицу = Цена − Себестоимость</li>
          <li>Маржа = (Цена − Себестоимость) ÷ Цена × 100%</li>
          <li>Наценка = (Цена − Себестоимость) ÷ Себестоимость × 100%, если себестоимость больше 0</li>
        </ul>
        <p className="mt-4 text-sm text-gray-600">
          Пример: себестоимость 100 000, цена 125 000 → прибыль 25 000, маржа 20%, наценка 25%.
        </p>
        <div className="mt-6 rounded border border-gray-200 p-4">
          <p className="text-sm font-medium text-black">Ограничения модели</p>
          <ul className="mt-2 space-y-1 text-sm text-gray-600">
            <li>Если себестоимость равна нулю, наценка математически не определена — калькулятор покажет это явно.</li>
            <li>Если цена ниже себестоимости, значения отрицательные — это означает продажу в убыток.</li>
            <li>Калькулятор не оценивает НДС, не считает прибыль после всех расходов и не даёт рекомендаций по цене.</li>
          </ul>
        </div>
      </section>

      <ShareButtons topicId={topic.id} locale="ru" url={canonicalUrl} title={topic.locales.ru.title} />

      <p className="text-sm text-gray-600">
        Проверяйте фактические данные по вашему бизнесу в отчётах Contador — например, в отчёте о прибылях и
        убытках.
      </p>

      <RelatedPages topic={topic} locale="ru" />
      <CTA topicId={topic.id} locale="ru" location="bottom" />
    </div>
  );
}

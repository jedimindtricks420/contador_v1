import { Hero } from "@/components/marketing/Hero";
import { CTA } from "@/components/marketing/CTA";
import { RelatedPages } from "@/components/marketing/RelatedPages";
import { ShareButtons } from "@/components/marketing/ShareButtons";
import { RunwayCalculator } from "@/components/tools/RunwayCalculator";
import { urlFor } from "@/lib/manifest";
import { absoluteUrl } from "@/lib/site";
import type { Topic } from "@/lib/manifest";

// Тип tool, порядок блоков — TASK-0003 §6: H1 → рабочий калькулятор → результат
// → формула → пример → ограничения → связанные материалы → CTA. Формулы и
// граничные случаи — §7 «29. Запас денег»; арифметика — Decimal
// (src/lib/runway.ts), не floating point.
export default function Body({ topic }: { topic: Topic }) {
  const canonicalUrl = absoluteUrl(urlFor(topic, "ru"));

  return (
    <div className="space-y-12">
      <Hero
        h1={topic.locales.ru.h1}
        lead="Введите доступные деньги, среднемесячные поступления и выплаты — калькулятор оценит запас в месяцах при неизменном денежном потоке."
      />

      <section aria-labelledby="h2-input">
        <h2 id="h2-input" className="text-xl font-semibold text-black">
          Деньги и ежемесячный поток
        </h2>
        <div className="mt-4">
          <RunwayCalculator locale="ru" topicId={topic.id} />
        </div>
      </section>

      <section aria-labelledby="h2-calc">
        <h2 id="h2-calc" className="text-xl font-semibold text-black">
          Расчёт срока
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          Чистый отток — это среднемесячные выплаты за вычетом среднемесячных поступлений. Если он
          положительный, запас денег сокращается, и калькулятор делит доступные деньги на чистый отток,
          чтобы получить срок в месяцах. Если поступления покрывают или превышают выплаты, в этой модели
          запас не сокращается — калькулятор не делит на ноль и не выдаёт срок.
        </p>
        <p className="mt-3 text-sm text-gray-600">
          Пример: доступные деньги 30 000 000, среднемесячные поступления 8 000 000, среднемесячные
          выплаты 13 000 000 → чистый отток 5 000 000, запас 6 месяцев.
        </p>
      </section>

      <section aria-labelledby="h2-changes">
        <h2 id="h2-changes" className="text-xl font-semibold text-black">
          Что изменит результат
        </h2>
        <div className="mt-2 rounded border border-gray-200 p-4">
          <ul className="space-y-1 text-sm text-gray-600">
            <li>
              Это детерминированный сценарий на основе средних значений, а не прогноз финансовой
              устойчивости бизнеса и не персональная инвестиционная рекомендация.
            </li>
            <li>
              Расчёт не строит календарную дату исчерпания денег с ложной точностью: внутри месяца платежи
              и поступления могут распределяться неравномерно, а будущие изменения потоков не
              прогнозируются.
            </li>
            <li>Изменение фактических поступлений или выплат в следующих месяцах изменит фактический срок.</li>
          </ul>
        </div>
      </section>

      <ShareButtons topicId={topic.id} locale="ru" url={canonicalUrl} title={topic.locales.ru.title} />

      <p className="text-sm text-gray-600">
        Сверяйте фактические поступления и выплаты по вашему бизнесу в отчёте о движении денежных средств
        Contador.
      </p>

      <RelatedPages topic={topic} locale="ru" />
      <CTA topicId={topic.id} locale="ru" location="bottom" />
    </div>
  );
}

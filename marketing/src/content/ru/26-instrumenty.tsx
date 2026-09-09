import { Hero } from "@/components/marketing/Hero";
import { CTA } from "@/components/marketing/CTA";
import { getTopicById, urlFor } from "@/lib/manifest";
import type { Topic } from "@/lib/manifest";

// Тип hub, порядок блоков — TASK-0003 §6. Фаза 5: все три инструмента (27, 28,
// 29) построены — хаб публикуется полным карточками, как хаб 18 в фазе 4;
// заглушки "скоро" убраны.
function Card({ topic, locale }: { topic: Topic; locale: "ru" }) {
  return (
    <a
      href={urlFor(topic, locale)}
      className="block rounded border border-gray-200 p-4 hover:border-black transition-colors"
    >
      <p className="font-medium text-black">{topic.locales[locale].h1}</p>
      <p className="mt-1 text-sm text-gray-600">{topic.locales[locale].description}</p>
    </a>
  );
}

export default function Body({ topic }: { topic: Topic }) {
  const margin = getTopicById("27");
  const breakeven = getTopicById("28");
  const runway = getTopicById("29");
  const checklist = getTopicById("21");
  const turnoverTax = getTopicById("32");

  return (
    <div className="space-y-12">
      <Hero
        h1={topic.locales.ru.h1}
        lead="Расчёты выполняются в браузере, без регистрации и без отправки данных на сервер."
      />

      <section aria-labelledby="h2-margin">
        <h2 id="h2-margin" className="text-xl font-semibold text-black">
          Маржа и наценка
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {margin && <Card topic={margin} locale="ru" />}
          {checklist && <Card topic={checklist} locale="ru" />}
        </div>
      </section>

      <section aria-labelledby="h2-breakeven">
        <h2 id="h2-breakeven" className="text-xl font-semibold text-black">
          Безубыточность
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {breakeven && <Card topic={breakeven} locale="ru" />}
        </div>
      </section>

      <section aria-labelledby="h2-runway">
        <h2 id="h2-runway" className="text-xl font-semibold text-black">
          Запас денежных средств
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {runway && <Card topic={runway} locale="ru" />}
        </div>
      </section>

      <section aria-labelledby="h2-turnover-tax">
        <h2 id="h2-turnover-tax" className="text-xl font-semibold text-black">
          Налог с оборота
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {turnoverTax && <Card topic={turnoverTax} locale="ru" />}
        </div>
      </section>

      <CTA topicId={topic.id} locale="ru" location="bottom" />
    </div>
  );
}

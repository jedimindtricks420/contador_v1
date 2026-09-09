import { Hero } from "@/components/marketing/Hero";
import { CTA } from "@/components/marketing/CTA";
import { getTopicById, urlFor } from "@/lib/manifest";
import type { Topic } from "@/lib/manifest";

// Тип hub, порядок блоков — TASK-0003 §6. Фаза 1: построены калькулятор
// маржи и наценки (27) и чек-лист закрытия (21); безубыточность (28) и запас
// денег (29) помечены "скоро" без ссылок.
export default function Body({ topic }: { topic: Topic }) {
  const margin = getTopicById("27");
  const checklist = getTopicById("21");

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
          {margin && (
            <a href={urlFor(margin, "ru")} className="block rounded border border-gray-200 p-4 hover:border-black transition-colors">
              <p className="font-medium text-black">{margin.locales.ru.h1}</p>
              <p className="mt-1 text-sm text-gray-600">{margin.locales.ru.description}</p>
            </a>
          )}
          {checklist && (
            <a href={urlFor(checklist, "ru")} className="block rounded border border-gray-200 p-4 hover:border-black transition-colors">
              <p className="font-medium text-black">{checklist.locales.ru.h1}</p>
              <p className="mt-1 text-sm text-gray-600">{checklist.locales.ru.description}</p>
            </a>
          )}
        </div>
      </section>

      <section aria-labelledby="h2-breakeven">
        <h2 id="h2-breakeven" className="text-xl font-semibold text-black">
          Безубыточность
        </h2>
        <div className="mt-4 rounded border border-dashed border-gray-300 p-4 text-sm text-gray-400">
          Калькулятор точки безубыточности — скоро
        </div>
      </section>

      <section aria-labelledby="h2-runway">
        <h2 id="h2-runway" className="text-xl font-semibold text-black">
          Запас денежных средств
        </h2>
        <div className="mt-4 rounded border border-dashed border-gray-300 p-4 text-sm text-gray-400">
          Калькулятор запаса денежных средств — скоро
        </div>
      </section>

      <CTA topicId={topic.id} locale="ru" location="bottom" />
    </div>
  );
}

import { Hero } from "@/components/marketing/Hero";
import { CTA } from "@/components/marketing/CTA";
import { getTopicById, urlFor } from "@/lib/manifest";
import type { Topic } from "@/lib/manifest";

// Тип hub, порядок блоков — TASK-0003 §6: H1 и пояснение → полезные категории
// → дочерние карточки. Фаза 1: из тем 03–13 построена только 06 — её карточка
// показана в своей группе, остальные группы помечены "скоро" без ссылок на
// ещё не существующие страницы (правило задачи для фазы 1 hub-страниц).
export default function Body({ topic }: { topic: Topic }) {
  const closing = getTopicById("06");

  return (
    <div className="space-y-12">
      <Hero h1={topic.locales.ru.h1} lead="Возможности сгруппированы по этапам работы с учётом — от подготовки данных до отчётов." />

      <section aria-labelledby="h2-prep">
        <h2 id="h2-prep" className="text-xl font-semibold text-black">
          Подготовка данных
        </h2>
        <p className="mt-3 text-sm text-gray-500">
          Импорт выписок и AI-классификация операций — страницы этой группы появятся в следующих обновлениях.
        </p>
      </section>

      <section aria-labelledby="h2-accounting">
        <h2 id="h2-accounting" className="text-xl font-semibold text-black">
          Учёт и проверки
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {closing && (
            <a
              href={urlFor(closing, "ru")}
              className="block rounded border border-gray-200 p-4 hover:border-black transition-colors"
            >
              <p className="font-medium text-black">{closing.locales.ru.h1}</p>
              <p className="mt-1 text-sm text-gray-600">{closing.locales.ru.description}</p>
            </a>
          )}
          <div className="rounded border border-dashed border-gray-300 p-4 text-sm text-gray-400">
            Проводки и журнал операций — скоро
          </div>
        </div>
      </section>

      <section aria-labelledby="h2-reports">
        <h2 id="h2-reports" className="text-xl font-semibold text-black">
          Отчёты
        </h2>
        <p className="mt-3 text-sm text-gray-500">
          Баланс, отчёт о прибылях и убытках, движение денежных средств и ОСВ — страницы этой группы появятся в
          следующих обновлениях.
        </p>
      </section>

      <CTA topicId={topic.id} locale="ru" location="bottom" />
    </div>
  );
}

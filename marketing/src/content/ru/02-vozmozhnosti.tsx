import { Hero } from "@/components/marketing/Hero";
import { CTA } from "@/components/marketing/CTA";
import { getTopicById, urlFor } from "@/lib/manifest";
import type { Topic } from "@/lib/manifest";

// Тип hub, порядок блоков — TASK-0003 §6: H1 и пояснение → полезные категории
// → дочерние карточки. Фаза 2: из тем 03–13 построены 03, 04, 05, 06, 07, 08 —
// их карточки показаны в своих группах; остальные группы (09–13) по-прежнему
// помечены "скоро"/"tez orada" без ссылок на ещё не существующие страницы.
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
  const importTopic = getTopicById("03");
  const aiTopic = getTopicById("04");
  const postingsTopic = getTopicById("05");
  const closingTopic = getTopicById("06");
  const balanceTopic = getTopicById("07");
  const pnlTopic = getTopicById("08");

  return (
    <div className="space-y-12">
      <Hero h1={topic.locales.ru.h1} lead="Возможности сгруппированы по этапам работы с учётом — от подготовки данных до отчётов." />

      <section aria-labelledby="h2-prep">
        <h2 id="h2-prep" className="text-xl font-semibold text-black">
          Подготовка данных
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {importTopic && <Card topic={importTopic} locale="ru" />}
          {aiTopic && <Card topic={aiTopic} locale="ru" />}
        </div>
      </section>

      <section aria-labelledby="h2-accounting">
        <h2 id="h2-accounting" className="text-xl font-semibold text-black">
          Учёт и проверки
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {postingsTopic && <Card topic={postingsTopic} locale="ru" />}
          {closingTopic && <Card topic={closingTopic} locale="ru" />}
          <div className="rounded border border-dashed border-gray-300 p-4 text-sm text-gray-400">
            Журнал проводок, карточка счёта и открытые позиции — скоро
          </div>
        </div>
      </section>

      <section aria-labelledby="h2-reports">
        <h2 id="h2-reports" className="text-xl font-semibold text-black">
          Отчёты
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {balanceTopic && <Card topic={balanceTopic} locale="ru" />}
          {pnlTopic && <Card topic={pnlTopic} locale="ru" />}
          <div className="rounded border border-dashed border-gray-300 p-4 text-sm text-gray-400">
            Движение денежных средств и ОСВ — скоро
          </div>
        </div>
      </section>

      <CTA topicId={topic.id} locale="ru" location="bottom" />
    </div>
  );
}

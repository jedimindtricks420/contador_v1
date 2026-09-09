import { Hero } from "@/components/marketing/Hero";
import { CTA } from "@/components/marketing/CTA";
import { getTopicById, urlFor } from "@/lib/manifest";
import type { Topic } from "@/lib/manifest";

// Тип hub, порядок блоков — TASK-0003 §6: H1 и пояснение → полезные категории
// → дочерние карточки. Фаза 3: вся группа 03–13 построена — карточки
// показаны в своих группах, "скоро"-заглушек больше нет.
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
  const cashflowTopic = getTopicById("09");
  const osvTopic = getTopicById("10");
  const journalTopic = getTopicById("11");
  const accountCardTopic = getTopicById("12");
  const openPositionsTopic = getTopicById("13");
  const taxCalendarTopic = getTopicById("31");
  const profitTaxTopic = getTopicById("33");
  const soliqReconcileTopic = getTopicById("35");

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
          {journalTopic && <Card topic={journalTopic} locale="ru" />}
          {accountCardTopic && <Card topic={accountCardTopic} locale="ru" />}
          {openPositionsTopic && <Card topic={openPositionsTopic} locale="ru" />}
        </div>
      </section>

      <section aria-labelledby="h2-reports">
        <h2 id="h2-reports" className="text-xl font-semibold text-black">
          Отчёты
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {balanceTopic && <Card topic={balanceTopic} locale="ru" />}
          {pnlTopic && <Card topic={pnlTopic} locale="ru" />}
          {cashflowTopic && <Card topic={cashflowTopic} locale="ru" />}
          {osvTopic && <Card topic={osvTopic} locale="ru" />}
        </div>
      </section>

      <section aria-labelledby="h2-taxes">
        <h2 id="h2-taxes" className="text-xl font-semibold text-black">
          Налоги
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {taxCalendarTopic && <Card topic={taxCalendarTopic} locale="ru" />}
          {profitTaxTopic && <Card topic={profitTaxTopic} locale="ru" />}
          {soliqReconcileTopic && <Card topic={soliqReconcileTopic} locale="ru" />}
        </div>
      </section>

      <CTA topicId={topic.id} locale="ru" location="bottom" />
    </div>
  );
}

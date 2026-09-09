import { Hero } from "@/components/marketing/Hero";
import { CTA } from "@/components/marketing/CTA";
import { getTopicById, urlFor } from "@/lib/manifest";
import type { Topic } from "@/lib/manifest";

function Card({ topic, locale }: { topic: Topic; locale: "uz" }) {
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
      <Hero h1={topic.locales.uz.h1} lead="Imkoniyatlar hisob bilan ishlash bosqichlari bo‘yicha guruhlangan — ma’lumot tayyorlashdan hisobotlargacha." />

      <section aria-labelledby="h2-prep">
        <h2 id="h2-prep" className="text-xl font-semibold text-black">
          Ma’lumotlarni tayyorlash
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {importTopic && <Card topic={importTopic} locale="uz" />}
          {aiTopic && <Card topic={aiTopic} locale="uz" />}
        </div>
      </section>

      <section aria-labelledby="h2-accounting">
        <h2 id="h2-accounting" className="text-xl font-semibold text-black">
          Hisob va tekshiruvlar
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {postingsTopic && <Card topic={postingsTopic} locale="uz" />}
          {closingTopic && <Card topic={closingTopic} locale="uz" />}
          {journalTopic && <Card topic={journalTopic} locale="uz" />}
          {accountCardTopic && <Card topic={accountCardTopic} locale="uz" />}
          {openPositionsTopic && <Card topic={openPositionsTopic} locale="uz" />}
        </div>
      </section>

      <section aria-labelledby="h2-reports">
        <h2 id="h2-reports" className="text-xl font-semibold text-black">
          Hisobotlar
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {balanceTopic && <Card topic={balanceTopic} locale="uz" />}
          {pnlTopic && <Card topic={pnlTopic} locale="uz" />}
          {cashflowTopic && <Card topic={cashflowTopic} locale="uz" />}
          {osvTopic && <Card topic={osvTopic} locale="uz" />}
        </div>
      </section>

      <section aria-labelledby="h2-taxes">
        <h2 id="h2-taxes" className="text-xl font-semibold text-black">
          Soliqlar
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {taxCalendarTopic && <Card topic={taxCalendarTopic} locale="uz" />}
          {profitTaxTopic && <Card topic={profitTaxTopic} locale="uz" />}
          {soliqReconcileTopic && <Card topic={soliqReconcileTopic} locale="uz" />}
        </div>
      </section>

      <CTA topicId={topic.id} locale="uz" location="bottom" />
    </div>
  );
}

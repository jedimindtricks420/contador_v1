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
          <div className="rounded border border-dashed border-gray-300 p-4 text-sm text-gray-400">
            O‘tkazmalar jurnali, hisobvaraq kartochkasi va ochiq pozitsiyalar — tez orada
          </div>
        </div>
      </section>

      <section aria-labelledby="h2-reports">
        <h2 id="h2-reports" className="text-xl font-semibold text-black">
          Hisobotlar
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {balanceTopic && <Card topic={balanceTopic} locale="uz" />}
          {pnlTopic && <Card topic={pnlTopic} locale="uz" />}
          <div className="rounded border border-dashed border-gray-300 p-4 text-sm text-gray-400">
            Pul oqimi va aylanma-saldo qaydnomasi — tez orada
          </div>
        </div>
      </section>

      <CTA topicId={topic.id} locale="uz" location="bottom" />
    </div>
  );
}

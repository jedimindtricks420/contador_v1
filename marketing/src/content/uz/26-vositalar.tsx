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
  const margin = getTopicById("27");
  const breakeven = getTopicById("28");
  const runway = getTopicById("29");
  const checklist = getTopicById("21");

  return (
    <div className="space-y-12">
      <Hero
        h1={topic.locales.uz.h1}
        lead="Hisob-kitoblar brauzerda amalga oshiriladi — ro‘yxatdan o‘tmasdan va ma’lumotlarni serverga yubormasdan."
      />

      <section aria-labelledby="h2-margin">
        <h2 id="h2-margin" className="text-xl font-semibold text-black">
          Marja va ustama
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {margin && <Card topic={margin} locale="uz" />}
          {checklist && <Card topic={checklist} locale="uz" />}
        </div>
      </section>

      <section aria-labelledby="h2-breakeven">
        <h2 id="h2-breakeven" className="text-xl font-semibold text-black">
          Zararsizlik nuqtasi
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {breakeven && <Card topic={breakeven} locale="uz" />}
        </div>
      </section>

      <section aria-labelledby="h2-runway">
        <h2 id="h2-runway" className="text-xl font-semibold text-black">
          Pul zaxirasi
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {runway && <Card topic={runway} locale="uz" />}
        </div>
      </section>

      <CTA topicId={topic.id} locale="uz" location="bottom" />
    </div>
  );
}

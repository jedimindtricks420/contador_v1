import { Hero } from "@/components/marketing/Hero";
import { CTA } from "@/components/marketing/CTA";
import { getTopicById, urlFor } from "@/lib/manifest";
import type { Topic } from "@/lib/manifest";

export default function Body({ topic }: { topic: Topic }) {
  const margin = getTopicById("27");
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
          {margin && (
            <a href={urlFor(margin, "uz")} className="block rounded border border-gray-200 p-4 hover:border-black transition-colors">
              <p className="font-medium text-black">{margin.locales.uz.h1}</p>
              <p className="mt-1 text-sm text-gray-600">{margin.locales.uz.description}</p>
            </a>
          )}
          {checklist && (
            <a href={urlFor(checklist, "uz")} className="block rounded border border-gray-200 p-4 hover:border-black transition-colors">
              <p className="font-medium text-black">{checklist.locales.uz.h1}</p>
              <p className="mt-1 text-sm text-gray-600">{checklist.locales.uz.description}</p>
            </a>
          )}
        </div>
      </section>

      <section aria-labelledby="h2-breakeven">
        <h2 id="h2-breakeven" className="text-xl font-semibold text-black">
          Zararsizlik nuqtasi
        </h2>
        <div className="mt-4 rounded border border-dashed border-gray-300 p-4 text-sm text-gray-400">
          Zararsizlik nuqtasi kalkulyatori — tez orada
        </div>
      </section>

      <section aria-labelledby="h2-runway">
        <h2 id="h2-runway" className="text-xl font-semibold text-black">
          Pul zaxirasi
        </h2>
        <div className="mt-4 rounded border border-dashed border-gray-300 p-4 text-sm text-gray-400">
          Pul zaxirasi kalkulyatori — tez orada
        </div>
      </section>

      <CTA topicId={topic.id} locale="uz" location="bottom" />
    </div>
  );
}

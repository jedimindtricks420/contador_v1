import { Hero } from "@/components/marketing/Hero";
import { CTA } from "@/components/marketing/CTA";
import { ChecklistWidget } from "@/components/tools/ChecklistWidget";
import { urlFor, getTopicById } from "@/lib/manifest";
import { absoluteUrl } from "@/lib/site";
import type { Topic } from "@/lib/manifest";

export default function Body({ topic }: { topic: Topic }) {
  const wizard = getTopicById("06");
  const canonicalUrl = absoluteUrl(urlFor(topic, "uz"));

  return (
    <div className="space-y-8">
      <Hero
        h1={topic.locales.uz.h1}
        lead="Oyni yopishdan oldin o‘z-o‘zini tekshirish uchun 10 band. Belgilar faqat brauzeringizda saqlanadi."
      />

      <ChecklistWidget locale="uz" topicId={topic.id} canonicalUrl={canonicalUrl} />

      {wizard && (
        <section className="rounded border border-gray-200 bg-[var(--muted-bg)] p-6">
          <h2 className="text-lg font-semibold text-black">Oyni yopish ustasiga o‘tishga tayyormisiz?</h2>
          <p className="mt-2 text-sm text-gray-600">
            Tekshiruv ro‘yxati kabinetdagi oyni yopish ustasini almashtirmaydi — bu o‘z-o‘zini tekshirish uchun
            alohida vosita.
          </p>
          <a href={urlFor(wizard, "uz")} className="mt-4 inline-block text-sm font-medium text-black underline">
            Oyni yopish ustasi qanday ishlaydi →
          </a>
        </section>
      )}

      <CTA topicId={topic.id} locale="uz" location="bottom" />
    </div>
  );
}

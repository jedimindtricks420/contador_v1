import { Hero } from "@/components/marketing/Hero";
import { CTA } from "@/components/marketing/CTA";
import { RelatedPages } from "@/components/marketing/RelatedPages";
import { ShareButtons } from "@/components/marketing/ShareButtons";
import { RunwayCalculator } from "@/components/tools/RunwayCalculator";
import { urlFor } from "@/lib/manifest";
import { absoluteUrl } from "@/lib/site";
import type { Topic } from "@/lib/manifest";

export default function Body({ topic }: { topic: Topic }) {
  const canonicalUrl = absoluteUrl(urlFor(topic, "uz"));

  return (
    <div className="space-y-12">
      <Hero
        h1={topic.locales.uz.h1}
        lead="Mavjud pul, o‘rtacha oylik tushum va chiqimlarni kiriting — kalkulyator pul oqimi o‘zgarmasa zaxira necha oyga yetishini baholaydi."
      />

      <section aria-labelledby="h2-input">
        <h2 id="h2-input" className="text-xl font-semibold text-black">
          Pul va oylik oqim
        </h2>
        <div className="mt-4">
          <RunwayCalculator locale="uz" topicId={topic.id} />
        </div>
      </section>

      <section aria-labelledby="h2-calc">
        <h2 id="h2-calc" className="text-xl font-semibold text-black">
          Muddatni hisoblash
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          Sof chiqim — o‘rtacha oylik chiqimdan o‘rtacha oylik tushumni ayirish natijasi. U musbat bo‘lsa,
          pul zaxirasi kamayadi va kalkulyator mavjud pulni sof chiqimga bo‘lib, muddatni oyda hisoblaydi.
          Agar tushum chiqimni qoplasa yoki undan katta bo‘lsa, bu modelda zaxira kamaymaydi — kalkulyator
          nolga bo‘lmaydi va muddat chiqarmaydi.
        </p>
        <p className="mt-3 text-sm text-gray-600">
          Misol: mavjud pul 30 000 000, o‘rtacha oylik tushum 8 000 000, o‘rtacha oylik chiqim 13 000 000 →
          sof chiqim 5 000 000, zaxira 6 oy.
        </p>
      </section>

      <section aria-labelledby="h2-changes">
        <h2 id="h2-changes" className="text-xl font-semibold text-black">
          Natijaga nima ta’sir qiladi
        </h2>
        <div className="mt-2 rounded border border-gray-200 p-4">
          <ul className="space-y-1 text-sm text-gray-600">
            <li>
              Bu o‘rtacha qiymatlarga asoslangan deterministik ssenariy, biznesning moliyaviy
              barqarorligi prognozi yoki shaxsiy investitsiya tavsiyasi emas.
            </li>
            <li>
              Hisob-kitob pulning tugash sanasini soxta aniqlik bilan chiqarmaydi: oy ichida to‘lov va
              tushumlar notekis taqsimlanishi mumkin, kelajakdagi o‘zgarishlar prognoz qilinmaydi.
            </li>
            <li>Keyingi oylardagi haqiqiy tushum yoki chiqimning o‘zgarishi haqiqiy muddatni o‘zgartiradi.</li>
          </ul>
        </div>
      </section>

      <ShareButtons topicId={topic.id} locale="uz" url={canonicalUrl} title={topic.locales.uz.title} />

      <p className="text-sm text-gray-600">
        Biznesingizning haqiqiy tushum va chiqimlarini Contador’ning pul oqimi hisobotida tekshiring.
      </p>

      <RelatedPages topic={topic} locale="uz" />
      <CTA topicId={topic.id} locale="uz" location="bottom" />
    </div>
  );
}

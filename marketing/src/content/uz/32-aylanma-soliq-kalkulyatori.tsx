import { Hero } from "@/components/marketing/Hero";
import { CTA } from "@/components/marketing/CTA";
import { RelatedPages } from "@/components/marketing/RelatedPages";
import { ShareButtons } from "@/components/marketing/ShareButtons";
import { TurnoverTaxCalculator } from "@/components/tools/TurnoverTaxCalculator";
import { urlFor } from "@/lib/manifest";
import { absoluteUrl } from "@/lib/site";
import type { Topic } from "@/lib/manifest";

export default function Body({ topic }: { topic: Topic }) {
  const canonicalUrl = absoluteUrl(urlFor(topic, "uz"));

  return (
    <div className="space-y-12">
      <Hero
        h1={topic.locales.uz.h1}
        lead="Davr uchun aylanma va o’z aylanma solig’i stavkangizni kiriting — kalkulyator Soliq kodeksi formulasi bo’yicha soliq summasini hisoblab beradi."
      />

      <section aria-labelledby="h2-input">
        <h2 id="h2-input" className="text-xl font-semibold text-black">
          Aylanma va stavkani kiriting
        </h2>
        <div className="mt-4">
          <TurnoverTaxCalculator locale="uz" topicId={topic.id} />
        </div>
      </section>

      <section aria-labelledby="h2-formula">
        <h2 id="h2-formula" className="text-xl font-semibold text-black">
          Hisoblash formulasi
        </h2>
        <ul className="mt-3 space-y-1 text-sm text-gray-600">
          <li>Aylanma solig’i = Davr uchun aylanma × Stavka (%) ÷ 100</li>
        </ul>
        <p className="mt-4 text-sm text-gray-600">
          Misol: aylanma 50 000 000 so’m, stavka 4% → soliq 2 000 000 so’m.
        </p>
        <p className="mt-3 text-sm text-gray-600">
          Stavkani tashkilotning o’zi qonunchilikda belgilangan chegarada tanlaydi — odatiy diapazon 1–4%.
          Kalkulyator standart stavka qo’ymaydi: bu majburiy maydon bo’lib, uni o’z soliq holatingizga qarab
          o’zingiz to’ldirasiz.
        </p>
      </section>

      <section aria-labelledby="h2-limits">
        <h2 id="h2-limits" className="text-xl font-semibold text-black">
          Hisob-kitob cheklovlari
        </h2>
        <div className="mt-4 rounded border border-gray-200 p-4">
          <ul className="space-y-1 text-sm text-gray-600">
            <li>1–4% diapazonidan tashqaridagi stavka bloklanmaydi — imtiyozli toifalar boshqa stavkaga ega bo’lishi mumkin, lekin kalkulyator ogohlantirish ko’rsatadi, shunda siz holatingizni qo’shimcha tekshirasiz.</li>
            <li>Kalkulyator imtiyoz, chegirma va maxsus soliq rejimlarini hisobga olmaydi — faqat aylanmani ko’rsatilgan stavkaga to’g’ridan-to’g’ri ko’paytiradi.</li>
            <li>Siz ko’rsatgan stavka bo’yicha taxminiy hisob-kitob; rasmiy deklaratsiya emas, imtiyoz va chegirmalarni hisobga olmaydi.</li>
          </ul>
        </div>
      </section>

      <ShareButtons topicId={topic.id} locale="uz" url={canonicalUrl} title={topic.locales.uz.title} />

      <p className="text-sm text-gray-600">
        Tashkilotingizning haqiqiy aylanmasini Contador hisobotlarida tekshiring — masalan, foyda va zarar
        hisobotida.
      </p>

      <RelatedPages topic={topic} locale="uz" />
      <CTA topicId={topic.id} locale="uz" location="bottom" />
    </div>
  );
}

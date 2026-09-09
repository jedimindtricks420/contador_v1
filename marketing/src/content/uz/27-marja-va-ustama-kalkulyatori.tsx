import { Hero } from "@/components/marketing/Hero";
import { CTA } from "@/components/marketing/CTA";
import { RelatedPages } from "@/components/marketing/RelatedPages";
import { ShareButtons } from "@/components/marketing/ShareButtons";
import { MarginCalculator } from "@/components/tools/MarginCalculator";
import { urlFor } from "@/lib/manifest";
import { absoluteUrl } from "@/lib/site";
import type { Topic } from "@/lib/manifest";

export default function Body({ topic }: { topic: Topic }) {
  const canonicalUrl = absoluteUrl(urlFor(topic, "uz"));

  return (
    <div className="space-y-12">
      <Hero
        h1={topic.locales.uz.h1}
        lead="Tannarx va sotuv narxini kiriting — kalkulyator birlik uchun yalpi foyda, marja va ustamani hisoblab beradi."
      />

      <section aria-labelledby="h2-input">
        <h2 id="h2-input" className="text-xl font-semibold text-black">
          Narx va tannarxni kiriting
        </h2>
        <div className="mt-4">
          <MarginCalculator locale="uz" topicId={topic.id} />
        </div>
      </section>

      <section aria-labelledby="h2-diff">
        <h2 id="h2-diff" className="text-xl font-semibold text-black">
          Foizlar o‘rtasidagi farq
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          Marja sotuv narxidan hisoblanadi: (narx − tannarx) ÷ narx × 100%. Ustama tannarxdan hisoblanadi: (narx −
          tannarx) ÷ tannarx × 100%. Bu bir xil bitim uchun turli foizlar — bir xil foydada marja doim ustamadan
          kichik bo‘ladi.
        </p>
      </section>

      <section aria-labelledby="h2-formula">
        <h2 id="h2-formula" className="text-xl font-semibold text-black">
          Formulalar va misol
        </h2>
        <ul className="mt-3 space-y-1 text-sm text-gray-600">
          <li>Birlik uchun yalpi foyda = Narx − Tannarx</li>
          <li>Marja = (Narx − Tannarx) ÷ Narx × 100%</li>
          <li>Ustama = (Narx − Tannarx) ÷ Tannarx × 100%, agar tannarx noldan katta bo‘lsa</li>
        </ul>
        <p className="mt-4 text-sm text-gray-600">
          Misol: tannarx 100 000, narx 125 000 → foyda 25 000, marja 20%, ustama 25%.
        </p>
        <div className="mt-6 rounded border border-gray-200 p-4">
          <p className="text-sm font-medium text-black">Model cheklovlari</p>
          <ul className="mt-2 space-y-1 text-sm text-gray-600">
            <li>Tannarx nolga teng bo‘lsa, ustama matematik jihatdan aniqlanmaydi — kalkulyator buni ochiq ko‘rsatadi.</li>
            <li>Narx tannarxdan past bo‘lsa, qiymatlar manfiy bo‘ladi — bu zarar bilan sotishni bildiradi.</li>
            <li>Kalkulyator QQSni baholamaydi, barcha xarajatlardan keyingi foydani hisoblamaydi va narx bo‘yicha tavsiya bermaydi.</li>
          </ul>
        </div>
      </section>

      <ShareButtons topicId={topic.id} locale="uz" url={canonicalUrl} title={topic.locales.uz.title} />

      <p className="text-sm text-gray-600">
        Biznesingizning haqiqiy ma’lumotlarini Contador hisobotlarida tekshiring — masalan, foyda va zarar
        hisobotida.
      </p>

      <RelatedPages topic={topic} locale="uz" />
      <CTA topicId={topic.id} locale="uz" location="bottom" />
    </div>
  );
}

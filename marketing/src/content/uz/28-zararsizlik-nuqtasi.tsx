import { Hero } from "@/components/marketing/Hero";
import { CTA } from "@/components/marketing/CTA";
import { RelatedPages } from "@/components/marketing/RelatedPages";
import { ShareButtons } from "@/components/marketing/ShareButtons";
import { BreakevenCalculator } from "@/components/tools/BreakevenCalculator";
import { urlFor } from "@/lib/manifest";
import { absoluteUrl } from "@/lib/site";
import type { Topic } from "@/lib/manifest";

export default function Body({ topic }: { topic: Topic }) {
  const canonicalUrl = absoluteUrl(urlFor(topic, "uz"));

  return (
    <div className="space-y-12">
      <Hero
        h1={topic.locales.uz.h1}
        lead="Doimiy xarajatlar, birlik narxi va o‘zgaruvchan xarajatlarni kiriting — kalkulyator zararsizlik nuqtasi va tushumni hisoblab beradi."
      />

      <section aria-labelledby="h2-input">
        <h2 id="h2-input" className="text-xl font-semibold text-black">
          Boshlang‘ich qiymatlarni kiriting
        </h2>
        <div className="mt-4">
          <BreakevenCalculator locale="uz" topicId={topic.id} />
        </div>
      </section>

      <section aria-labelledby="h2-sales">
        <h2 id="h2-sales" className="text-xl font-semibold text-black">
          Xarajatlarni qoplash uchun savdo
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          Birlik uchun marjinal daromad (narx minus o‘zgaruvchan xarajatlar) musbat bo‘lar ekan, sotilgan
          har bir birlik doimiy xarajatlarning bir qismini qoplaydi. Uzluksiz nuqta — aniq matematik
          qiymat; odatda birlikning bir qismini sotib bo‘lmagani uchun kalkulyator alohida yuqoriga
          yaxlitlangan butun birliklar sonini va unga mos tushumni ko‘rsatadi — u uzluksiz nuqta
          tushumidan yuqori bo‘ladi.
        </p>
      </section>

      <section aria-labelledby="h2-formula">
        <h2 id="h2-formula" className="text-xl font-semibold text-black">
          Model cheklovlari
        </h2>
        <ul className="mt-3 space-y-1 text-sm text-gray-600">
          <li>Birlik uchun marjinal daromad = Narx − Birlik uchun o‘zgaruvchan xarajatlar</li>
          <li>Uzluksiz nuqta = Doimiy xarajatlar ÷ Birlik uchun marjinal daromad</li>
          <li>Nuqtadagi tushum = Nuqta × Narx</li>
        </ul>
        <p className="mt-4 text-sm text-gray-600">
          Misol: doimiy xarajatlar 1 000 000, narx 150 000, o‘zgaruvchan xarajatlar 100 000 → nuqta 20
          birlik, tushum 3 000 000. Doimiy xarajatlar 1 025 000 bo‘lsa (narx va xarajatlar bir xil) —
          uzluksiz nuqta 20,5 birlik, yaxlitlanganda 21 birlik, yaxlitlangan nuqtadagi tushum — 3 150 000
          (uzluksiz nuqtadagi 3 075 000 o‘rniga).
        </p>
        <div className="mt-6 rounded border border-gray-200 p-4">
          <p className="text-sm font-medium text-black">Model cheklovlari</p>
          <ul className="mt-2 space-y-1 text-sm text-gray-600">
            <li>
              Model bitta mahsulot uchun, bir davr va bitta valyutada narx va xarajatlar o‘zgarmas deb
              hisoblanadi — u soliqlar, sezonlilik yoki assortiment o‘zgarishini avtomatik hisobga olmaydi.
            </li>
            <li>
              Agar narx birlik uchun o‘zgaruvchan xarajatlardan katta bo‘lmasa, savdo doimiy xarajatlarni
              qoplashga ijobiy hissa qo‘shmaydi — kalkulyator buni ochiq ko‘rsatadi, nolga bo‘lmasdan va
              manfiy savdo hajmi bermasdan.
            </li>
          </ul>
        </div>
      </section>

      <ShareButtons topicId={topic.id} locale="uz" url={canonicalUrl} title={topic.locales.uz.title} />

      <p className="text-sm text-gray-600">
        Biznesingizning haqiqiy narx va xarajatlarini Contador hisobotlarida tekshiring — masalan, foyda
        va zarar hisobotida.
      </p>

      <RelatedPages topic={topic} locale="uz" />
      <CTA topicId={topic.id} locale="uz" location="bottom" />
    </div>
  );
}

import { Hero } from "@/components/marketing/Hero";
import { FAQ } from "@/components/marketing/FAQ";
import { CTA } from "@/components/marketing/CTA";
import { getTopicById, urlFor } from "@/lib/manifest";
import type { Topic } from "@/lib/manifest";

export default function Body({ topic }: { topic: Topic }) {
  const faq = topic.locales.uz.faq;
  const openPositionsTopic = getTopicById("13");
  const pnlTopic = getTopicById("08");
  const closingTopic = getTopicById("06");

  return (
    <div className="space-y-12">
      <Hero
        h1={topic.locales.uz.h1}
        lead="Mijozlardan xizmat to‘lovlari, pudratchilar xarajatlari va avanslar — xizmat ko‘rsatish korxonasi har oy duch keladigan narsalar."
      />

      <section aria-labelledby="h2-payments">
        <h2 id="h2-payments" className="text-xl font-semibold text-black">
          Xizmat to‘lovlari va xarajatlar
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          Xizmat ko‘rsatuvchi kompaniyada — agentlik, konsalting, xizmat MChJ — odatda tovar biznesiga qaraganda
          ombor va tovar qoldiqlari bilan ishlash kamroq, ammo buyurtmachilardan to‘lovlar, pudratchilar va
          subpudratchilar xarajatlariga ko‘proq e’tibor kerak. Bunday to‘lovlar bo‘yicha bank operatsiyalari
          Contador’da boshqa operatsiyalar kabi import qilinadi va tasniflanadi.
        </p>
      </section>


      <section aria-labelledby="h2-advances">
        <h2 id="h2-advances" className="text-xl font-semibold text-black">
          Avanslar bilan ishlash
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          O‘ylab topilgan ma’lumotlar asosidagi misol: «Demo-agentlik» reklama agentligi buyurtmachidan hali to‘liq
          ko‘rsatilmagan xizmatlar uchun 2 000 000 so‘m oldindan to‘lov oldi va shu bilan birga pudratchiga ishning
          bir qismi uchun 500 000 so‘m avans berdi. Ikkala summa ham ochiq pozitsiya sifatida aks etadi — ular
          xizmat ko‘rsatilganda yoki pudratchi bajarilgan ish haqida hisobot berganda yopiladi.
        </p>
        <div className="mt-4">
          {openPositionsTopic && (
            <a
              href={urlFor(openPositionsTopic, "uz")}
              className="block rounded border border-gray-200 p-4 hover:border-black transition-colors"
            >
              <p className="font-medium text-black">{openPositionsTopic.locales.uz.h1}</p>
            </a>
          )}
        </div>
      </section>

      <section aria-labelledby="h2-result">
        <h2 id="h2-result" className="text-xl font-semibold text-black">
          Oy natijasini tekshirish
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          Oy oxirida foyda va zarar hisoboti ko‘rsatilgan xizmatlardan olingan daromadni, davr xarajatlarini va
          moliyaviy natijani ko‘rsatadi, oyni yopish ustasi esa davrni yakunlashdan oldin mavjud tekshiruvlardan
          o‘tishga yordam beradi. Xizmat ko‘rsatish korxonalari uchun tarmoq funksiyalari — CRM, vaqt hisobi, ombor
          yoki maxsus imtiyozlar — Contador’da mavjud emas.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {pnlTopic && (
            <a
              href={urlFor(pnlTopic, "uz")}
              className="block rounded border border-gray-200 p-4 hover:border-black transition-colors"
            >
              <p className="font-medium text-black">{pnlTopic.locales.uz.h1}</p>
            </a>
          )}
          {closingTopic && (
            <a
              href={urlFor(closingTopic, "uz")}
              className="block rounded border border-gray-200 p-4 hover:border-black transition-colors"
            >
              <p className="font-medium text-black">{closingTopic.locales.uz.h1}</p>
            </a>
          )}
        </div>
      </section>

      <FAQ items={faq} locale="uz" />
      <CTA topicId={topic.id} locale="uz" location="bottom" />
    </div>
  );
}

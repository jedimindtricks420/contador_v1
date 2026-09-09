import { Hero } from "@/components/marketing/Hero";
import { FAQ } from "@/components/marketing/FAQ";
import { RelatedPages } from "@/components/marketing/RelatedPages";
import { CTA } from "@/components/marketing/CTA";
import { getTopicById, urlFor } from "@/lib/manifest";
import type { Topic } from "@/lib/manifest";

export default function Body({ topic }: { topic: Topic }) {
  const faq = topic.locales.uz.faq;
  const importTopic = getTopicById("03");
  const closingTopic = getTopicById("06");

  return (
    <div className="space-y-12">
      <Hero
        h1={topic.locales.uz.h1}
        lead="Oyni yopish ustasidagi «Soliq bilan solishtirish» bosqichi yuklangan hisob-faktura va avanslar ma’lumotlarini hisobingiz bilan solishtiradi — davr yakunlanishidan oldin."
      />

      <section aria-labelledby="h2-what">
        <h2 id="h2-what" className="text-xl font-semibold text-black">
          Soliq’dan nima yuklanadi
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          Soliq ma’lumotlari alohida fayl orqali yuklanadi — bu bank ko’chirmasini yuklashdan mustaqil, alohida
          import yo’li. Yuklangan reestr hisob-fakturalar va avanslarni ko’rsatadi, keyin ularni Contador
          hisobidagi ma’lumotlar bilan solishtirish mumkin.
        </p>
        {importTopic && (
          <div className="mt-4 rounded border border-gray-200 p-4">
            <p className="text-sm text-gray-600">
              Bu alohida ma’lumot manbai — bank ko’chirmasi uchun ishlatiladigan import bilan bir xil emas:
            </p>
            <a href={urlFor(importTopic, "uz")} className="mt-2 inline-block text-sm font-medium text-black underline">
              {importTopic.locales.uz.h1}
            </a>
          </div>
        )}
      </section>

      <section aria-labelledby="h2-reconcile">
        <h2 id="h2-reconcile" className="text-xl font-semibold text-black">
          Avanslar va EHF solishtiruvi
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          Yuklangandan keyin Contador Soliq reestridagi elektron hisob-fakturalar va avanslar summalarini
          hisobingiz ma’lumotlari bilan solishtiradi va farqlarni ko’rsatadi. Topilgan farqlarni bartaraf etish —
          masalan, operatsiyani qo’shish yoki summani aniqlashtirish — foydalanuvchi vazifasi bo’lib qoladi: servis
          ularni o’zi tuzatmaydi va avtomatik tuzatish topshirmaydi.
        </p>
      </section>

      <section aria-labelledby="h2-when">
        <h2 id="h2-when" className="text-xl font-semibold text-black">
          Oyni yopishda qachon sodir bo’ladi
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          Soliq bilan solishtirish — oyni yopish ustasining 6-bosqichi, «my.soliq.uz portali bilan solishtirish».
          U davrning asosiy operatsiyalari allaqachon taqsimlangandan keyin va davrni yakunlashdan oldin sodir
          bo’ladi.
        </p>
        {closingTopic && (
          <div className="mt-4 rounded border border-gray-200 p-4">
            <a href={urlFor(closingTopic, "uz")} className="text-sm font-medium text-black underline">
              {closingTopic.locales.uz.h1}
            </a>
          </div>
        )}
        <p className="mt-4 text-sm text-gray-600">
          Contador bu bosqich orqali elektron hisob-fakturalarni to’g’ridan-to’g’ri yubormaydi va qabul qilmaydi —
          faqat servisga allaqachon yuklangan ma’lumotlar solishtiriladi.
        </p>
      </section>

      <FAQ items={faq} locale="uz" />
      <RelatedPages topic={topic} locale="uz" />
      <CTA topicId={topic.id} locale="uz" location="bottom" />
    </div>
  );
}

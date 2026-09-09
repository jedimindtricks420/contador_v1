import { Hero } from "@/components/marketing/Hero";
import { ProductScreenshot } from "@/components/marketing/ProductScreenshot";
import { FAQ } from "@/components/marketing/FAQ";
import { CTA } from "@/components/marketing/CTA";
import { getTopicById, urlFor } from "@/lib/manifest";
import type { Topic } from "@/lib/manifest";

export default function Body({ topic }: { topic: Topic }) {
  const faq = topic.locales.uz.faq;
  const importTopic = getTopicById("03");
  const aiTopic = getTopicById("04");
  const closingTopic = getTopicById("06");
  const checklistTopic = getTopicById("21");

  return (
    <div className="space-y-12">
      <Hero
        h1={topic.locales.uz.h1}
        lead="Ko‘chirma importi, tasnifni tekshirish, o‘tkazmalar va hisobotlar — buxgalterning bitta servisdagi ish ketma-ketligi."
      />

      <section aria-labelledby="h2-prepare">
        <h2 id="h2-prepare" className="text-xl font-semibold text-black">
          Ma’lumotlarni tayyorlang
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          Bir necha tashkilot hisobini Excel yoki turli dasturlarda yuritayotgan buxgalterning ko‘p vaqti
          bank-mijoz ma’lumotlarini qo‘lda ko‘chirish va operatsiyalarni qayta solishtirishga ketadi. Contador’da
          buxgalterning ish kuni odatda bank ko‘chirmasini yuklashdan boshlanadi — bu oyni yopish ustasining
          birinchi bosqichi, alohida tarqoq vazifa emas.
        </p>
      </section>

      <ProductScreenshot alt="Buxgalter nuqtai nazaridan oyni yopish ustasi: davr operatsiyalari ro‘yxati" />

      <section aria-labelledby="h2-check">
        <h2 id="h2-check" className="text-xl font-semibold text-black">
          Operatsiyalarni tekshiring
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          Keyin qoidalar va AI-tasnif ishga tushadi: operatsiyalarning bir qismi avtomatik aniqlanadi, buxgalter
          esa faqat noaniq holatlarni qo‘lda aniqlashtiradi. Toifalar aniqlashtirilgandan so‘ng operatsiyalar
          hujjatlar bo‘yicha o‘tkazmalarga taqsimlanadi — o‘tkazmani noldan qo‘lda kiritish shart emas.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {importTopic && (
            <a href={urlFor(importTopic, "uz")} className="block rounded border border-gray-200 p-4 hover:border-black transition-colors">
              <p className="font-medium text-black">{importTopic.locales.uz.h1}</p>
            </a>
          )}
          {aiTopic && (
            <a href={urlFor(aiTopic, "uz")} className="block rounded border border-gray-200 p-4 hover:border-black transition-colors">
              <p className="font-medium text-black">{aiTopic.locales.uz.h1}</p>
            </a>
          )}
          {closingTopic && (
            <a href={urlFor(closingTopic, "uz")} className="block rounded border border-gray-200 p-4 hover:border-black transition-colors">
              <p className="font-medium text-black">{closingTopic.locales.uz.h1}</p>
            </a>
          )}
        </div>
      </section>

      <section aria-labelledby="h2-reports">
        <h2 id="h2-reports" className="text-xl font-semibold text-black">
          Hisobotlarni shakllantiring
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          Ish kuni misoli: buxgalter sentyabr oyi ko‘chirmasini yuklaydi, tasnif navbatida uchta noaniq
          operatsiyani aniqlashtiradi, oyni yopish ustasi bosqichlaridan o‘tadi va oy oxirida yakunlangan davr
          bo‘yicha hisobotlarni shakllantiradi. Kabinetda rollar va bir nechta tashkilotga kirish tarifga bog‘liq —
          batafsil tariflar sahifasida. Contador professional buxgalterlik ekspertizasini almashtirmaydi va
          bahsli masalalar bo‘yicha buxgalter o‘rniga qaror qabul qilmaydi.
        </p>
      </section>

      <FAQ items={faq} locale="uz" />

      {checklistTopic && (
        <div className="rounded border border-gray-200 p-4">
          <p className="text-sm text-gray-600">
            Oyni yopish ustasidan oldin bepul tekshiruv ro‘yxati bilan mustaqil tekshirib olishingiz mumkin — u
            ro‘yxatdan o‘tmasdan mavjud.
          </p>
          <a href={urlFor(checklistTopic, "uz")} className="mt-2 inline-block text-sm font-medium text-black underline">
            {checklistTopic.locales.uz.h1}
          </a>
        </div>
      )}

      <CTA topicId={topic.id} locale="uz" location="bottom" />
    </div>
  );
}

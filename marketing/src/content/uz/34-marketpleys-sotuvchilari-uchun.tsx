import { Hero } from "@/components/marketing/Hero";
import { FAQ } from "@/components/marketing/FAQ";
import { CTA } from "@/components/marketing/CTA";
import { getTopicById, urlFor } from "@/lib/manifest";
import type { Topic } from "@/lib/manifest";

export default function Body({ topic }: { topic: Topic }) {
  const faq = topic.locales.uz.faq;
  const importTopic = getTopicById("03");
  const postingsTopic = getTopicById("05");
  const closingTopic = getTopicById("06");

  return (
    <div className="space-y-12">
      <Hero
        h1={topic.locales.uz.h1}
        lead="Marketpleys orqali savdo boshqa har qanday daromad kabi hisobga tushadi — import paytida kontragent aniqlanadi va keyin komissiya solishtiriladi."
      />

      <section aria-labelledby="h2-recognize">
        <h2 id="h2-recognize" className="text-xl font-semibold text-black">
          Marketpleys to’lovlari qanday aniqlanadi
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          Bank ko’chirmasi yoki Soliq ma’lumotlarini import qilishda Contador kontragentning INN va nomini ma’lum
          marketpleyslar ro’yxati bilan solishtiradi. Mos kelish topilsa — operatsiya avtomatik ravishda
          marketpleysdan tushum sifatida belgilanadi, qo’lda belgilash shart emas. Bunda platformalarga (Uzum
          Market, Wildberries UZ va boshqalarga) to’g’ridan-to’g’ri API ulanish yo’q — aniqlash faqat allaqachon
          yuklangan ko’chirma yoki Soliq ma’lumotlari asosida amalga oshadi.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {importTopic && (
            <a href={urlFor(importTopic, "uz")} className="block rounded border border-gray-200 p-4 hover:border-black transition-colors">
              <p className="font-medium text-black">{importTopic.locales.uz.h1}</p>
            </a>
          )}
          {postingsTopic && (
            <a href={urlFor(postingsTopic, "uz")} className="block rounded border border-gray-200 p-4 hover:border-black transition-colors">
              <p className="font-medium text-black">{postingsTopic.locales.uz.h1}</p>
            </a>
          )}
        </div>
      </section>

      <section aria-labelledby="h2-reconcile">
        <h2 id="h2-reconcile" className="text-xl font-semibold text-black">
          Komissiya va daromadni solishtirish
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          Misol (o’ylab topilgan ma’lumotlar): YaTT «Gulbahor Treyd» marketpleysdan platforma komissiyasi
          chegirilgan holda bitta o’tkazma orqali summa oladi. Ko’chirmada aniqlangan kontragentdan bitta tushum
          operatsiyasi ko’rinadi — keyin marketpleysning o’z hisobotidan qancha tovar sotilgani va qancha komissiya
          ushlab qolinganini solishtirish kerak, shunda daromad va xarajat to’g’ri alohida aks etadi. Contador aniq
          platformalarning komissiya foizlarini e’lon qilmaydi va tasdiqlamaydi — bu ma’lumotni o’z sotuvchi
          shaxsiy kabinetingizda ko’rish kerak.
        </p>
      </section>

      <section aria-labelledby="h2-next">
        <h2 id="h2-next" className="text-xl font-semibold text-black">
          Hisobda keyingi qadam
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          Aniqlangandan keyin operatsiya oddiy daromad sifatida qayta ishlanadi: tasnifdan o’tadi, o’tkazma bilan
          taqsimlanadi va davrning boshqa operatsiyalari bilan birga oyni yopishga tushadi.
        </p>
        {closingTopic && (
          <div className="mt-4 rounded border border-gray-200 p-4">
            <a href={urlFor(closingTopic, "uz")} className="text-sm font-medium text-black underline">
              {closingTopic.locales.uz.h1}
            </a>
          </div>
        )}
      </section>

      <FAQ items={faq} locale="uz" />
      <CTA topicId={topic.id} locale="uz" location="bottom" />
    </div>
  );
}

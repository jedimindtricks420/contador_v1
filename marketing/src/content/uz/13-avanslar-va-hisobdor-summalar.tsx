import { Hero } from "@/components/marketing/Hero";
import { FAQ } from "@/components/marketing/FAQ";
import { RelatedPages } from "@/components/marketing/RelatedPages";
import { CTA } from "@/components/marketing/CTA";
import type { Topic } from "@/lib/manifest";

export default function Body({ topic }: { topic: Topic }) {
  const faq = topic.locales.uz.faq;
  return (
    <div className="space-y-12">
      <Hero
        h1={topic.locales.uz.h1}
        lead="Ochiq pozitsiyalar — hali qarshi operatsiya bilan yopilmagan avans va hisobdor summalar."
      />

      <section aria-labelledby="h2-open">
        <h2 id="h2-open" className="text-xl font-semibold text-black">
          Qaysi pozitsiyalar ochiq qoladi
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          O‘ylab topilgan ma’lumotlar asosidagi misol: 5-sentyabrda xodimga xo‘jalik xarajatlari uchun 800 000
          so‘m avans berilgan. Xodim sarflangan mablag‘ haqida hisobot bermaguncha — avans hisoboti yoki qoldiqni
          qaytarish orqali — bu summa Contador’da ochiq pozitsiya sifatida ko‘rinadi: pul berilgan, lekin
          operatsiya hali yopilmagan.
        </p>
      </section>


      <section aria-labelledby="h2-status">
        <h2 id="h2-status" className="text-xl font-semibold text-black">
          Muddatlar va holatlar
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          Pozitsiya xuddi shu summaga qarshi operatsiya bilan yopiladi — masalan, to‘liq summaga avans hisoboti
          yoki qoldiqni qisman qaytarish orqali. Shundan keyin u ochiq hisoblanmaydi. Servis muddati o‘tgan
          pozitsiyalar haqida avtomatik eslatma yubormaydi — muddat va holatlar ochiq pozitsiyalar bo‘limida qo‘lda
          tekshiriladi.
        </p>
      </section>

      <section aria-labelledby="h2-before-closing">
        <h2 id="h2-before-closing" className="text-xl font-semibold text-black">
          Yopishdan oldin tekshirish
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          Oyni yopishdan oldin davr uchun ochiq pozitsiyalar ro‘yxatini ko‘rib chiqish foydali: xodim hisoboti bilan
          yopilishi yoki keyingi davrga o‘tkazilishi kerak bo‘lgan, harakatsiz qolgan avans yoki hisobdor summalar
          bormi. Bu bo‘lim qarzni undirish uchun to‘liq CRM o‘rnini bosmaydi — u faqat Contador hisobidagi avans va
          hisobdor summalar holatini ko‘rsatadi.
        </p>
      </section>

      <FAQ items={faq} locale="uz" />
      <RelatedPages topic={topic} locale="uz" />
      <CTA topicId={topic.id} locale="uz" location="bottom" />
    </div>
  );
}

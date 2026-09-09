import { Hero } from "@/components/marketing/Hero";
import { FAQ } from "@/components/marketing/FAQ";
import { RelatedPages } from "@/components/marketing/RelatedPages";
import { CTA } from "@/components/marketing/CTA";
import type { Topic } from "@/lib/manifest";

const QUESTIONS = [
  {
    q: "Biznes oy uchun qancha foyda topdi?",
    a: "Bunga foyda va zarar hisoboti javob beradi: tanlangan davr uchun daromad, xarajat va moliyaviy natija.",
  },
  {
    q: "Hozir hisobvaraqlarda qancha pul bor?",
    a: "Bu bank hisobvaraqlaridagi haqiqiy qoldiq — davr foydasidan alohida savol, hisob ma’lumotlari asosida buxgalter bilan muhokama qilinadi.",
  },
  {
    q: "Asosiy xarajatlar nimaga sarflanmoqda?",
    a: "Davr xarajatlari tuzilishi ham foyda va zarar hisobotida ko‘rinadi — bu buxgalter bilan suhbat uchun boshlang‘ich nuqta.",
  },
];

export default function Body({ topic }: { topic: Topic }) {
  const faq = topic.locales.uz.faq;
  return (
    <div className="space-y-12">
      <Hero
        h1={topic.locales.uz.h1}
        lead="Rahbar hisobni o‘zi yuritishi shart emas — buxgalterga qanday savol berish va qaysi hisobotni ochishni bilish yetarli."
      />

      <section aria-labelledby="h2-money">
        <h2 id="h2-money" className="text-xl font-semibold text-black">
          Foyda va hisobdagi pul
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          Rahbarlarda ko‘p uchraydigan chalkashlik — hisobvaraqdagi pulni foyda deb hisoblash. Bular turli
          ko‘rsatkichlar: foyda hisob ma’lumotlari bo‘yicha davr natijasini aks ettiradi, hisobvaraqdagi qoldiq esa
          shu paytdagi haqiqiy pul. Ular, masalan, mijoz hali to‘lov qilmagan bo‘lsa, sezilarli farq qilishi
          mumkin.
        </p>
      </section>


      <section aria-labelledby="h2-questions">
        <h2 id="h2-questions" className="text-xl font-semibold text-black">
          Buxgalterga savollar
        </h2>
        <div className="mt-4 space-y-3">
          {QUESTIONS.map((item) => (
            <div key={item.q} className="rounded border border-gray-200 p-4">
              <p className="font-medium text-black">{item.q}</p>
              <p className="mt-1 text-sm text-gray-600">{item.a}</p>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="h2-open">
        <h2 id="h2-open" className="text-xl font-semibold text-black">
          Qaysi hisobotlarni ko‘rish kerak
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          Misol: oy oxirida rahbar sentyabr uchun foyda va zarar hisobotini ochadi, moliyaviy natijani ko‘radi va
          buxgalter bilan foyda hamda hisobvaraqdagi qoldiq o‘rtasidagi farqni muhokama qiladi. Contador byudjet
          prognozini shakllantirmaydi va moliya direktorini almashtirmaydi — hisobotlar o‘tgan davr bo‘yicha
          haqiqiy ma’lumotlarni ko‘rsatadi, prognoz emas.
        </p>
      </section>

      <FAQ items={faq} locale="uz" />
      <RelatedPages topic={topic} locale="uz" />
      <CTA topicId={topic.id} locale="uz" location="bottom" />
    </div>
  );
}

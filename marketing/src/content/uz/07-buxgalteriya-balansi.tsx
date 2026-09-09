import { Hero } from "@/components/marketing/Hero";
import { ProductScreenshot } from "@/components/marketing/ProductScreenshot";
import { FAQ } from "@/components/marketing/FAQ";
import { RelatedPages } from "@/components/marketing/RelatedPages";
import { CTA } from "@/components/marketing/CTA";
import type { Topic } from "@/lib/manifest";

const SAMPLE_ASSETS = [
  { name: "Hisobvaraqlardagi pul mablag‘lari", amount: "48 200 000" },
  { name: "Xaridorlar bilan hisob-kitoblar", amount: "15 600 000" },
  { name: "Asosiy vositalar (qoldiq qiymati)", amount: "62 000 000" },
];
const SAMPLE_LIABILITIES = [
  { name: "Ustav kapitali", amount: "50 000 000" },
  { name: "Taqsimlanmagan foyda", amount: "58 300 000" },
  { name: "Yetkazib beruvchilar bilan hisob-kitoblar", amount: "17 500 000" },
];

export default function Body({ topic }: { topic: Topic }) {
  const faq = topic.locales.uz.faq;
  return (
    <div className="space-y-12">
      <Hero
        h1={topic.locales.uz.h1}
        lead="Balans hisobga allaqachon kiritilgan ma’lumotlar asosida tashkilotning tanlangan sanadagi aktivlari va majburiyatlarini ko‘rsatadi."
      />

      <section aria-labelledby="h2-shows">
        <h2 id="h2-shows" className="text-xl font-semibold text-black">
          Balans nimani ko‘rsatadi
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          Quyida — o‘ylab topilgan ma’lumotlar asosidagi misol: tashkilotning bitta hisobot sanasidagi aktivlari va
          majburiyatlari. Bu mijozning haqiqiy ma’lumotlari emas, hisobot tuzilishini ko‘rsatuvchi namuna.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="rounded border border-gray-200 p-4">
            <p className="text-sm font-medium text-black">Aktivlar</p>
            <ul className="mt-2 space-y-1 text-sm text-gray-600">
              {SAMPLE_ASSETS.map((row) => (
                <li key={row.name} className="flex justify-between gap-3">
                  <span>{row.name}</span>
                  <span className="text-gray-500">{row.amount}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded border border-gray-200 p-4">
            <p className="text-sm font-medium text-black">Majburiyatlar va kapital</p>
            <ul className="mt-2 space-y-1 text-sm text-gray-600">
              {SAMPLE_LIABILITIES.map((row) => (
                <li key={row.name} className="flex justify-between gap-3">
                  <span>{row.name}</span>
                  <span className="text-gray-500">{row.amount}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <p className="mt-2 text-xs text-gray-500">Summalar so‘mda, demo ma’lumotlar 30.09.2026 shartli sanaga misol.</p>
      </section>

      <ProductScreenshot alt="Balans bo‘limi: tanlangan sanadagi aktivlar va majburiyatlar" />

      <section aria-labelledby="h2-date">
        <h2 id="h2-date" className="text-xl font-semibold text-black">
          Sanani tanlash
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          Balans sahifasida hisobot sanasi ko‘rsatiladi — ko‘rsatkichlar shu sanadagi hisob ma’lumotlari bo‘yicha
          shakllanadi. Sanani o‘zgartirib, tashkilot holatini kiritilgan ma’lumotlar doirasida turli vaqt
          nuqtalarida solishtirish mumkin.
        </p>
      </section>

      <section aria-labelledby="h2-source-data">
        <h2 id="h2-source-data" className="text-xl font-semibold text-black">
          Boshlang‘ich ma’lumotlarni tekshirish
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          Balansning to‘liqligi operatsiyalar va hisob boshlanish sanasidagi boshlang‘ich qoldiqlar qanchalik
          to‘liq kiritilganiga bog‘liq — hisobot yetishmayotgan ma’lumotni o‘zi to‘ldirmaydi va manba hujjatlarni
          tekshirishni almashtirmaydi. Balans to‘liq bo‘lmagandek ko‘rinsa, avval import qilingan ko‘chirmalar va
          boshlang‘ich qoldiqlarni tekshirish kerak.
        </p>
      </section>

      <FAQ items={faq} locale="uz" />
      <RelatedPages topic={topic} locale="uz" />
      <CTA topicId={topic.id} locale="uz" location="bottom" />
    </div>
  );
}

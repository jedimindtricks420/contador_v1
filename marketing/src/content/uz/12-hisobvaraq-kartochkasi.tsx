import { Hero } from "@/components/marketing/Hero";
import { ProductScreenshot } from "@/components/marketing/ProductScreenshot";
import { FAQ } from "@/components/marketing/FAQ";
import { RelatedPages } from "@/components/marketing/RelatedPages";
import { CTA } from "@/components/marketing/CTA";
import type { Topic } from "@/lib/manifest";

const SAMPLE_MOVEMENTS = [
  { date: "01.09.2026", doc: "Boshlang‘ich qoldiq", debit: "12 000 000", credit: "—" },
  { date: "03.09.2026", doc: "Xaridordan bank tushumi", debit: "18 400 000", credit: "—" },
  { date: "18.09.2026", doc: "Yetkazib beruvchiga to‘lov", debit: "—", credit: "6 200 000" },
];

export default function Body({ topic }: { topic: Topic }) {
  const faq = topic.locales.uz.faq;
  return (
    <div className="space-y-12">
      <Hero
        h1={topic.locales.uz.h1}
        lead="Hisobvaraq kartochkasi bitta buxgalteriya hisobvarag‘i bo‘yicha davr davomidagi barcha harakatlarni — boshlang‘ich qoldiqdan yakuniy natijagacha — ko‘rsatadi."
      />

      <section aria-labelledby="h2-select">
        <h2 id="h2-select" className="text-xl font-semibold text-black">
          Hisobvaraq va davrni tanlash
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          Gap hisobvaraqlar rejasidagi hisobvaraq — «Pul mablag‘lari» yoki «Xaridorlar bilan hisob-kitob» kabi
          hisob toifasi — haqida bormoqda, tashkilotning aniq bank hisob-raqami emas. Kartochka sahifasida shu
          buxgalteriya hisobvarag‘i va davr ko‘rsatiladi — harakatlar shu parametrlar bo‘yicha shakllanadi.
        </p>
      </section>

      <section aria-labelledby="h2-movements">
        <h2 id="h2-movements" className="text-xl font-semibold text-black">
          Hisobvaraq harakatlari
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          Quyida — o‘ylab topilgan ma’lumotlar asosidagi misol: «Pul mablag‘lari» hisobvarag‘i kartochkasi sentyabr
          uchun. Bu mijozning haqiqiy ma’lumotlari emas, hisobot tuzilishini ko‘rsatuvchi namuna.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[480px] border-collapse text-left text-sm">
            <caption className="sr-only">Hisobvaraq kartochkasi misoli (o‘ylab topilgan ma’lumotlar)</caption>
            <thead>
              <tr className="border-b border-gray-300 text-xs uppercase text-gray-500">
                <th className="py-2 pr-4 font-medium">Sana</th>
                <th className="py-2 pr-4 font-medium">Operatsiya</th>
                <th className="py-2 pr-4 text-right font-medium">Debet</th>
                <th className="py-2 text-right font-medium">Kredit</th>
              </tr>
            </thead>
            <tbody>
              {SAMPLE_MOVEMENTS.map((row) => (
                <tr key={row.date + row.doc} className="border-b border-gray-100">
                  <td className="py-2 pr-4 text-gray-600">{row.date}</td>
                  <td className="py-2 pr-4 text-gray-700">{row.doc}</td>
                  <td className="py-2 pr-4 text-right text-gray-600">{row.debit}</td>
                  <td className="py-2 text-right text-gray-600">{row.credit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-gray-500">Summalar so‘mda, shartli 2026-yil sentyabr uchun demo-misol.</p>
      </section>

      <ProductScreenshot alt="Hisobvaraq kartochkasi: boshlang‘ich qoldiq, harakatlar va davr yakunlari" />

      <section aria-labelledby="h2-totals">
        <h2 id="h2-totals" className="text-xl font-semibold text-black">
          Natijalarni tekshirish
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          Kartochkada hisobvaraqning yakuniy qoldig‘i qanday shakllanganini ko‘rish mumkin: boshlang‘ich qoldiq
          ustiga davr davomidagi har bir debet va kredit o‘tkazmasi. Bu balans yoki ASQdagi muayyan summani
          tashkilotning barcha hujjatlari orasidan qidirmasdan tushunish uchun qulay. Hisobvaraq kartochkasini
          alohida eksport qilish funksiyasi hozircha tasdiqlanmagan — kartochka kabinetda ko‘rish uchun mavjud.
        </p>
      </section>

      <FAQ items={faq} locale="uz" />
      <RelatedPages topic={topic} locale="uz" />
      <CTA topicId={topic.id} locale="uz" location="bottom" />
    </div>
  );
}

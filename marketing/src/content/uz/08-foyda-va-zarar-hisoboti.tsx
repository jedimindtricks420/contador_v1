import { Hero } from "@/components/marketing/Hero";
import { FAQ } from "@/components/marketing/FAQ";
import { RelatedPages } from "@/components/marketing/RelatedPages";
import { CTA } from "@/components/marketing/CTA";
import type { Topic } from "@/lib/manifest";

const SAMPLE_ROWS = [
  { name: "Sotuvdan tushum", amount: "185 000 000" },
  { name: "Tannarx va to‘g‘ridan-to‘g‘ri xarajatlar", amount: "−96 000 000" },
  { name: "Ma’muriy xarajatlar", amount: "−41 200 000" },
  { name: "Davr uchun moliyaviy natija", amount: "47 800 000", bold: true },
];

export default function Body({ topic }: { topic: Topic }) {
  const faq = topic.locales.uz.faq;
  return (
    <div className="space-y-12">
      <Hero
        h1={topic.locales.uz.h1}
        lead="Foyda va zarar hisoboti tanlangan davr uchun biznesning daromadi, xarajatlari va moliyaviy natijasini ko‘rsatadi."
      />

      <section aria-labelledby="h2-period">
        <h2 id="h2-period" className="text-xl font-semibold text-black">
          Davr daromadlari va xarajatlari
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          Hisobot sahifasida davr tanlanadi — daromad va xarajatlar shu davrdagi hisob ma’lumotlari bo‘yicha
          ko‘rsatiladi. Quyida — o‘ylab topilgan ma’lumotlar asosidagi misol.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[420px] border-collapse text-left text-sm">
            <caption className="sr-only">Foyda va zarar hisoboti namunasi (o‘ylab topilgan ma’lumot)</caption>
            <tbody>
              {SAMPLE_ROWS.map((row) => (
                <tr key={row.name} className="border-b border-gray-100">
                  <td className={`py-2 pr-4 ${row.bold ? "font-semibold text-black" : "text-gray-700"}`}>{row.name}</td>
                  <td className={`py-2 text-right ${row.bold ? "font-semibold text-black" : "text-gray-700"}`}>{row.amount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-gray-500">Summalar so‘mda, demo ma’lumotlar shartli 2026-yil sentyabr uchun misol.</p>
      </section>


      <section aria-labelledby="h2-result">
        <h2 id="h2-result" className="text-xl font-semibold text-black">
          Moliyaviy natija
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          Moliyaviy natija — hisob ma’lumotlari bo‘yicha davr daromadlari va xarajatlari o‘rtasidagi farq: foyda
          yoki zarar. U tanlangan davrda siz provodka qilgan operatsiyalar bo‘yicha avtomatik hisoblanadi.
        </p>
      </section>

      <section aria-labelledby="h2-cash">
        <h2 id="h2-cash" className="text-xl font-semibold text-black">
          Nega foyda pul qoldig‘iga teng emas
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          Bu hisobotdagi foyda — davr uchun hisob ko‘rsatkichi, bank hisobvaraqlaridagi qoldiq esa shu paytdagi
          haqiqiy pul; ular, masalan, mijozdan to‘lov hali kelmagan bo‘lsa, sezilarli farq qilishi mumkin. Bank
          qoldig‘ini foyda deb qabul qilmaslik kerak. Farqni chuqurroq tushunish uchun uni shu davrdagi
          hisobvaraqlar ma’lumotlari bilan birga ko‘rish qulay.
        </p>
      </section>

      <FAQ items={faq} locale="uz" />
      <RelatedPages topic={topic} locale="uz" />
      <CTA topicId={topic.id} locale="uz" location="bottom" />
    </div>
  );
}

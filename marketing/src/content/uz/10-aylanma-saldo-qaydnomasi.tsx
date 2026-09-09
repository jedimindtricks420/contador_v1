import { Hero } from "@/components/marketing/Hero";
import { FAQ } from "@/components/marketing/FAQ";
import { RelatedPages } from "@/components/marketing/RelatedPages";
import { CTA } from "@/components/marketing/CTA";
import type { Topic } from "@/lib/manifest";

const SAMPLE_ROWS = [
  { name: "Hisobvaraqlardagi pul mablag‘lari", opening: "12 000 000", debit: "94 000 000", credit: "81 400 000", closing: "24 600 000" },
  { name: "Xaridorlar bilan hisob-kitoblar", opening: "6 500 000", debit: "112 000 000", credit: "104 300 000", closing: "14 200 000" },
  { name: "Yetkazib beruvchilar bilan hisob-kitoblar", opening: "3 100 000", debit: "58 600 000", credit: "61 000 000", closing: "5 500 000" },
];

export default function Body({ topic }: { topic: Topic }) {
  const faq = topic.locales.uz.faq;
  return (
    <div className="space-y-12">
      <Hero
        h1={topic.locales.uz.h1}
        lead="ASQ har bir hisobvaraq bo‘yicha boshlang‘ich qoldiq, aylanmalar va davr oxiridagi yakuniy saldoni ko‘rsatadi — hisob to‘liqligini tekshirishning asosiy vositasi."
      />

      <section aria-labelledby="h2-opening">
        <h2 id="h2-opening" className="text-xl font-semibold text-black">
          Davr boshidagi qoldiqlar
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          Quyida — o‘ylab topilgan ma’lumotlar asosidagi misol: uchta hisobvaraq, ularning boshlang‘ich qoldig‘i,
          aylanmalari va oy oxiridagi saldosi. Bu mijozning haqiqiy ma’lumotlari emas, hisobot tuzilishini
          ko‘rsatuvchi namuna.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-left text-sm">
            <caption className="sr-only">Aylanma-saldo qaydnomasi misoli (o‘ylab topilgan ma’lumotlar)</caption>
            <thead>
              <tr className="border-b border-gray-300 text-xs uppercase text-gray-500">
                <th className="py-2 pr-4 font-medium">Hisobvaraq</th>
                <th className="py-2 pr-4 text-right font-medium">Boshi</th>
                <th className="py-2 pr-4 text-right font-medium">Debet</th>
                <th className="py-2 pr-4 text-right font-medium">Kredit</th>
                <th className="py-2 text-right font-medium">Oxiri</th>
              </tr>
            </thead>
            <tbody>
              {SAMPLE_ROWS.map((row) => (
                <tr key={row.name} className="border-b border-gray-100">
                  <td className="py-2 pr-4 text-gray-700">{row.name}</td>
                  <td className="py-2 pr-4 text-right text-gray-600">{row.opening}</td>
                  <td className="py-2 pr-4 text-right text-gray-600">{row.debit}</td>
                  <td className="py-2 pr-4 text-right text-gray-600">{row.credit}</td>
                  <td className="py-2 text-right font-medium text-black">{row.closing}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-gray-500">Summalar so‘mda, shartli 2026-yil sentyabr uchun demo-misol.</p>
      </section>


      <section aria-labelledby="h2-turnover">
        <h2 id="h2-turnover" className="text-xl font-semibold text-black">
          Debet va kredit aylanmalari
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          Aylanmalar — bu davr davomida hisobvaraq bo‘yicha barcha o‘tkazmalarning debet va kredit summalari
          alohida. Ular oy davomidagi harakatni ko‘rsatadi, qoldiqni emas: masalan, katta debet va kredit aylanmasi
          bir vaqtda bo‘lishi, hisobvaraq orqali davrda ko‘p operatsiya o‘tganini, garchi yakuniy saldo unchalik
          o‘zgarmagan bo‘lsa ham, anglatishi mumkin.
        </p>
      </section>

      <section aria-labelledby="h2-closing">
        <h2 id="h2-closing" className="text-xl font-semibold text-black">
          Davr oxiridagi saldo
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          Davr oxiridagi saldo boshlang‘ich qoldiq va davr aylanmalaridan, faol va passiv hisobvaraqlar qoidalariga
          ko‘ra shakllanadi. Butun qaydnomaning debet va kredit itog‘lari tengligi ikki tomonlama yozuv balansini
          tasdiqlaydi, lekin har bir operatsiyaning to‘liqligi va to‘g‘riligini tekshirmaydi: agar biror hisobvaraq
          uchun boshlang‘ich qoldiq kiritilmagan bo‘lsa, ASQ shu hisobvaraq bo‘yicha pasaytirilgan qiymatlarni
          ko‘rsatadi, biroq itog‘lar tengligi saqlanadi.
        </p>
      </section>

      <FAQ items={faq} locale="uz" />
      <RelatedPages topic={topic} locale="uz" />
      <CTA topicId={topic.id} locale="uz" location="bottom" />
    </div>
  );
}

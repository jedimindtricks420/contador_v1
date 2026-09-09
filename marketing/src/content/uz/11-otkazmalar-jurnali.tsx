import { Hero } from "@/components/marketing/Hero";
import { FAQ } from "@/components/marketing/FAQ";
import { RelatedPages } from "@/components/marketing/RelatedPages";
import { CTA } from "@/components/marketing/CTA";
import type { Topic } from "@/lib/manifest";

const SAMPLE_ENTRIES = [
  { date: "03.09.2026", doc: "Bank tushumi", debit: "Pul mablag‘lari", credit: "Xaridorlar bilan hisob-kitob", amount: "18 400 000" },
  { date: "07.09.2026", doc: "Bank chiqimi", debit: "Yetkazib beruvchilar bilan hisob-kitob", credit: "Pul mablag‘lari", amount: "6 200 000" },
  { date: "12.09.2026", doc: "Avans hisoboti", debit: "Ma’muriy xarajatlar", credit: "Hisobdor summalar", amount: "1 150 000" },
];

export default function Body({ topic }: { topic: Topic }) {
  const faq = topic.locales.uz.faq;
  return (
    <div className="space-y-12">
      <Hero
        h1={topic.locales.uz.h1}
        lead="O‘tkazmalar jurnali davr uchun buxgalteriya yozuvlarini bitta joyda — sana, hisobvaraq va summalar bo‘yicha — to‘playdi."
      />

      <section aria-labelledby="h2-entries">
        <h2 id="h2-entries" className="text-xl font-semibold text-black">
          Jurnalda qanday yozuvlar ko‘rinadi
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          Quyida — o‘ylab topilgan ma’lumotlar asosidagi misol: sentyabr oyi uchun jurnalning uchta yozuvi. Bu
          mijozning haqiqiy ma’lumotlari emas, hisobot tuzilishini ko‘rsatuvchi namuna.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-left text-sm">
            <caption className="sr-only">O‘tkazmalar jurnali misoli (o‘ylab topilgan ma’lumotlar)</caption>
            <thead>
              <tr className="border-b border-gray-300 text-xs uppercase text-gray-500">
                <th className="py-2 pr-4 font-medium">Sana</th>
                <th className="py-2 pr-4 font-medium">Hujjat</th>
                <th className="py-2 pr-4 font-medium">Debet</th>
                <th className="py-2 pr-4 font-medium">Kredit</th>
                <th className="py-2 text-right font-medium">Summa</th>
              </tr>
            </thead>
            <tbody>
              {SAMPLE_ENTRIES.map((row) => (
                <tr key={row.date + row.doc} className="border-b border-gray-100">
                  <td className="py-2 pr-4 text-gray-600">{row.date}</td>
                  <td className="py-2 pr-4 text-gray-700">{row.doc}</td>
                  <td className="py-2 pr-4 text-gray-600">{row.debit}</td>
                  <td className="py-2 pr-4 text-gray-600">{row.credit}</td>
                  <td className="py-2 text-right font-medium text-black">{row.amount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-gray-500">Summalar so‘mda, shartli 2026-yil sentyabr uchun demo-misol.</p>
      </section>


      <section aria-labelledby="h2-check">
        <h2 id="h2-check" className="text-xl font-semibold text-black">
          Operatsiyani tekshirish
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          Jurnalni davr va boshqa mavjud filtrlar bo‘yicha filtrlash mumkin — xuddi hujjatlar ro‘yxatidagidek.
          Muayyan yozuvni tushunish uchun uni sana, hisobvaraq yoki summa bo‘yicha topib, tafsilotlarni ko‘rish
          uchun bog‘liq hujjatni oching.
        </p>
        <p className="mt-3 text-sm text-gray-600">
          Bu hujjatlarning joriy holatini aks ettiruvchi o‘tkazmalar jurnali, alohida o‘zgarmas huquqiy audit
          jurnali emas.
        </p>
      </section>

      <section aria-labelledby="h2-reports">
        <h2 id="h2-reports" className="text-xl font-semibold text-black">
          Hisobotlarga o‘tish
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          Jurnal yozuvlari boshqa hisobotlar uchun asos: aylanma-saldo qaydnomasi va hisobvaraq kartochkasi. Agar
          jurnaldan keyin muayyan hisobvaraq bo‘yicha ko‘rinish yoki qoldiqlarni solishtirish kerak bo‘lsa, bu
          hisobotlar xuddi shu o‘tkazmalar asosida shakllanadi.
        </p>
      </section>

      <FAQ items={faq} locale="uz" />
      <RelatedPages topic={topic} locale="uz" />
      <CTA topicId={topic.id} locale="uz" location="bottom" />
    </div>
  );
}

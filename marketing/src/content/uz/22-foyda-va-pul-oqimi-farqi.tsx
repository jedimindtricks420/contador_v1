import { Hero } from "@/components/marketing/Hero";
import { RelatedPages } from "@/components/marketing/RelatedPages";
import { CTA } from "@/components/marketing/CTA";
import type { Topic } from "@/lib/manifest";

// guide turi, bloklar tartibi — TASK-0003 §6. Kechiktirilgan to‘lov bilan
// o‘ziga xos misol — mavzu 22ning majburiy mazmuni. 08 (Foyda-zarar,
// /v2/pnl) va 09 (Pul oqimi, /v2/cashflow) hisobotlariga tayanadi. Misol
// soddalashtirilgan, soliq hisob-kitobisiz — matnda aniq aytilgan.
const TIMELINE = [
  { period: "Sentabr (xizmat ko‘rsatilgan)", pnl: "Daromad tan olindi: 10 000 000 so‘m", cash: "Tushum: 0 so‘m" },
  { period: "Oktabr (to‘lov olindi)", pnl: "Daromad qayta tan olinmaydi", cash: "Tushum: 10 000 000 so‘m" },
];

export default function Body({ topic }: { topic: Topic }) {
  return (
    <div className="space-y-12">
      <Hero
        h1={topic.locales.uz.h1}
        lead="Foyda va zarar hisobotidagi foyda — davr uchun hisob ko‘rsatkichi. Hisobvaraqdagi pul harakati esa to‘lov qachon haqiqatan kelib tushganiga bog‘liq. Kechiktirilgan to‘lov sababli bu ikki son bir oy uchun sezilarli farq qilishi mumkin."
      />

      <nav aria-label="Mundarija" className="text-sm">
        <p className="font-medium text-black">Mundarija</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-gray-600">
          <li><a href="#h2-two" className="underline hover:text-black">Ikki xil ko‘rsatkich</a></li>
          <li><a href="#h2-example" className="underline hover:text-black">Kechiktirilgan to‘lov misoli</a></li>
          <li><a href="#h2-together" className="underline hover:text-black">Qaysi hisobotlarni birga ko‘rish kerak</a></li>
        </ul>
      </nav>

      <section aria-labelledby="h2-two">
        <h2 id="h2-two" className="text-xl font-semibold text-black">
          Ikki xil ko‘rsatkich
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          Foyda va zarar hisoboti daromadni xizmat ko‘rsatilgan yoki tovar jo‘natilgan paytda ko‘rsatadi — pul
          kelib tushganmi yoki yo‘qmi, farqi yo‘q. Pul oqimi hisoboti esa pulni bank hisobvarag‘iga haqiqatan
          tushgan yoki chiqib ketgan paytda ko‘rsatadi. Bu bir xil biznesning turli qirralari va bir davr uchun mos
          kelishi shart emas.
        </p>
      </section>

      <section aria-labelledby="h2-example">
        <h2 id="h2-example" className="text-xl font-semibold text-black">
          Kechiktirilgan to‘lov misoli
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          O‘ylab topilgan soddalashtirilgan misol: 1-sentabrda kompaniya mijozga 10 000 000 so‘mlik xizmat
          ko‘rsatdi, to‘lov 30 kunga kechiktirildi. Pul haqiqatan faqat 1-oktabrda kelib tushdi.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-left text-sm">
            <caption className="sr-only">Misol: oylar bo‘yicha P&amp;L daromadi va pul tushumi</caption>
            <thead>
              <tr className="border-b border-gray-300 text-xs uppercase text-gray-500">
                <th className="py-2 pr-4 font-medium">Davr</th>
                <th className="py-2 pr-4 font-medium">Foyda va zarar hisoboti</th>
                <th className="py-2 font-medium">Pul oqimi</th>
              </tr>
            </thead>
            <tbody>
              {TIMELINE.map((row) => (
                <tr key={row.period} className="border-b border-gray-100">
                  <td className="py-2 pr-4 text-gray-700">{row.period}</td>
                  <td className="py-2 pr-4 text-gray-600">{row.pnl}</td>
                  <td className="py-2 text-gray-600">{row.cash}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-gray-500">
          Misol soddalashtirilgan: soliqlar va davrning boshqa operatsiyalarini hisobga olmaydi — faqat daromadni
          tan olish va pul harakati o‘rtasidagi farqni ko‘rsatadi.
        </p>
      </section>

      <section aria-labelledby="h2-together">
        <h2 id="h2-together" className="text-xl font-semibold text-black">
          Qaysi hisobotlarni birga ko‘rish kerak
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          Davr natijasini ham, hisobvaraqdagi haqiqiy pul holatini ham tushunish uchun foyda va zarar hisobotini pul
          oqimi hisoboti bilan birga ko‘rish kerak — foydali oy har doim hisobvaraqda pul borligini anglatmaydi va
          aksincha.
        </p>
      </section>

      <RelatedPages topic={topic} locale="uz" />
      <CTA topicId={topic.id} locale="uz" location="bottom" />
    </div>
  );
}

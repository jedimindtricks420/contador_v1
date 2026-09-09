import { Hero } from "@/components/marketing/Hero";
import { RelatedPages } from "@/components/marketing/RelatedPages";
import { CTA } from "@/components/marketing/CTA";
import type { Topic } from "@/lib/manifest";

// guide turi, bloklar tartibi — TASK-0003 §6. Ishonchlilik chegarasi raqami
// UI’da ko‘rsatilmaydi — bu yerda ham raqam aytilmaydi, mavjud bo‘lmagan
// indikator o‘ylab topilmasin. Uchta o‘ylab topilgan misol — mavzu 20ning
// "Majburiy mazmun" talabi. Chat-interfeys yo‘q.
const EXAMPLES = [
  {
    case: "O‘z hisobvaraqlari orasidagi o‘tkazma",
    suggested: "Standart operatsion toifa taklif qilinishi mumkin",
    check: "Bu haqiqatan ham kompaniya ichidagi o‘tkazma ekanligini tekshiring, daromad/xarajat emas — kerak bo‘lsa toifani qo‘lda tanlang",
  },
  {
    case: "Yetkazib beruvchiga avans",
    suggested: "Oddiy xarajatga yaqin toifa",
    check: "Bu aynan avans ekanligini aniqlashtiring, yakuniy to‘lov emas — bunday operatsiyalarni ochiq pozitsiyalar bilan solishtirish yaxshiroq",
  },
  {
    case: "Shartnoma bo‘yicha xizmat uchun oddiy to‘lov",
    suggested: "Toifa to‘lov maqsadiga mos keladi",
    check: "Odatda tezda tasdiqlash yetarli — to‘lov maqsadi aniq",
  },
];

export default function Body({ topic }: { topic: Topic }) {
  return (
    <div className="space-y-12">
      <Hero
        h1={topic.locales.uz.h1}
        lead="Avtomatik tasnifdan keyin taklif qilingan toifani to‘lov maqsadi, kontragent va summa bo‘yicha tekshiring. Tizim ishonch bilan ayta olmagan operatsiyalar avtomatik aniqlashtirish navbatiga tushadi va toifani qo‘lda tanlash talab qilinadi."
      />

      <nav aria-label="Mundarija" className="text-sm">
        <p className="font-medium text-black">Mundarija</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-gray-600">
          <li><a href="#h2-what" className="underline hover:text-black">Qaysi ma’lumotlarni solishtirish</a></li>
          <li><a href="#h2-example" className="underline hover:text-black">Noaniq to‘lovni tahlil qilish</a></li>
          <li><a href="#h2-confirm" className="underline hover:text-black">Natijani tasdiqlash</a></li>
        </ul>
      </nav>

      <section aria-labelledby="h2-what">
        <h2 id="h2-what" className="text-xl font-semibold text-black">
          Qaysi ma’lumotlarni solishtirish
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          Avval operatsiyalar qoidalar bo‘yicha tekshiriladi, qoidalar aniqlamagan qismini AI-tasniflagich qo‘shimcha
          qayta ishlaydi. AI tomonidan taklif qilingan toifa qoralama holatida qoladi — interfeys «AI taklifi» va
          foydalanuvchi «Tasdiqlagan»ini aniq ajratadi. Tekshirishda to‘lov maqsadi, kontragent va summaga e’tibor
          bering: taklif qilingan toifa haqiqatda sodir bo‘lgan voqeaga mos keladimi.
        </p>
      </section>

      <section aria-labelledby="h2-example">
        <h2 id="h2-example" className="text-xl font-semibold text-black">
          Noaniq to‘lovni tahlil qilish
        </h2>
        <p className="mt-3 text-sm text-gray-600">Uchta o‘ylab topilgan operatsiya misoli va tasdiqlashdan oldin nimani tekshirish kerakligi:</p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <caption className="sr-only">Operatsiya misollari va toifani tasdiqlashdan oldin nimani tekshirish kerak</caption>
            <thead>
              <tr className="border-b border-gray-300 text-xs uppercase text-gray-500">
                <th className="py-2 pr-4 font-medium">Operatsiya</th>
                <th className="py-2 pr-4 font-medium">Tizim nimani taklif qiladi</th>
                <th className="py-2 font-medium">Nimani tekshirish kerak</th>
              </tr>
            </thead>
            <tbody>
              {EXAMPLES.map((e) => (
                <tr key={e.case} className="border-b border-gray-100 align-top">
                  <td className="py-2 pr-4 text-gray-700">{e.case}</td>
                  <td className="py-2 pr-4 text-gray-600">{e.suggested}</td>
                  <td className="py-2 text-gray-600">{e.check}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="h2-confirm">
        <h2 id="h2-confirm" className="text-xl font-semibold text-black">
          Natijani tasdiqlash
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          Tasnif ishonchliligi belgilangan chegaradan past bo‘lganda, operatsiya avtomatik ravishda aniqlashtirish
          navbatiga tushadi — u yerda toifa qo‘lda tanlanadi. Siz tasdiqlagandan so‘ng toifa yakuniy hisoblanadi, AI
          taxmini emas, va operatsiya oyni yopish ustasining keyingi bosqichiga o‘tadi. Bu tekshirish navbati, dialog
          chat-interfeysi emas.
        </p>
      </section>

      <RelatedPages topic={topic} locale="uz" />
      <CTA topicId={topic.id} locale="uz" location="bottom" />
    </div>
  );
}

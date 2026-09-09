import { Hero } from "@/components/marketing/Hero";
import { RelatedPages } from "@/components/marketing/RelatedPages";
import { CTA } from "@/components/marketing/CTA";
import type { Topic } from "@/lib/manifest";

// guide turi, bloklar tartibi — TASK-0003 §6. O‘quvchi o‘zi baholaydigan
// bo‘sh ustunli mezonlar jadvali — 25-mavzuning majburiy mazmuni. Hech qanday
// o‘ylab topilgan reyting yoki raqobatchilar bilan solishtirish yo‘q.
const CRITERIA = [
  "Dastur qaysi bank ko‘chirmasi formatlarini haqiqatan import qiladi",
  "Operatsiyalar tasnifi qanday tekshiriladi — qo‘lda, qoidalar bo‘yicha, AI bilan",
  "Davrni yopishning tekshiruvlar bilan bosqichma-bosqich jarayoni bormi",
  "Qutidan qanday hisobotlar mavjud (balans, P&L, pul oqimi, ASQ)",
  "Bir nechta xodimning tashkilotga kirish huquqlari qanday tashkil etilgan",
  "Tarif qancha turadi va uning cheklovlari qanday",
];

export default function Body({ topic }: { topic: Topic }) {
  return (
    <div className="space-y-12">
      <Hero
        h1={topic.locales.uz.h1}
        lead="Buxgalteriya dasturini tanlash biznesingizning aniq vazifalariga bog‘liq: qaysi ko‘chirmalarni import qilish kerak, operatsiyalar qanday tekshiriladi, qaysi hisobotlar kerak va tizimda nechta xodim ishlaydi. Quyida — mustaqil tekshirish uchun mezonlar ro‘yxati, tayyor dasturlar reytingi emas."
      />

      <nav aria-label="Mundarija" className="text-sm">
        <p className="font-medium text-black">Mundarija</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-gray-600">
          <li><a href="#h2-tasks" className="underline hover:text-black">Vazifalar ro‘yxatini tuzing</a></li>
          <li><a href="#h2-scenario" className="underline hover:text-black">Jarayonni misolda tekshiring</a></li>
          <li><a href="#h2-compare" className="underline hover:text-black">Shartlar va cheklovlarni solishtiring</a></li>
        </ul>
      </nav>

      <section aria-labelledby="h2-tasks">
        <h2 id="h2-tasks" className="text-xl font-semibold text-black">
          Vazifalar ro‘yxatini tuzing
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          Dasturlarni solishtirishdan oldin haqiqiy vazifalaringizni yozib chiqing: nechta tashkilot yuritish kerak,
          kim ko‘chirmalarni tayyorlaydi, kim tasnifni tekshiradi, rahbarga qaysi hisobotlar kerak. Vazifalar
          ro‘yxati — keyingi qadamlar uchun asos.
        </p>
      </section>

      <section aria-labelledby="h2-scenario">
        <h2 id="h2-scenario" className="text-xl font-semibold text-black">
          Jarayonni misolda tekshiring
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          Bitta haqiqiy stsenariyni oling — masalan, «oy uchun ko‘chirmani yuklash → operatsiyalar tasnifini
          tekshirish → davrni yopish → foyda va zarar hisobotini olish» — va uni ko‘rib chiqilayotgan har bir
          dasturda demo-kirish orqali tekshiring. Contador’da bu stsenariy oyni yopish ustasi orqali o‘tadi:
          birinchi bosqichda ko‘chirma importi, ikkinchisida toifalarni aniqlashtirish, oxirgisida davrni yakunlash.
        </p>
      </section>

      <section aria-labelledby="h2-compare">
        <h2 id="h2-compare" className="text-xl font-semibold text-black">
          Shartlar va cheklovlarni solishtiring
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          Material Contador tomonidan tayyorlangan va aniq raqobatchilar bilan solishtirishni o‘z ichiga olmaydi —
          biz ularning haqiqiy imkoniyatlarini tekshirmaganmiz va boshqalarning ma’lumotlarini nashr qilmaymiz.
          Quyidagi jadvaldan foydalanib, ko‘rib chiqilayotgan har qanday dasturni, jumladan Contador’ni, bir xil
          mezonlar bo‘yicha mustaqil baholang.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[480px] border-collapse text-left text-sm">
            <caption className="sr-only">Buxgalteriya dasturini tanlash mezonlari va o‘z-o‘zini baholash uchun bo‘sh ustun</caption>
            <thead>
              <tr className="border-b border-gray-300 text-xs uppercase text-gray-500">
                <th className="py-2 pr-4 font-medium">Mezon</th>
                <th className="py-2 font-medium">Sizning bahoyingiz</th>
              </tr>
            </thead>
            <tbody>
              {CRITERIA.map((c) => (
                <tr key={c} className="border-b border-gray-100">
                  <td className="py-2 pr-4 text-gray-700">{c}</td>
                  <td className="py-2 text-gray-400">—</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-gray-500">«Sizning bahoyingiz» ustuni ataylab bo‘sh — uni har bir ko‘rib chiqilayotgan dastur uchun o‘zingiz to‘ldiring.</p>
      </section>

      <RelatedPages topic={topic} locale="uz" />
      <CTA topicId={topic.id} locale="uz" location="bottom" />
    </div>
  );
}

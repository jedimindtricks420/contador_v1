import { Hero } from "@/components/marketing/Hero";
import { FeatureSteps } from "@/components/marketing/FeatureSteps";
import { FAQ } from "@/components/marketing/FAQ";
import { RelatedPages } from "@/components/marketing/RelatedPages";
import { CTA } from "@/components/marketing/CTA";
import type { Topic } from "@/lib/manifest";

const STEPS = [
  { num: 1, title: "Oyni yopish ustasini oching", desc: "Import — «Yopish» bo‘limidagi ustaning birinchi bosqichi." },
  {
    num: 2,
    title: "Ko‘chirma faylini yuklang",
    desc: "1CClientBankExchange (.txt), 5 MiB va 1000 ta operatsiyagacha.",
  },
  {
    num: 3,
    title: "Import qilingan operatsiyalarni tekshiring",
    desc: "Yuklangan qatorlar tasnifga o‘tishdan oldin tekshirish uchun ko‘rsatiladi.",
  },
  {
    num: 4,
    title: "Xato bo‘lsa — importni bekor qiling",
    desc: "Egasi yoki administrator ishlov berilmagan importni hisob va ochiq davrlar o‘zgarmagan bo‘lsa bekor qilishi mumkin.",
  },
];

const SAMPLE_ROWS = [
  { date: "05.09.2026", amount: "12 500 000", type: "Tushum", note: "«Demo-Klient» MChJ, 14-son shartnoma bo‘yicha to‘lov" },
  { date: "07.09.2026", amount: "−3 200 000", type: "Chiqim", note: "Sentyabr uchun ofis ijarasi" },
  { date: "09.09.2026", amount: "−450 000", type: "Chiqim", note: "Bank komissiyasi" },
];

export default function Body({ topic }: { topic: Topic }) {
  const faq = topic.locales.uz.faq;
  return (
    <div className="space-y-12">
      <Hero
        h1={topic.locales.uz.h1}
        lead="1CClientBankExchange (.txt) bank ko‘chirmasini import qilish — Contador’da oyni yopish ustasining birinchi bosqichi. Ishlov berilmagan xato import hisob va davrlar holati tekshirilgandan keyin bekor qilinishi mumkin."
      />

      <section aria-labelledby="h2-formats">
        <h2 id="h2-formats" className="text-xl font-semibold text-black">
          Qaysi fayllar qo‘llab-quvvatlanadi
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          1CClientBankExchange (.txt), 5 MiB va 1000 ta operatsiyagacha qo‘llab-quvvatlanadi.
          Hisob raqami, davr, boshlang‘ich va yakuniy qoldiqlar talab qilinadi. Bankning Excel
          jadvallari hozir qabul qilinmaydi; kengaytmani almashtirish fayl formatini o‘zgartirmaydi.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[480px] border-collapse text-left text-sm">
            <caption className="sr-only">Bank ko‘chirmasi qatorlari namunasi (o‘ylab topilgan ma’lumot)</caption>
            <thead>
              <tr className="border-b border-gray-300 text-gray-500">
                <th scope="col" className="py-2 pr-4 font-medium">Sana</th>
                <th scope="col" className="py-2 pr-4 font-medium">Summa, so‘m</th>
                <th scope="col" className="py-2 pr-4 font-medium">Operatsiya turi</th>
                <th scope="col" className="py-2 font-medium">To‘lov maqsadi</th>
              </tr>
            </thead>
            <tbody>
              {SAMPLE_ROWS.map((row) => (
                <tr key={row.date + row.note} className="border-b border-gray-100">
                  <td className="py-2 pr-4 text-gray-700">{row.date}</td>
                  <td className="py-2 pr-4 text-gray-700">{row.amount}</td>
                  <td className="py-2 pr-4 text-gray-700">{row.type}</td>
                  <td className="py-2 text-gray-700">{row.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-gray-500">
          O‘ylab topilgan ma’lumotlar asosidagi namuna — mijozning haqiqiy ko‘chirmasi emas.
        </p>
      </section>


      <section aria-labelledby="h2-upload">
        <h2 id="h2-upload" className="text-xl font-semibold text-black">
          Yuklash va tekshirish
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          Import oyni yopish ustasining birinchi bosqichida amalga oshiriladi — kabinetda usta tashqarisida alohida
          import ekrani yo‘q. Fayl yuklangandan so‘ng operatsiyalar ustaning keyingi bosqichi — toifalarni
          aniqlashtirishga o‘tishdan oldin tekshirish uchun ro‘yxat ko‘rinishida ko‘rsatiladi.
        </p>
        <div className="mt-4">
          <FeatureSteps steps={STEPS} />
        </div>
      </section>

      <section aria-labelledby="h2-reimport">
        <h2 id="h2-reimport" className="text-xl font-semibold text-black">
          Takroriy import bilan ishlash
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          Egasi yoki administrator ishlov berilmagan importni bekor qilishi mumkin. Yopiq davr,
          o‘tkazilgan operatsiyalar yoki hisob holatining o‘zgarishi bekor qilishni bloklaydi.
          Asl ko‘chirma va protokol arxivda saqlanadi. Barcha banklarga API orqali ulanish qo‘llab-quvvatlanmaydi.
        </p>
      </section>

      <FAQ items={faq} locale="uz" />
      <RelatedPages topic={topic} locale="uz" />
      <CTA topicId={topic.id} locale="uz" location="bottom" />
    </div>
  );
}

import { Hero } from "@/components/marketing/Hero";
import { FAQ } from "@/components/marketing/FAQ";
import { RelatedPages } from "@/components/marketing/RelatedPages";
import { CTA } from "@/components/marketing/CTA";
import type { Topic } from "@/lib/manifest";

const EXAMPLES = [
  {
    payment: "*4521 kartaga o‘tkazma, maqsadi «shartnoma bo‘yicha»",
    suggested: "Boshqa xarajatlar",
    corrected: "Hisobdor shaxsga avans",
    note: "Qoidalar iborani aniqlamadi — AI past ishonchlilik bilan umumiy toifani taklif qildi, foydalanuvchi qo‘lda aniqlashtirdi.",
  },
  {
    payment: "«Demo-Klient» MChJ’dan tushum, 14-son shartnoma",
    suggested: "Sotuvdan tushum",
    corrected: "Sotuvdan tushum",
    note: "Toifa yuqori ishonchlilik bilan taklif qilindi va o‘zgarishsiz tasdiqlandi.",
  },
  {
    payment: "Boshqa bankdagi o‘z hisobiga chiqim",
    suggested: "Boshqa xarajatlar",
    corrected: "Pul mablag‘larining ichki harakati",
    note: "O‘z hisobvaraqlari orasidagi o‘tkazma — qoidalar va AI bunday o‘tkazmalarni avtomatik ajratmaydi, qo‘lda tasnif kerak.",
  },
];

export default function Body({ topic }: { topic: Topic }) {
  const faq = topic.locales.uz.faq;
  return (
    <div className="space-y-12">
      <Hero
        h1={topic.locales.uz.h1}
        lead="Operatsiyalarning bir qismini qoidalar tasniflaydi, qolganini AI-tasniflagich tekshiradi. Taklif qilingan toifa siz tasdiqlaguningizcha qoralama bo‘lib qoladi."
      />

      <section aria-labelledby="h2-how">
        <h2 id="h2-how" className="text-xl font-semibold text-black">
          Qoidalar va AI qanday ishlaydi
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          Tasnif oyni yopish ustasining 2-bosqichida — «Toifalarni aniqlashtirish»da amalga oshiriladi; usta
          tashqarisida alohida tasnif ekrani yo‘q. Avval operatsiyalar qoidalar bo‘yicha tekshiriladi; qoidalar
          aniqlamagan qismini AI-tasniflagich qo‘shimcha qayta ishlaydi. Bu dialog chat emas — interfeys tekshirish
          uchun taklif qilingan toifali operatsiyalar navbatini ko‘rsatadi.
        </p>
      </section>


      <section aria-labelledby="h2-check">
        <h2 id="h2-check" className="text-xl font-semibold text-black">
          Natijani tekshirish
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          Quyida — o‘ylab topilgan ma’lumotlar asosidagi uchta namunaviy operatsiya: taklif qilingan toifa qanday
          ko‘rinishi va foydalanuvchi tekshiruvidan keyin nima chiqishi.
        </p>
        <div className="mt-4 space-y-3">
          {EXAMPLES.map((ex) => (
            <div key={ex.payment} className="rounded border border-gray-200 p-4">
              <p className="text-sm text-gray-500">{ex.payment}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                <span className="rounded bg-[var(--muted-bg)] px-2 py-1 text-gray-600">
                  AI taklifi: {ex.suggested}
                </span>
                <span aria-hidden className="text-gray-400">→</span>
                <span className="rounded bg-black px-2 py-1 font-medium text-white">
                  Tasdiqlangan: {ex.corrected}
                </span>
              </div>
              <p className="mt-2 text-xs text-gray-500">{ex.note}</p>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="h2-clarify">
        <h2 id="h2-clarify" className="text-xl font-semibold text-black">
          Qachon aniqlashtirish kerak
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          Tasnif ishonchliligi belgilangan chegaradan past bo‘lganda, operatsiya aniqlashtirish navbatiga tushadi va
          toifani qo‘lda tanlash kerak bo‘ladi. Bu tizim xatosi degani emas — ba’zi operatsiyalar (masalan, o‘z
          hisoblari orasidagi o‘tkazmalar yoki noaniq iboradagi to‘lovlar) haqiqatan ham inson qarorini talab qiladi.
          AI xatosizlikni kafolatlamaydi va buxgalterni almashtirmaydi — u odatiy operatsiyalarni tezroq qayta
          ishlashga yordam beradi.
        </p>
      </section>

      <FAQ items={faq} locale="uz" />
      <RelatedPages topic={topic} locale="uz" />
      <CTA topicId={topic.id} locale="uz" location="bottom" />
    </div>
  );
}

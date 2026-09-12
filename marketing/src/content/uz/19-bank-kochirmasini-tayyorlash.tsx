import { Hero } from "@/components/marketing/Hero";
import { FeatureSteps } from "@/components/marketing/FeatureSteps";
import { RelatedPages } from "@/components/marketing/RelatedPages";
import { CTA } from "@/components/marketing/CTA";
import type { Topic } from "@/lib/manifest";

// guide turi, bloklar tartibi — TASK-0003 §6. 03-mavzudan farqli o‘quv
// intenti (§6: "03 importni sotadi / 19 faylni tayyorlashni o‘rgatadi").
const STEPS = [
  { num: 1, title: "Bank-klientdan ko‘chirmani yuklab oling", desc: "1CClientBankExchange (.txt), 5 MiB va 1000 ta operatsiyagacha." },
  { num: 2, title: "Format va davrni tekshiring", desc: "Fayl aynan kerakli davrni qamrab olishi kerak — yuklashda sana bo‘yicha filtr yo‘q." },
  { num: 3, title: "Yakuniy summalarni solishtiring", desc: "Bank ko‘chirmasidagi boshlang‘ich va yakuniy qoldiqni kutilgan qiymatlar bilan solishtiring." },
  { num: 4, title: "Oyni yopish ustasining 1-bosqichida yuklang", desc: "Import — «Yopish» bo‘limidagi oyni yopish ustasining birinchi bosqichi." },
];

const COLUMNS = [
  { field: "Operatsiya sanasi", note: "Operatsiya kerakli davrga tushishi uchun zarur" },
  { field: "Summa", note: "Musbat — tushum, manfiy — chiqim" },
  { field: "To‘lov maqsadi", note: "Qoidalar va AI tavsiya etilgan toifani shu maydon asosida tanlaydi" },
];

const MISTAKES = [
  {
    problem: "Fayl qo‘llab-quvvatlanmaydigan formatda saqlangan (masalan, brauzerdan .csv)",
    cause: "Bank importi faqat 1CClientBankExchange (.txt) formatini qabul qiladi",
    fix: "Ko‘chirmani bank-klientdan 1CClientBankExchange formatida qayta oling; Excel yoki CSV kengaytmasini almashtirmang",
  },
  {
    problem: "Bitta ko‘chirma ikki marta yuklangan",
    cause: "Takroriy qatorlar tekshiriladi; yuklash natijasini solishtirish kerak",
    fix: "Protokolni tekshiring. Egasi yoki administrator ishlov berilmagan xato importni hisob va davr holati tekshiruvlaridan keyin bekor qilishi mumkin",
  },
  {
    problem: "Faylda bir necha oy operatsiyalari birga",
    cause: "Import bosqichida sana bo‘yicha filtr yo‘q — faylda nima bo‘lsa, hammasi yuklanadi",
    fix: "Contador’ga yuklashdan oldin bank-klientdan aynan kerakli davr uchun alohida fayl yuklab oling",
  },
];

export default function Body({ topic }: { topic: Topic }) {
  return (
    <div className="space-y-12">
      <Hero
        h1={topic.locales.uz.h1}
        lead="Yuklashdan oldin 1CClientBankExchange (.txt) formatini tekshiring, fayl kerakli davrni qamrab olishiga ishonch hosil qiling va yakuniy summalarni bank ma’lumotlari bilan solishtiring — bu oyni yopish ustasining birinchi bosqichidagi xatolar sonini kamaytiradi."
      />

      <nav aria-label="Mundarija" className="text-sm">
        <p className="font-medium text-black">Mundarija</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-gray-600">
          <li><a href="#h2-format" className="underline hover:text-black">Format va davrni tekshiring</a></li>
          <li><a href="#h2-amounts" className="underline hover:text-black">Summalarni solishtiring</a></li>
          <li><a href="#h2-errors" className="underline hover:text-black">Yuklash xatosini aniqlang</a></li>
        </ul>
      </nav>

      <section aria-labelledby="h2-format">
        <h2 id="h2-format" className="text-xl font-semibold text-black">
          Format va davrni tekshiring
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          Contador 1CClientBankExchange (.txt), 5 MiB va 1000 ta operatsiyagacha qabul qiladi.
          Hisob raqami, davr va nazorat qoldiqlari talab qilinadi. Bank ko‘chirmalari uchun Excel qabul qilinmaydi.
          Sana bo‘yicha alohida filtr yo‘q: oldindan aynan kerakli davr uchun fayl yuklab oling.
        </p>
        <div className="mt-4">
          <FeatureSteps steps={STEPS} />
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[420px] border-collapse text-left text-sm">
            <caption className="sr-only">Ko‘chirma faylida qaysi maydonlar muhim</caption>
            <thead>
              <tr className="border-b border-gray-300 text-xs uppercase text-gray-500">
                <th className="py-2 pr-4 font-medium">Maydon</th>
                <th className="py-2 font-medium">Nima uchun kerak</th>
              </tr>
            </thead>
            <tbody>
              {COLUMNS.map((c) => (
                <tr key={c.field} className="border-b border-gray-100">
                  <td className="py-2 pr-4 text-gray-700">{c.field}</td>
                  <td className="py-2 text-gray-600">{c.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="h2-amounts">
        <h2 id="h2-amounts" className="text-xl font-semibold text-black">
          Summalarni solishtiring
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          Misol: yuklashdan oldin ko‘chirmaning o‘zida (yoki bank-klientda) davr boshi va oxiridagi qoldiqni ko‘ring.
          Masalan, davr boshidagi qoldiq 12 000 000 so‘m, davrdagi tushumlar 94 000 000, chiqimlar 81 400 000 bo‘lsa,
          davr oxiridagi qoldiq 24 600 000 bo‘lishi kerak. Agar ko‘chirmadagi yakuniy summa bu hisob-kitobga mos
          kelmasa — fayl bank-klientdan yuklab olinganda ba’zi operatsiyalar tushmagan bo‘lishi mumkin, shuning uchun
          Contador’ga yuklashdan oldin ko‘chirmani qayta yuklab olish kerak.
        </p>
      </section>

      <section aria-labelledby="h2-errors">
        <h2 id="h2-errors" className="text-xl font-semibold text-black">
          Yuklash xatosini aniqlang
        </h2>
        <p className="mt-3 text-sm text-gray-600">Ko‘chirmani tayyorlashda uchraydigan uchta xato va ularni tuzatish:</p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <caption className="sr-only">Ko‘chirma yuklashdagi keng tarqalgan xatolar va tuzatishlar</caption>
            <thead>
              <tr className="border-b border-gray-300 text-xs uppercase text-gray-500">
                <th className="py-2 pr-4 font-medium">Muammo</th>
                <th className="py-2 pr-4 font-medium">Sabab</th>
                <th className="py-2 font-medium">Qanday tuzatish kerak</th>
              </tr>
            </thead>
            <tbody>
              {MISTAKES.map((m) => (
                <tr key={m.problem} className="border-b border-gray-100 align-top">
                  <td className="py-2 pr-4 text-gray-700">{m.problem}</td>
                  <td className="py-2 pr-4 text-gray-600">{m.cause}</td>
                  <td className="py-2 text-gray-600">{m.fix}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <RelatedPages topic={topic} locale="uz" />
      <CTA topicId={topic.id} locale="uz" location="bottom" />
    </div>
  );
}

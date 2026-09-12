import { Hero } from "@/components/marketing/Hero";
import { FeatureSteps } from "@/components/marketing/FeatureSteps";
import { RelatedPages } from "@/components/marketing/RelatedPages";
import { CTA } from "@/components/marketing/CTA";
import type { Topic } from "@/lib/manifest";

// guide turi, bloklar tartibi — TASK-0003 §6. "Nima qo‘llab-quvvatlanadigan
// usulda ko‘chiriladi / nima tayyorlashni talab qiladi" jadvali — 30-mavzuning
// majburiy mazmuni. Excel bo‘yicha bir bosishda konvertatsiya haqida va’da
// berilmaydi — faqat ma’lumotlarni tayyorlash rejasi.
const TRANSFER = [
  { what: "Bank operatsiyalari", how: "Oyni yopish ustasining birinchi bosqichida 1CClientBankExchange (.txt) ko‘chirmasini import qilish" },
  { what: "Hisobvaraqlar bo‘yicha boshlang‘ich qoldiqlar", how: "Tayyorlashni talab qiladi — qo‘lda yig‘ilib, «Boshlang‘ich qoldiqlar» sozlamalar bo‘limiga kiritiladi" },
  { what: "Excel jadvallaringizning tarixiy tuzilishi", how: "Tayyorlashni talab qiladi — Contador ixtiyoriy foydalanuvchi jadvallarini o‘qimaydi, faqat qo‘llab-quvvatlanadigan ko‘chirma formatini" },
  { what: "O‘tgan operatsiyalar bo‘yicha o‘tkazmalar", how: "Tayyorlashni talab qiladi — faqat yig‘ilgan boshlang‘ich qoldiqlar orqali ko‘chiriladi, hujjatma-hujjat emas" },
];

const STEPS = [
  { num: 1, title: "Hisob boshlanish sanasini tanlang", desc: "Odatda oy yoki chorak boshi — shu sanadan Contador operatsiyalarni batafsil yuritadi." },
  { num: 2, title: "Boshlang‘ich qoldiqlarni yig‘ing", desc: "Hisobvaraqlar, kontragentlar va avanslar bo‘yicha tanlangan sanaga — boshlang‘ich qoldiqlar qo‘llanmasiga qarang." },
  { num: 3, title: "Bank ko‘chirmalarini tayyorlang", desc: "Boshlanish sanasidan keyingi davrlar uchun 1CClientBankExchange (.txt) formatida." },
  { num: 4, title: "Yuklang va birinchi davrni solishtiring", desc: "Ko‘chirmani import qiling, qoldiqlarni kiriting va birinchi hisobotni jadvallaringiz bilan solishtiring." },
];

export default function Body({ topic }: { topic: Topic }) {
  return (
    <div className="space-y-12">
      <Hero
        h1={topic.locales.uz.h1}
        lead="Jadvallardan Contador’ga o‘tish — Excel-buxgalteriyangizni bir bosishda avtomatik konvertatsiya qilish emas. Ma’lumotlarning bir qismi qo‘llab-quvvatlanadigan usulda ko‘chiriladi, bir qismini esa ishni boshlashdan oldin qo‘lda tayyorlash kerak."
      />

      <nav aria-label="Mundarija" className="text-sm">
        <p className="font-medium text-black">Mundarija</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-gray-600">
          <li><a href="#h2-scope" className="underline hover:text-black">Ko‘chirish chegaralarini belgilang</a></li>
          <li><a href="#h2-prepare" className="underline hover:text-black">Qoldiqlar va ko‘chirmalarni tayyorlang</a></li>
          <li><a href="#h2-verify" className="underline hover:text-black">Birinchi davrni tekshiring</a></li>
        </ul>
      </nav>

      <section aria-labelledby="h2-scope">
        <h2 id="h2-scope" className="text-xl font-semibold text-black">
          Ko‘chirish chegaralarini belgilang
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          Boshlashdan oldin nima avtomatik ko‘chirilishini va nimani o‘zingiz tayyorlash kerakligini tushunish
          muhim:
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[600px] border-collapse text-left text-sm">
            <caption className="sr-only">Nima qo‘llab-quvvatlanadigan usulda ko‘chiriladi, nima tayyorlashni talab qiladi</caption>
            <thead>
              <tr className="border-b border-gray-300 text-xs uppercase text-gray-500">
                <th className="py-2 pr-4 font-medium">Nima</th>
                <th className="py-2 font-medium">Qanday ko‘chiriladi</th>
              </tr>
            </thead>
            <tbody>
              {TRANSFER.map((row) => (
                <tr key={row.what} className="border-b border-gray-100 align-top">
                  <td className="py-2 pr-4 text-gray-700">{row.what}</td>
                  <td className="py-2 text-gray-600">{row.how}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="h2-prepare">
        <h2 id="h2-prepare" className="text-xl font-semibold text-black">
          Qoldiqlar va ko‘chirmalarni tayyorlang
        </h2>
        <div className="mt-4">
          <FeatureSteps steps={STEPS} />
        </div>
      </section>

      <section aria-labelledby="h2-verify">
        <h2 id="h2-verify" className="text-xl font-semibold text-black">
          Birinchi davrni tekshiring
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          Birinchi ko‘chirmani yuklab, boshlang‘ich qoldiqlarni kiritgandan so‘ng, birinchi davr uchun
          aylanma-saldo qaydnomasi yoki balansni avvalgi jadvallaringiz bilan solishtiring. Agar summalar mos
          kelmasa — sabab ko‘pincha to‘liq bo‘lmagan boshlang‘ich qoldiqlarda yoki kerakli davrni qamrab olmagan
          ko‘chirmada, o‘tishning o‘zida emas.
        </p>
      </section>

      <RelatedPages topic={topic} locale="uz" />
      <CTA topicId={topic.id} locale="uz" location="bottom" />
    </div>
  );
}

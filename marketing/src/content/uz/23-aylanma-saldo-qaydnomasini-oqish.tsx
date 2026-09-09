import { Hero } from "@/components/marketing/Hero";
import { RelatedPages } from "@/components/marketing/RelatedPages";
import { CTA } from "@/components/marketing/CTA";
import type { Topic } from "@/lib/manifest";

// guide turi, bloklar tartibi — TASK-0003 §6. Izohli shaxsiy jadval (mijoz
// ma’lumotlari emas), tuzilishi 10-mavzu bilan solishtirilgan.
const ROW = { name: "Xaridorlar bilan hisob-kitoblar", opening: "6 500 000", debit: "12 000 000", credit: "9 800 000", closing: "8 700 000" };

export default function Body({ topic }: { topic: Topic }) {
  return (
    <div className="space-y-12">
      <Hero
        h1={topic.locales.uz.h1}
        lead="Aylanma-saldo qaydnomasida har bir hisobvaraq to‘rtta ustunga ega: boshlang‘ich qoldiq, debet aylanmasi, kredit aylanmasi va davr oxiridagi qoldiq. Ularni bitta izohli misolda ko‘rib chiqamiz."
      />

      <nav aria-label="Mundarija" className="text-sm">
        <p className="font-medium text-black">Mundarija</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-gray-600">
          <li><a href="#h2-columns" className="underline hover:text-black">Har bir ustun nimani anglatadi</a></li>
          <li><a href="#h2-example" className="underline hover:text-black">Hisobvaraq harakati misoli</a></li>
          <li><a href="#h2-caveat" className="underline hover:text-black">Nega jami tengligi yetarli emas</a></li>
        </ul>
      </nav>

      <section aria-labelledby="h2-columns">
        <h2 id="h2-columns" className="text-xl font-semibold text-black">
          Har bir ustun nimani anglatadi
        </h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-gray-600">
          <li><strong className="text-black">Boshlang‘ich qoldiq</strong> — davr boshida hisobvaraqda qancha bo‘lgan: kiritilgan boshlang‘ich qoldiqlar yoki oldingi davrdan ko‘chirilgan qiymat.</li>
          <li><strong className="text-black">Debet aylanmasi</strong> — davr uchun hisobvaraq debeti bo‘yicha barcha o‘tkazmalar summasi.</li>
          <li><strong className="text-black">Kredit aylanmasi</strong> — davr uchun hisobvaraq krediti bo‘yicha barcha o‘tkazmalar summasi.</li>
          <li><strong className="text-black">Davr oxiridagi qoldiq</strong> — boshlang‘ich qoldiq va davr aylanmalari yig‘indisi, hisobvaraq faol yoki passiv ekanligiga qarab.</li>
        </ul>
      </section>

      <section aria-labelledby="h2-example">
        <h2 id="h2-example" className="text-xl font-semibold text-black">
          Hisobvaraq harakati misoli
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          O‘ylab topilgan misol — «Xaridorlar bilan hisob-kitoblar» hisobvarag‘i (faol hisobvaraq, qoldiq debet
          bo‘yicha o‘sadi):
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-left text-sm">
            <caption className="sr-only">Bitta hisobvaraq bo‘yicha izohli ASQ misoli</caption>
            <thead>
              <tr className="border-b border-gray-300 text-xs uppercase text-gray-500">
                <th className="py-2 pr-4 font-medium">Boshlanish</th>
                <th className="py-2 pr-4 font-medium">Debet</th>
                <th className="py-2 pr-4 font-medium">Kredit</th>
                <th className="py-2 font-medium">Oxiri</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="py-2 pr-4 text-gray-700">{ROW.opening}</td>
                <td className="py-2 pr-4 text-gray-700">{ROW.debit}</td>
                <td className="py-2 pr-4 text-gray-700">{ROW.credit}</td>
                <td className="py-2 font-medium text-black">{ROW.closing}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-sm text-gray-600">
          Hisob-kitob: 6 500 000 (boshlanish) + 12 000 000 (mijozlarga yangi hisob-fakturalar, debet) − 9 800 000
          (mijozlardan olingan to‘lovlar, kredit) = 8 700 000 (oxiri). Debet aylanmasi bu yerda — taqdim etilgan
          hisob-fakturalar, kredit aylanmasi — olingan to‘lovlar.
        </p>
      </section>

      <section aria-labelledby="h2-caveat">
        <h2 id="h2-caveat" className="text-xl font-semibold text-black">
          Nega jami tengligi yetarli emas
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          Butun qaydnomaning debet va kredit itog‘lari tengligi ikki tomonlama yozuv balansini tasdiqlaydi, lekin har
          bir operatsiyaning to‘liqligi va to‘g‘riligini tekshirmaydi. Agar biror hisobvaraq uchun boshlang‘ich
          qoldiq kiritilmagan bo‘lsa, ASQ aynan shu hisobvaraq bo‘yicha pasaytirilgan qiymatlarni ko‘rsatadi, biroq
          butun qaydnoma bo‘yicha itog‘lar tengligi saqlanadi.
        </p>
      </section>

      <RelatedPages topic={topic} locale="uz" />
      <CTA topicId={topic.id} locale="uz" location="bottom" />
    </div>
  );
}

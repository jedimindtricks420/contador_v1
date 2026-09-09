import { Hero } from "@/components/marketing/Hero";
import { FAQ } from "@/components/marketing/FAQ";
import { RelatedPages } from "@/components/marketing/RelatedPages";
import { CTA } from "@/components/marketing/CTA";
import type { Topic } from "@/lib/manifest";

const SAMPLE_INFLOWS = [
  { name: "Xaridorlardan to‘lov", amount: "112 000 000" },
  { name: "Boshqa tushumlar", amount: "3 400 000" },
];
const SAMPLE_OUTFLOWS = [
  { name: "Yetkazib beruvchilarga to‘lov", amount: "58 600 000" },
  { name: "Ish haqi", amount: "24 000 000" },
  { name: "Soliq va majburiy to‘lovlar", amount: "9 100 000" },
];

export default function Body({ topic }: { topic: Topic }) {
  const faq = topic.locales.uz.faq;
  return (
    <div className="space-y-12">
      <Hero
        h1={topic.locales.uz.h1}
        lead="Pul oqimi hisoboti tanlangan davrdagi bank hisobvaraqlari bo‘yicha haqiqiy tushum va chiqimlarni ko‘rsatadi."
      />

      <section aria-labelledby="h2-flows">
        <h2 id="h2-flows" className="text-xl font-semibold text-black">
          Pul tushumlari va chiqimlari
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          Quyida — o‘ylab topilgan ma’lumotlar asosidagi misol: tashkilotning bir oylik tushum va chiqimlari. Bu
          mijozning haqiqiy ma’lumotlari emas, hisobot tuzilishini ko‘rsatuvchi namuna.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="rounded border border-gray-200 p-4">
            <p className="text-sm font-medium text-black">Tushumlar</p>
            <ul className="mt-2 space-y-1 text-sm text-gray-600">
              {SAMPLE_INFLOWS.map((row) => (
                <li key={row.name} className="flex justify-between gap-3">
                  <span>{row.name}</span>
                  <span className="text-gray-500">{row.amount}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded border border-gray-200 p-4">
            <p className="text-sm font-medium text-black">Chiqimlar</p>
            <ul className="mt-2 space-y-1 text-sm text-gray-600">
              {SAMPLE_OUTFLOWS.map((row) => (
                <li key={row.name} className="flex justify-between gap-3">
                  <span>{row.name}</span>
                  <span className="text-gray-500">{row.amount}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <p className="mt-2 text-xs text-gray-500">Summalar so‘mda, shartli 2026-yil sentyabr uchun demo-misol.</p>
      </section>


      <section aria-labelledby="h2-filters">
        <h2 id="h2-filters" className="text-xl font-semibold text-black">
          Davr va bank hisobvaraqlari
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          Hisobotda davr tanlanadi, tushum va chiqimlar esa shu davrda Contador’ga yuklangan va taqsimlangan
          tashkilot bank operatsiyalari asosida hisoblanadi. Hisobot faqat o‘tgan operatsiyalarni aks ettiradi —
          kelajakdagi tushum va chiqimlarni prognoz qilish servisda yo‘q.
        </p>
      </section>

      <section aria-labelledby="h2-profit">
        <h2 id="h2-profit" className="text-xl font-semibold text-black">
          Foyda bilan bog‘liqlik
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          Pul harakati va moliyaviy natija — bir biznesning turli qirralari: pul oqimi hisobvaraqlardagi haqiqiy
          pulni, foyda va zarar hisoboti esa davrning hisob natijasini ko‘rsatadi. Farq qayerdan kelib
          chiqayotganini tushunish uchun ikkala hisobotni bir xil davr bo‘yicha birga ko‘rish foydali.
        </p>
      </section>

      <FAQ items={faq} locale="uz" />
      <RelatedPages topic={topic} locale="uz" />
      <CTA topicId={topic.id} locale="uz" location="bottom" />
    </div>
  );
}

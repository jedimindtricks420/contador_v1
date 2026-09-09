import { CTA } from "@/components/marketing/CTA";
import { FAQ } from "@/components/marketing/FAQ";
import { RelatedPages } from "@/components/marketing/RelatedPages";
import { Hero } from "@/components/marketing/Hero";
import { getProPriceYearly } from "@/lib/pricing";
import type { Topic } from "@/lib/manifest";

function formatSum(n: number): string {
  return `${n.toLocaleString("ru-RU")} so‘m`;
}

export default async function Body({ topic }: { topic: Topic }) {
  const { price, source } = await getProPriceYearly();
  const faq = topic.locales.uz.faq;

  return (
    <div className="space-y-12">
      <Hero h1={topic.locales.uz.h1} lead="Ikkita tarif: boshlash uchun FREE va AI hamda bir nechta tashkilot bilan kengaytirilgan ish uchun PRO." />

      <section aria-labelledby="h2-price">
        <h2 id="h2-price" className="text-xl font-semibold text-black">
          Narx va to‘lov davri
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="rounded border border-gray-200 p-6">
            <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">FREE</p>
            <p className="mt-2 text-2xl font-bold text-black">0 so‘m</p>
            <p className="mt-1 text-sm text-gray-500">muddatsiz</p>
          </div>
          <div className="rounded border border-black p-6">
            <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">PRO</p>
            <p className="mt-2 text-2xl font-bold text-black">{formatSum(price)}</p>
            <p className="mt-1 text-sm text-gray-500">365 kunlik kirish huquqi uchun</p>
            {source === "fallback" && (
              <p className="mt-2 text-xs text-gray-400">
                Ma’lumot uchun narx ko‘rsatilgan — sahifa yig‘ilgan paytda amaldagi narxni olib bo‘lmadi.
              </p>
            )}
          </div>
        </div>
      </section>

      <section aria-labelledby="h2-includes">
        <h2 id="h2-includes" className="text-xl font-semibold text-black">
          Tarifga nimalar kiradi
        </h2>
        <div className="table-container mt-4">
          <table className="w-full text-left">
            <thead>
              <tr>
                <th className="table-header">Imkoniyat</th>
                <th className="table-header">FREE</th>
                <th className="table-header">PRO</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="table-cell">Tashkilotlar soni</td>
                <td className="table-cell">1</td>
                <td className="table-cell">birdan ortiq</td>
              </tr>
              <tr>
                <td className="table-cell">AI-operatsiya tasnifi</td>
                <td className="table-cell">yo‘q</td>
                <td className="table-cell">bor</td>
              </tr>
              <tr>
                <td className="table-cell">AI-solishtirish</td>
                <td className="table-cell">yo‘q</td>
                <td className="table-cell">bor</td>
              </tr>
              <tr>
                <td className="table-cell">Qo‘lda tasnif, o‘tkazmalar, hisobotlar, tekshiruv ro‘yxati va kalkulyatorlar</td>
                <td className="table-cell">bor</td>
                <td className="table-cell">bor</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="h2-payment">
        <h2 id="h2-payment" className="text-xl font-semibold text-black">
          To‘lov bo‘yicha savollar
        </h2>
        <p className="mt-3 text-sm text-gray-600">To‘lov Payme, Click va Alifpay orqali qabul qilinadi.</p>
      </section>

      <FAQ items={faq} locale="uz" />
      <RelatedPages topic={topic} locale="uz" />
      <CTA topicId={topic.id} locale="uz" location="pricing" withLogin />
    </div>
  );
}

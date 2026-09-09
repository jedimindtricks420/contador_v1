import { CTA } from "@/components/marketing/CTA";
import { FAQ } from "@/components/marketing/FAQ";
import { RelatedPages } from "@/components/marketing/RelatedPages";
import { Hero } from "@/components/marketing/Hero";
import { getProPriceYearly } from "@/lib/pricing";
import type { Topic } from "@/lib/manifest";

function formatSum(n: number): string {
  return `${n.toLocaleString("ru-RU")} сум`;
}

// Тип pricing, порядок блоков — TASK-0003 §6: Название → подтверждённые
// цены/лимиты → сравнение → оплата → FAQ. Цена запрашивается у admin-сервиса
// на сервере (см. src/lib/pricing.ts) — страница не статична по цене, хотя
// сама генерируется статически/по ISR.
export default async function Body({ topic }: { topic: Topic }) {
  const { price, source } = await getProPriceYearly();
  const faq = topic.locales.ru.faq;

  return (
    <div className="space-y-12">
      <Hero h1={topic.locales.ru.h1} lead="Два тарифа: FREE для старта и PRO для расширенной работы с AI и несколькими организациями." />

      <section aria-labelledby="h2-price">
        <h2 id="h2-price" className="text-xl font-semibold text-black">
          Стоимость и период оплаты
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="rounded border border-gray-200 p-6">
            <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">FREE</p>
            <p className="mt-2 text-2xl font-bold text-black">0 сум</p>
            <p className="mt-1 text-sm text-gray-500">без ограничения по времени</p>
          </div>
          <div className="rounded border border-black p-6">
            <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">PRO</p>
            <p className="mt-2 text-2xl font-bold text-black">{formatSum(price)}</p>
            <p className="mt-1 text-sm text-gray-500">за 365 дней доступа</p>
            {source === "fallback" && (
              <p className="mt-2 text-xs text-gray-400">
                Показана справочная цена — не удалось получить актуальную стоимость в момент сборки страницы.
              </p>
            )}
          </div>
        </div>
      </section>

      <section aria-labelledby="h2-includes">
        <h2 id="h2-includes" className="text-xl font-semibold text-black">
          Что входит в тариф
        </h2>
        <div className="table-container mt-4">
          <table className="w-full text-left">
            <thead>
              <tr>
                <th className="table-header">Возможность</th>
                <th className="table-header">FREE</th>
                <th className="table-header">PRO</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="table-cell">Количество организаций</td>
                <td className="table-cell">1</td>
                <td className="table-cell">больше одной</td>
              </tr>
              <tr>
                <td className="table-cell">AI-классификация операций</td>
                <td className="table-cell">нет</td>
                <td className="table-cell">да</td>
              </tr>
              <tr>
                <td className="table-cell">AI-сверка операций</td>
                <td className="table-cell">нет</td>
                <td className="table-cell">да</td>
              </tr>
              <tr>
                <td className="table-cell">Ручная классификация, проводки, отчёты, чек-лист и калькуляторы</td>
                <td className="table-cell">да</td>
                <td className="table-cell">да</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="h2-payment">
        <h2 id="h2-payment" className="text-xl font-semibold text-black">
          Вопросы об оплате
        </h2>
        <p className="mt-3 text-sm text-gray-600">Оплата принимается через Payme, Click и Alifpay.</p>
      </section>

      <FAQ items={faq} locale="ru" />
      <RelatedPages topic={topic} locale="ru" />
      <CTA topicId={topic.id} locale="ru" location="pricing" withLogin />
    </div>
  );
}

import { Hero } from "@/components/marketing/Hero";
import { ProductScreenshot } from "@/components/marketing/ProductScreenshot";
import { FAQ } from "@/components/marketing/FAQ";
import { RelatedPages } from "@/components/marketing/RelatedPages";
import { CTA } from "@/components/marketing/CTA";
import type { Topic } from "@/lib/manifest";

// Evidence: v2/src/app/balance — раздел баланса в кабинете (директория подтверждена).
const SAMPLE_ASSETS = [
  { name: "Денежные средства на счетах", amount: "48 200 000" },
  { name: "Расчёты с покупателями", amount: "15 600 000" },
  { name: "Основные средства (остаточная стоимость)", amount: "62 000 000" },
];
const SAMPLE_LIABILITIES = [
  { name: "Уставный капитал", amount: "50 000 000" },
  { name: "Нераспределённая прибыль", amount: "58 300 000" },
  { name: "Расчёты с поставщиками", amount: "17 500 000" },
];

export default function Body({ topic }: { topic: Topic }) {
  const faq = topic.locales.ru.faq;
  return (
    <div className="space-y-12">
      <Hero
        h1={topic.locales.ru.h1}
        lead="Баланс показывает активы и обязательства организации на выбранную дату по данным, уже введённым в учёт."
      />

      <section aria-labelledby="h2-shows">
        <h2 id="h2-shows" className="text-xl font-semibold text-black">
          Что показывает баланс
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          Ниже — собственный пример на вымышленных данных: активы и обязательства организации на одну отчётную
          дату. Это не реальные данные клиента, а иллюстрация структуры отчёта.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="rounded border border-gray-200 p-4">
            <p className="text-sm font-medium text-black">Активы</p>
            <ul className="mt-2 space-y-1 text-sm text-gray-600">
              {SAMPLE_ASSETS.map((row) => (
                <li key={row.name} className="flex justify-between gap-3">
                  <span>{row.name}</span>
                  <span className="text-gray-500">{row.amount}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded border border-gray-200 p-4">
            <p className="text-sm font-medium text-black">Обязательства и капитал</p>
            <ul className="mt-2 space-y-1 text-sm text-gray-600">
              {SAMPLE_LIABILITIES.map((row) => (
                <li key={row.name} className="flex justify-between gap-3">
                  <span>{row.name}</span>
                  <span className="text-gray-500">{row.amount}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <p className="mt-2 text-xs text-gray-500">Суммы в сумах, пример на демо-данных на условную дату 30.09.2026.</p>
      </section>

      <ProductScreenshot alt="Раздел баланса: активы и обязательства на выбранную дату" />

      <section aria-labelledby="h2-date">
        <h2 id="h2-date" className="text-xl font-semibold text-black">
          Как выбрать дату
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          На странице баланса указывается отчётная дата — показатели формируются по данным учёта на этот момент.
          Меняя дату, можно сравнить состояние организации на разные моменты времени в пределах введённых данных.
        </p>
      </section>

      <section aria-labelledby="h2-source-data">
        <h2 id="h2-source-data" className="text-xl font-semibold text-black">
          Как проверить исходные данные
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          Полнота баланса зависит от того, насколько полно введены операции и начальные остатки по счетам на дату
          начала учёта — сам отчёт не восполняет недостающие данные и не заменяет проверку исходных документов.
          Если баланс выглядит неполным, стоит сначала проверить импортированные выписки и начальные остатки.
        </p>
      </section>

      <FAQ items={faq} locale="ru" />
      <RelatedPages topic={topic} locale="ru" />
      <CTA topicId={topic.id} locale="ru" location="bottom" />
    </div>
  );
}

import { Hero } from "@/components/marketing/Hero";
import { ProductScreenshot } from "@/components/marketing/ProductScreenshot";
import { FAQ } from "@/components/marketing/FAQ";
import { RelatedPages } from "@/components/marketing/RelatedPages";
import { CTA } from "@/components/marketing/CTA";
import type { Topic } from "@/lib/manifest";

// Evidence: v2/src/app/reports/osv/OSVClient.tsx + page.tsx (phase3-evidence.md).
const SAMPLE_ROWS = [
  { name: "Денежные средства на счетах", opening: "12 000 000", debit: "94 000 000", credit: "81 400 000", closing: "24 600 000" },
  { name: "Расчёты с покупателями", opening: "6 500 000", debit: "112 000 000", credit: "104 300 000", closing: "14 200 000" },
  { name: "Расчёты с поставщиками", opening: "3 100 000", debit: "58 600 000", credit: "61 000 000", closing: "5 500 000" },
];

export default function Body({ topic }: { topic: Topic }) {
  const faq = topic.locales.ru.faq;
  return (
    <div className="space-y-12">
      <Hero
        h1={topic.locales.ru.h1}
        lead="ОСВ показывает начальные остатки, обороты и итоговое сальдо по каждому счёту за выбранный период — основной инструмент проверки полноты учёта."
      />

      <section aria-labelledby="h2-opening">
        <h2 id="h2-opening" className="text-xl font-semibold text-black">
          Остатки на начало периода
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          Ниже — собственный пример на вымышленных данных: три счёта, их начальные остатки, обороты и сальдо на
          конец месяца. Это не реальные данные клиента, а иллюстрация структуры отчёта.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-left text-sm">
            <caption className="sr-only">Пример оборотно-сальдовой ведомости (вымышленные данные)</caption>
            <thead>
              <tr className="border-b border-gray-300 text-xs uppercase text-gray-500">
                <th className="py-2 pr-4 font-medium">Счёт</th>
                <th className="py-2 pr-4 text-right font-medium">Начало</th>
                <th className="py-2 pr-4 text-right font-medium">Дебет</th>
                <th className="py-2 pr-4 text-right font-medium">Кредит</th>
                <th className="py-2 text-right font-medium">Конец</th>
              </tr>
            </thead>
            <tbody>
              {SAMPLE_ROWS.map((row) => (
                <tr key={row.name} className="border-b border-gray-100">
                  <td className="py-2 pr-4 text-gray-700">{row.name}</td>
                  <td className="py-2 pr-4 text-right text-gray-600">{row.opening}</td>
                  <td className="py-2 pr-4 text-right text-gray-600">{row.debit}</td>
                  <td className="py-2 pr-4 text-right text-gray-600">{row.credit}</td>
                  <td className="py-2 text-right font-medium text-black">{row.closing}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-gray-500">Суммы в сумах, пример на демо-данных за условный сентябрь 2026.</p>
      </section>

      <ProductScreenshot alt="Оборотно-сальдовая ведомость: колонки начального остатка, оборотов и сальдо на конец периода" />

      <section aria-labelledby="h2-turnover">
        <h2 id="h2-turnover" className="text-xl font-semibold text-black">
          Дебетовые и кредитовые обороты
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          Обороты — это суммы всех проводок по счёту за период, отдельно по дебету и по кредиту. Они показывают
          движение за месяц, а не остаток: например, крупный дебетовый и кредитовый оборот одновременно может
          означать, что через счёт за период прошло много операций, даже если итоговое сальдо изменилось не сильно.
        </p>
      </section>

      <section aria-labelledby="h2-closing">
        <h2 id="h2-closing" className="text-xl font-semibold text-black">
          Сальдо на конец периода
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          Сальдо на конец периода складывается из начального остатка и оборотов за период по правилам активных и
          пассивных счетов. Равенство итоговых сумм по дебету и кредиту всей ведомости подтверждает баланс двойной
          записи, но не проверяет полноту и корректность каждой операции: если по какому-то счёту не были введены
          начальные остатки, ОСВ покажет заниженные значения по этому счёту, хотя итоговое равенство сохранится.
        </p>
      </section>

      <FAQ items={faq} locale="ru" />
      <RelatedPages topic={topic} locale="ru" />
      <CTA topicId={topic.id} locale="ru" location="bottom" />
    </div>
  );
}

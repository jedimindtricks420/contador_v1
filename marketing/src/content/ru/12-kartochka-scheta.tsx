import { Hero } from "@/components/marketing/Hero";
import { FAQ } from "@/components/marketing/FAQ";
import { RelatedPages } from "@/components/marketing/RelatedPages";
import { CTA } from "@/components/marketing/CTA";
import type { Topic } from "@/lib/manifest";

// Evidence: v2/src/app/reports/account-card/AccountCardClient.tsx (phase3-evidence.md).
const SAMPLE_MOVEMENTS = [
  { date: "01.09.2026", doc: "Начальный остаток", debit: "12 000 000", credit: "—" },
  { date: "03.09.2026", doc: "Банковское поступление от покупателя", debit: "18 400 000", credit: "—" },
  { date: "18.09.2026", doc: "Оплата поставщику", debit: "—", credit: "6 200 000" },
];

export default function Body({ topic }: { topic: Topic }) {
  const faq = topic.locales.ru.faq;
  return (
    <div className="space-y-12">
      <Hero
        h1={topic.locales.ru.h1}
        lead="Карточка счёта показывает все движения по одному бухгалтерскому счёту за период — от начального остатка до итогов."
      />

      <section aria-labelledby="h2-select">
        <h2 id="h2-select" className="text-xl font-semibold text-black">
          Выбор счёта и периода
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          Речь идёт о счёте плана счетов — учётной категории вроде «Денежные средства» или «Расчёты с покупателями»,
          а не о конкретном банковском расчётном счёте организации. На странице карточки указываются такой
          бухгалтерский счёт и период — движения формируются по этим параметрам.
        </p>
      </section>

      <section aria-labelledby="h2-movements">
        <h2 id="h2-movements" className="text-xl font-semibold text-black">
          Движения по счёту
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          Ниже — собственный пример на вымышленных данных: карточка счёта «Денежные средства» за сентябрь. Это не
          реальные данные клиента, а иллюстрация структуры отчёта.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[480px] border-collapse text-left text-sm">
            <caption className="sr-only">Пример карточки счёта (вымышленные данные)</caption>
            <thead>
              <tr className="border-b border-gray-300 text-xs uppercase text-gray-500">
                <th className="py-2 pr-4 font-medium">Дата</th>
                <th className="py-2 pr-4 font-medium">Операция</th>
                <th className="py-2 pr-4 text-right font-medium">Дебет</th>
                <th className="py-2 text-right font-medium">Кредит</th>
              </tr>
            </thead>
            <tbody>
              {SAMPLE_MOVEMENTS.map((row) => (
                <tr key={row.date + row.doc} className="border-b border-gray-100">
                  <td className="py-2 pr-4 text-gray-600">{row.date}</td>
                  <td className="py-2 pr-4 text-gray-700">{row.doc}</td>
                  <td className="py-2 pr-4 text-right text-gray-600">{row.debit}</td>
                  <td className="py-2 text-right text-gray-600">{row.credit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-gray-500">Суммы в сумах, пример на демо-данных за условный сентябрь 2026.</p>
      </section>


      <section aria-labelledby="h2-totals">
        <h2 id="h2-totals" className="text-xl font-semibold text-black">
          Проверка итогов
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          В карточке видно, как сформировался конечный остаток счёта: начальный остаток плюс каждая проводка по
          дебету и кредиту за период. Это удобно, когда нужно разобраться в конкретной сумме из баланса или ОСВ, не
          выискивая её среди всех документов организации. Отдельная функция экспорта карточки счёта сейчас не
          подтверждена — карточка доступна для просмотра в кабинете.
        </p>
      </section>

      <FAQ items={faq} locale="ru" />
      <RelatedPages topic={topic} locale="ru" />
      <CTA topicId={topic.id} locale="ru" location="bottom" />
    </div>
  );
}

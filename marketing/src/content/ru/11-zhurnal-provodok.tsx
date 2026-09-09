import { Hero } from "@/components/marketing/Hero";
import { ProductScreenshot } from "@/components/marketing/ProductScreenshot";
import { FAQ } from "@/components/marketing/FAQ";
import { RelatedPages } from "@/components/marketing/RelatedPages";
import { CTA } from "@/components/marketing/CTA";
import type { Topic } from "@/lib/manifest";

// Evidence: v2/src/app/reports/journal/JournalClient.tsx (phase3-evidence.md).
const SAMPLE_ENTRIES = [
  { date: "03.09.2026", doc: "Банковское поступление", debit: "Денежные средства", credit: "Расчёты с покупателями", amount: "18 400 000" },
  { date: "07.09.2026", doc: "Банковское списание", debit: "Расчёты с поставщиками", credit: "Денежные средства", amount: "6 200 000" },
  { date: "12.09.2026", doc: "Авансовый отчёт", debit: "Административные расходы", credit: "Подотчётные суммы", amount: "1 150 000" },
];

export default function Body({ topic }: { topic: Topic }) {
  const faq = topic.locales.ru.faq;
  return (
    <div className="space-y-12">
      <Hero
        h1={topic.locales.ru.h1}
        lead="Журнал проводок собирает бухгалтерские записи за период в одном месте — по датам, счетам и суммам."
      />

      <section aria-labelledby="h2-entries">
        <h2 id="h2-entries" className="text-xl font-semibold text-black">
          Какие записи видны в журнале
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          Ниже — собственный пример на вымышленных данных: три записи журнала за сентябрь. Это не реальные данные
          клиента, а иллюстрация структуры отчёта.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-left text-sm">
            <caption className="sr-only">Пример журнала проводок (вымышленные данные)</caption>
            <thead>
              <tr className="border-b border-gray-300 text-xs uppercase text-gray-500">
                <th className="py-2 pr-4 font-medium">Дата</th>
                <th className="py-2 pr-4 font-medium">Документ</th>
                <th className="py-2 pr-4 font-medium">Дебет</th>
                <th className="py-2 pr-4 font-medium">Кредит</th>
                <th className="py-2 text-right font-medium">Сумма</th>
              </tr>
            </thead>
            <tbody>
              {SAMPLE_ENTRIES.map((row) => (
                <tr key={row.date + row.doc} className="border-b border-gray-100">
                  <td className="py-2 pr-4 text-gray-600">{row.date}</td>
                  <td className="py-2 pr-4 text-gray-700">{row.doc}</td>
                  <td className="py-2 pr-4 text-gray-600">{row.debit}</td>
                  <td className="py-2 pr-4 text-gray-600">{row.credit}</td>
                  <td className="py-2 text-right font-medium text-black">{row.amount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-gray-500">Суммы в сумах, пример на демо-данных за условный сентябрь 2026.</p>
      </section>

      <ProductScreenshot alt="Журнал проводок с фильтрами по периоду и типу документа" />

      <section aria-labelledby="h2-check">
        <h2 id="h2-check" className="text-xl font-semibold text-black">
          Как проверить операцию
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          Журнал можно фильтровать по периоду и другим доступным фильтрам — так же, как список документов. Чтобы
          разобраться в конкретной записи, находите её по дате, счёту или сумме и открываете связанный документ,
          где видны детали операции.
        </p>
        <p className="mt-3 text-sm text-gray-600">
          Это журнал учётных проводок, отражающий текущее состояние документов, а не отдельный неизменяемый
          юридический аудиторский журнал.
        </p>
      </section>

      <section aria-labelledby="h2-reports">
        <h2 id="h2-reports" className="text-xl font-semibold text-black">
          Переход к отчётам
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          Записи журнала — основа для других отчётов: оборотно-сальдовой ведомости и карточки счёта. Если после
          журнала нужен взгляд по конкретному счёту или сверка остатков, эти отчёты построены на тех же проводках.
        </p>
      </section>

      <FAQ items={faq} locale="ru" />
      <RelatedPages topic={topic} locale="ru" />
      <CTA topicId={topic.id} locale="ru" location="bottom" />
    </div>
  );
}

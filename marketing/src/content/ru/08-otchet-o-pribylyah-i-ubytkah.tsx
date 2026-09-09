import { Hero } from "@/components/marketing/Hero";
import { FAQ } from "@/components/marketing/FAQ";
import { RelatedPages } from "@/components/marketing/RelatedPages";
import { CTA } from "@/components/marketing/CTA";
import type { Topic } from "@/lib/manifest";

// Evidence: v2/src/app/pnl — раздел отчёта в кабинете (директория подтверждена).
const SAMPLE_ROWS = [
  { name: "Выручка от реализации", amount: "185 000 000" },
  { name: "Себестоимость и прямые расходы", amount: "−96 000 000" },
  { name: "Административные расходы", amount: "−41 200 000" },
  { name: "Финансовый результат за период", amount: "47 800 000", bold: true },
];

export default function Body({ topic }: { topic: Topic }) {
  const faq = topic.locales.ru.faq;
  return (
    <div className="space-y-12">
      <Hero
        h1={topic.locales.ru.h1}
        lead="Отчёт о прибылях и убытках показывает доходы, расходы и финансовый результат бизнеса за выбранный период."
      />

      <section aria-labelledby="h2-period">
        <h2 id="h2-period" className="text-xl font-semibold text-black">
          Доходы и расходы за период
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          На странице отчёта выбирается период — доходы и расходы показываются по данным учёта за этот
          промежуток времени. Ниже — собственный пример на вымышленных данных.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[420px] border-collapse text-left text-sm">
            <caption className="sr-only">Пример отчёта о прибылях и убытках (вымышленные данные)</caption>
            <tbody>
              {SAMPLE_ROWS.map((row) => (
                <tr key={row.name} className="border-b border-gray-100">
                  <td className={`py-2 pr-4 ${row.bold ? "font-semibold text-black" : "text-gray-700"}`}>{row.name}</td>
                  <td className={`py-2 text-right ${row.bold ? "font-semibold text-black" : "text-gray-700"}`}>{row.amount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-gray-500">Суммы в сумах, пример на демо-данных за условный сентябрь 2026.</p>
      </section>


      <section aria-labelledby="h2-result">
        <h2 id="h2-result" className="text-xl font-semibold text-black">
          Финансовый результат
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          Финансовый результат — это разница между доходами и расходами периода по данным учёта: прибыль или
          убыток. Он рассчитывается автоматически по операциям, которые вы уже провели за выбранный период.
        </p>
      </section>

      <section aria-labelledby="h2-cash">
        <h2 id="h2-cash" className="text-xl font-semibold text-black">
          Почему прибыль не равна деньгам
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          Прибыль в этом отчёте — учётный показатель за период, а остаток на банковских счетах — это фактические
          деньги в конкретный момент; они могут заметно отличаться, например, если оплата от клиента ещё не
          поступила. Не стоит принимать банковский остаток за прибыль. Чтобы разобраться в разнице подробнее, её
          удобно смотреть вместе с данными по счетам за тот же период.
        </p>
      </section>

      <FAQ items={faq} locale="ru" />
      <RelatedPages topic={topic} locale="ru" />
      <CTA topicId={topic.id} locale="ru" location="bottom" />
    </div>
  );
}

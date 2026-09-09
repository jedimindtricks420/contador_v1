import { Hero } from "@/components/marketing/Hero";
import { RelatedPages } from "@/components/marketing/RelatedPages";
import { CTA } from "@/components/marketing/CTA";
import type { Topic } from "@/lib/manifest";

// Тип guide, порядок блоков — TASK-0003 §6. Собственный оригинальный пример
// с отсрочкой оплаты — обязательное содержание темы 22. Опирается на реально
// построенные отчёты 08 (P&L, /v2/pnl) и 09 (ДДС, /v2/cashflow). Пример
// упрощённый, без налогового расчёта — прямо оговорено в тексте.
const TIMELINE = [
  { period: "Сентябрь (оказана услуга)", pnl: "Доход признан: 10 000 000 сум", cash: "Поступление: 0 сум" },
  { period: "Октябрь (получена оплата)", pnl: "Доход не признаётся повторно", cash: "Поступление: 10 000 000 сум" },
];

export default function Body({ topic }: { topic: Topic }) {
  return (
    <div className="space-y-12">
      <Hero
        h1={topic.locales.ru.h1}
        lead="Прибыль в отчёте о прибылях и убытках — учётный показатель за период. Движение денег на счёте зависит от того, когда фактически поступила оплата. Из-за отсрочки платежа эти два числа за один и тот же месяц могут заметно отличаться."
      />

      <nav aria-label="Содержание" className="text-sm">
        <p className="font-medium text-black">Содержание</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-gray-600">
          <li><a href="#h2-two" className="underline hover:text-black">Два разных показателя</a></li>
          <li><a href="#h2-example" className="underline hover:text-black">Пример с отсрочкой оплаты</a></li>
          <li><a href="#h2-together" className="underline hover:text-black">Какие отчёты смотреть вместе</a></li>
        </ul>
      </nav>

      <section aria-labelledby="h2-two">
        <h2 id="h2-two" className="text-xl font-semibold text-black">
          Два разных показателя
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          Отчёт о прибылях и убытках показывает доход в момент, когда услуга оказана или товар отгружен — независимо
          от того, поступили ли уже деньги. Отчёт о движении денежных средств показывает деньги в момент фактического
          поступления или списания по банковскому счёту. Это разные срезы одного и того же бизнеса, и они не обязаны
          совпадать за один период.
        </p>
      </section>

      <section aria-labelledby="h2-example">
        <h2 id="h2-example" className="text-xl font-semibold text-black">
          Пример с отсрочкой оплаты
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          Собственный упрощённый пример на вымышленных данных: 1 сентября компания оказала клиенту услугу на
          10 000 000 сум с отсрочкой оплаты 30 дней. Деньги фактически поступили только 1 октября.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-left text-sm">
            <caption className="sr-only">Пример: доход в P&amp;L и поступление денег по месяцам</caption>
            <thead>
              <tr className="border-b border-gray-300 text-xs uppercase text-gray-500">
                <th className="py-2 pr-4 font-medium">Период</th>
                <th className="py-2 pr-4 font-medium">Отчёт о прибылях и убытках</th>
                <th className="py-2 font-medium">Движение денежных средств</th>
              </tr>
            </thead>
            <tbody>
              {TIMELINE.map((row) => (
                <tr key={row.period} className="border-b border-gray-100">
                  <td className="py-2 pr-4 text-gray-700">{row.period}</td>
                  <td className="py-2 pr-4 text-gray-600">{row.pnl}</td>
                  <td className="py-2 text-gray-600">{row.cash}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-gray-500">
          Пример упрощён: не учитывает налоги и другие операции периода — только иллюстрирует разницу между
          признанием дохода и движением денег.
        </p>
      </section>

      <section aria-labelledby="h2-together">
        <h2 id="h2-together" className="text-xl font-semibold text-black">
          Какие отчёты смотреть вместе
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          Чтобы понять и результат периода, и фактическое состояние денег, стоит смотреть отчёт о прибылях и убытках
          вместе с движением денежных средств за тот же период — прибыльный месяц не всегда означает деньги на счёте,
          и наоборот.
        </p>
      </section>

      <RelatedPages topic={topic} locale="ru" />
      <CTA topicId={topic.id} locale="ru" location="bottom" />
    </div>
  );
}

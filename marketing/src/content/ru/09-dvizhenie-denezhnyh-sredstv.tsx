import { Hero } from "@/components/marketing/Hero";
import { FAQ } from "@/components/marketing/FAQ";
import { RelatedPages } from "@/components/marketing/RelatedPages";
import { CTA } from "@/components/marketing/CTA";
import type { Topic } from "@/lib/manifest";

// Evidence: маршрут /v2/cashflow (phase3-evidence.md, подтверждён вместе с
// темой 08 в фазе 2). Отчёт отражает только уже проведённые операции —
// прогнозирование не заявляется, т.к. не подтверждено ни одним аудитом.
const SAMPLE_INFLOWS = [
  { name: "Оплата от покупателей", amount: "112 000 000" },
  { name: "Прочие поступления", amount: "3 400 000" },
];
const SAMPLE_OUTFLOWS = [
  { name: "Оплата поставщикам", amount: "58 600 000" },
  { name: "Заработная плата", amount: "24 000 000" },
  { name: "Налоги и обязательные платежи", amount: "9 100 000" },
];

export default function Body({ topic }: { topic: Topic }) {
  const faq = topic.locales.ru.faq;
  return (
    <div className="space-y-12">
      <Hero
        h1={topic.locales.ru.h1}
        lead="Отчёт о движении денежных средств показывает фактические поступления и выплаты по банковским счетам за выбранный период."
      />

      <section aria-labelledby="h2-flows">
        <h2 id="h2-flows" className="text-xl font-semibold text-black">
          Поступления и выплаты
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          Ниже — собственный пример на вымышленных данных: поступления и выплаты организации за один месяц. Это не
          реальные данные клиента, а иллюстрация структуры отчёта.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="rounded border border-gray-200 p-4">
            <p className="text-sm font-medium text-black">Поступления</p>
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
            <p className="text-sm font-medium text-black">Выплаты</p>
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
        <p className="mt-2 text-xs text-gray-500">Суммы в сумах, пример на демо-данных за условный сентябрь 2026.</p>
      </section>


      <section aria-labelledby="h2-filters">
        <h2 id="h2-filters" className="text-xl font-semibold text-black">
          Период и банковские счета
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          В отчёте выбирается период, а поступления и выплаты рассчитываются по банковским операциям организации,
          которые уже загружены и разнесены в Contador за это время. Отчёт отражает только прошедшие операции —
          прогнозирования будущих поступлений и выплат в сервисе нет.
        </p>
      </section>

      <section aria-labelledby="h2-profit">
        <h2 id="h2-profit" className="text-xl font-semibold text-black">
          Связь с прибылью
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          Движение денег и финансовый результат — разные срезы одного бизнеса: ДДС показывает фактические деньги
          на счетах, а отчёт о прибылях и убытках — учётный результат периода. Полезно смотреть оба отчёта вместе
          за один и тот же период, чтобы понять, откуда взялась разница.
        </p>
      </section>

      <FAQ items={faq} locale="ru" />
      <RelatedPages topic={topic} locale="ru" />
      <CTA topicId={topic.id} locale="ru" location="bottom" />
    </div>
  );
}

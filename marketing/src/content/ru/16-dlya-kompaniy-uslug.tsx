import { Hero } from "@/components/marketing/Hero";
import { FAQ } from "@/components/marketing/FAQ";
import { CTA } from "@/components/marketing/CTA";
import { getTopicById, urlFor } from "@/lib/manifest";
import type { Topic } from "@/lib/manifest";

// Тип audience, порядок блоков — TASK-0003 §6: проблема аудитории → рабочий
// сценарий → 3 подходящих функции → пример → ограничения → FAQ → CTA.
// "3 подходящих функции" ссылаются только на реально построенные темы 13
// (открытые позиции), 08 (P&L) и 06 (закрытие месяца) — phase3-evidence.md.
export default function Body({ topic }: { topic: Topic }) {
  const faq = topic.locales.ru.faq;
  const openPositionsTopic = getTopicById("13");
  const pnlTopic = getTopicById("08");
  const closingTopic = getTopicById("06");

  return (
    <div className="space-y-12">
      <Hero
        h1={topic.locales.ru.h1}
        lead="Оплата услуг клиентами, расходы на подрядчиков и авансы — то, с чем сервисная компания сталкивается каждый месяц."
      />

      <section aria-labelledby="h2-payments">
        <h2 id="h2-payments" className="text-xl font-semibold text-black">
          Оплата услуг и расходы
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          У компании, оказывающей услуги — агентства, консалтинга, сервисного ООО — обычно меньше операций со
          складом и товарными остатками, чем у товарного бизнеса, зато больше внимания требуют оплаты от заказчиков,
          расходы на подрядчиков и субподрядчиков. Банковские операции по таким платежам импортируются и
          классифицируются в Contador так же, как любые другие операции.
        </p>
      </section>


      <section aria-labelledby="h2-advances">
        <h2 id="h2-advances" className="text-xl font-semibold text-black">
          Работа с авансами
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          Пример на вымышленных данных: рекламное агентство «Демо-агентство» получило от заказчика предоплату
          2 000 000 сум за услуги, которые ещё не оказаны полностью, и одновременно выдало подрядчику аванс
          500 000 сум за часть работ. Обе суммы отражаются как открытые позиции — они закрываются, когда услуга
          оказана или подрядчик отчитался о выполненной работе.
        </p>
        <div className="mt-4">
          {openPositionsTopic && (
            <a
              href={urlFor(openPositionsTopic, "ru")}
              className="block rounded border border-gray-200 p-4 hover:border-black transition-colors"
            >
              <p className="font-medium text-black">{openPositionsTopic.locales.ru.h1}</p>
            </a>
          )}
        </div>
      </section>

      <section aria-labelledby="h2-result">
        <h2 id="h2-result" className="text-xl font-semibold text-black">
          Проверка результата за месяц
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          В конце месяца отчёт о прибылях и убытках показывает доходы от оказанных услуг, расходы периода и
          финансовый результат, а мастер закрытия месяца помогает пройти доступные проверки перед финализацией
          периода. Отраслевых функций для сервисных компаний — CRM, тайм-трекинга, склада или особых льгот —
          Contador не предоставляет.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {pnlTopic && (
            <a
              href={urlFor(pnlTopic, "ru")}
              className="block rounded border border-gray-200 p-4 hover:border-black transition-colors"
            >
              <p className="font-medium text-black">{pnlTopic.locales.ru.h1}</p>
            </a>
          )}
          {closingTopic && (
            <a
              href={urlFor(closingTopic, "ru")}
              className="block rounded border border-gray-200 p-4 hover:border-black transition-colors"
            >
              <p className="font-medium text-black">{closingTopic.locales.ru.h1}</p>
            </a>
          )}
        </div>
      </section>

      <FAQ items={faq} locale="ru" />
      <CTA topicId={topic.id} locale="ru" location="bottom" />
    </div>
  );
}

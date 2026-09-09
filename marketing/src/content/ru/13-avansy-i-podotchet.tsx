import { Hero } from "@/components/marketing/Hero";
import { FAQ } from "@/components/marketing/FAQ";
import { RelatedPages } from "@/components/marketing/RelatedPages";
import { CTA } from "@/components/marketing/CTA";
import type { Topic } from "@/lib/manifest";

// Evidence: v2/open-positions — раздел открытых позиций (подтверждено в phase-1
// evidence, повторно сверено в phase3-evidence.md). Автоматических напоминаний
// не найдено ни в одном доступном аудите — не заявляется.
export default function Body({ topic }: { topic: Topic }) {
  const faq = topic.locales.ru.faq;
  return (
    <div className="space-y-12">
      <Hero
        h1={topic.locales.ru.h1}
        lead="Открытые позиции — это авансы и подотчётные суммы, которые ещё не закрыты встречной операцией."
      />

      <section aria-labelledby="h2-open">
        <h2 id="h2-open" className="text-xl font-semibold text-black">
          Какие позиции остаются открытыми
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          Пример на вымышленных данных: 5 сентября сотруднику выдан аванс на хозяйственные расходы на сумму
          800 000 сум. Пока сотрудник не отчитается о расходовании — авансовым отчётом или возвратом остатка — эта
          сумма отражается в Contador как открытая позиция: деньги выданы, но операция ещё не закрыта.
        </p>
      </section>


      <section aria-labelledby="h2-status">
        <h2 id="h2-status" className="text-xl font-semibold text-black">
          Сроки и статусы
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          Позиция закрывается встречной операцией на ту же сумму — например, авансовым отчётом на полную сумму или
          частичным возвратом остатка. После этого она перестаёт считаться открытой. Автоматических напоминаний о
          просроченных позициях сервис не отправляет — сроки и статусы проверяются вручную в разделе открытых
          позиций.
        </p>
      </section>

      <section aria-labelledby="h2-before-closing">
        <h2 id="h2-before-closing" className="text-xl font-semibold text-black">
          Проверка перед закрытием
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          Перед закрытием месяца стоит просмотреть список открытых позиций за период: не остались ли авансы или
          подотчётные суммы без движения, которые нужно закрыть отчётом сотрудника или перенести на следующий
          период. Этот раздел не заменяет полноценную CRM для взыскания задолженности — он показывает только
          состояние авансов и подотчётных сумм внутри учёта Contador.
        </p>
      </section>

      <FAQ items={faq} locale="ru" />
      <RelatedPages topic={topic} locale="ru" />
      <CTA topicId={topic.id} locale="ru" location="bottom" />
    </div>
  );
}

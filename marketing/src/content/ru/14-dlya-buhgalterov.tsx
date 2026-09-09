import { Hero } from "@/components/marketing/Hero";
import { FAQ } from "@/components/marketing/FAQ";
import { CTA } from "@/components/marketing/CTA";
import { getTopicById, urlFor } from "@/lib/manifest";
import type { Topic } from "@/lib/manifest";

// Тип audience, порядок блоков — TASK-0003 §6: проблема аудитории → рабочий
// сценарий → 3 подходящих функции → пример → ограничения → FAQ → CTA.
// "3 подходящих функции" ссылаются только на реально построенные темы 03/04/06
// (evidence phase2-evidence.md), вторичный CTA — на чек-лист 21.
export default function Body({ topic }: { topic: Topic }) {
  const faq = topic.locales.ru.faq;
  const importTopic = getTopicById("03");
  const aiTopic = getTopicById("04");
  const closingTopic = getTopicById("06");
  const checklistTopic = getTopicById("21");

  return (
    <div className="space-y-12">
      <Hero
        h1={topic.locales.ru.h1}
        lead="Импорт выписки, проверка классификации, проводки и отчёты — рабочая последовательность бухгалтера в одном сервисе."
      />

      <section aria-labelledby="h2-prepare">
        <h2 id="h2-prepare" className="text-xl font-semibold text-black">
          Подготовьте данные
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          У бухгалтера, ведущего учёт нескольких организаций в Excel или разрозненных программах, обычно много
          времени уходит на ручной перенос данных из банк-клиента и повторную сверку операций. В Contador рабочий
          день бухгалтера обычно начинается с загрузки банковской выписки — это первый шаг мастера закрытия
          месяца, а не отдельная разрозненная задача.
        </p>
      </section>


      <section aria-labelledby="h2-check">
        <h2 id="h2-check" className="text-xl font-semibold text-black">
          Проверьте операции
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          Дальше в дело включаются правила и AI-классификация: часть операций распознаётся автоматически, а
          бухгалтер уточняет вручную только неоднозначные случаи. После уточнения категорий операции разносятся
          проводками по документам — вручную набирать проводку с нуля не требуется.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {importTopic && (
            <a href={urlFor(importTopic, "ru")} className="block rounded border border-gray-200 p-4 hover:border-black transition-colors">
              <p className="font-medium text-black">{importTopic.locales.ru.h1}</p>
            </a>
          )}
          {aiTopic && (
            <a href={urlFor(aiTopic, "ru")} className="block rounded border border-gray-200 p-4 hover:border-black transition-colors">
              <p className="font-medium text-black">{aiTopic.locales.ru.h1}</p>
            </a>
          )}
          {closingTopic && (
            <a href={urlFor(closingTopic, "ru")} className="block rounded border border-gray-200 p-4 hover:border-black transition-colors">
              <p className="font-medium text-black">{closingTopic.locales.ru.h1}</p>
            </a>
          )}
        </div>
      </section>

      <section aria-labelledby="h2-reports">
        <h2 id="h2-reports" className="text-xl font-semibold text-black">
          Сформируйте отчёты
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          Пример рабочего дня: бухгалтер загружает выписку за сентябрь, уточняет три неоднозначные операции в
          очереди классификации, проходит шаги мастера закрытия и в конце месяца формирует отчёты по
          финализированному периоду. Роли и доступ к нескольким организациям в кабинете зависят от тарифа —
          подробности на странице тарифов. Contador не заменяет профессиональную бухгалтерскую экспертизу и не
          принимает решения по спорным вопросам вместо бухгалтера.
        </p>
      </section>

      <FAQ items={faq} locale="ru" />

      {checklistTopic && (
        <div className="rounded border border-gray-200 p-4">
          <p className="text-sm text-gray-600">
            Перед прохождением мастера закрытия можно самостоятельно свериться по бесплатному чек-листу — он
            доступен без регистрации.
          </p>
          <a href={urlFor(checklistTopic, "ru")} className="mt-2 inline-block text-sm font-medium text-black underline">
            {checklistTopic.locales.ru.h1}
          </a>
        </div>
      )}

      <CTA topicId={topic.id} locale="ru" location="bottom" />
    </div>
  );
}

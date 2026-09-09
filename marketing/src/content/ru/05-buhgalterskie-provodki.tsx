import { Hero } from "@/components/marketing/Hero";
import { FAQ } from "@/components/marketing/FAQ";
import { RelatedPages } from "@/components/marketing/RelatedPages";
import { CTA } from "@/components/marketing/CTA";
import { getTopicById, urlFor } from "@/lib/manifest";
import type { Topic } from "@/lib/manifest";

// Evidence: v2/src/app/documents/DocumentsClient.tsx — список документов с
// фильтрами по периоду и типу, статусы POSTED/VOIDED. Счета плана счетов
// намеренно не называются конкретными кодами в этом тексте — AGENTS.md
// проекта прямо предупреждает, что коды счетов нельзя подставлять по памяти
// без сверки с ensureBaseData.ts/constants.ts; здесь описание качественное.
// Фаза 3: журнал проводок (тема 11, v2/src/app/reports/journal) построен —
// текст ниже больше не описывает его как "в разработке" (было верно в фазе 2,
// устарело сейчас).
export default function Body({ topic }: { topic: Topic }) {
  const faq = topic.locales.ru.faq;
  const journalTopic = getTopicById("11");
  return (
    <div className="space-y-12">
      <Hero
        h1={topic.locales.ru.h1}
        lead="Проводка формируется автоматически по документу — вы работаете с документом, а Contador разносит его по счетам."
      />

      <section aria-labelledby="h2-flow">
        <h2 id="h2-flow" className="text-xl font-semibold text-black">
          От операции к проводке
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          В разделе документов кабинета операции отражаются как документы определённого типа — например,
          банковское поступление или списание. У каждого типа документа есть готовый шаблон проводки: вводить
          дебет и кредит вручную с нуля не нужно, Contador формирует проводку по документу автоматически. Список
          документов можно фильтровать по периоду (месяц, год) и по типу документа.
        </p>
      </section>


      <section aria-labelledby="h2-check">
        <h2 id="h2-check" className="text-xl font-semibold text-black">
          Проверка дебета и кредита
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          Каждый документ получает статус: «Проведён» — документ разнесён проводками и учтён в отчётах; «Аннулирован»
          — документ отменён и в проводках не участвует. Это реальные статусы, которые видно в списке документов.
          Двойная запись контролируется внутри шаблона проводки: сумма по дебету и сумма по кредиту документа
          должны совпадать, прежде чем документ можно провести.
        </p>
        <p className="mt-3 text-sm text-gray-600">
          Пример на демо-данных: поступление денег на банковский счёт от покупателя отражается по счетам учёта
          денежных средств и расчётов с покупателем; конкретные коды счетов зависят от типа документа и настроек
          плана счетов организации.
        </p>
      </section>

      <section aria-labelledby="h2-journal">
        <h2 id="h2-journal" className="text-xl font-semibold text-black">
          Просмотр в журнале
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          Проводки можно смотреть вместе с документами, которые их породили, — в списке документов с фильтрами по
          периоду и типу. Для сквозного взгляда по всем проводкам сразу, независимо от документа, есть отдельный
          журнал проводок.
        </p>
        {journalTopic && (
          <a
            href={urlFor(journalTopic, "ru")}
            className="mt-3 inline-block rounded border border-gray-200 p-4 font-medium text-black hover:border-black transition-colors"
          >
            {journalTopic.locales.ru.h1}
          </a>
        )}
        <p className="mt-3 text-sm text-gray-600">
          Contador поддерживает проводки по операциям, для которых уже есть тип документа и шаблон в системе —
          это не универсальный редактор проводок для произвольных хозяйственных операций.
        </p>
      </section>

      <FAQ items={faq} locale="ru" />
      <RelatedPages topic={topic} locale="ru" />
      <CTA topicId={topic.id} locale="ru" location="bottom" />
    </div>
  );
}

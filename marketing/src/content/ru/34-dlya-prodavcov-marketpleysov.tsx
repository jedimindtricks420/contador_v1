import { Hero } from "@/components/marketing/Hero";
import { FAQ } from "@/components/marketing/FAQ";
import { CTA } from "@/components/marketing/CTA";
import { getTopicById, urlFor } from "@/lib/manifest";
import type { Topic } from "@/lib/manifest";

// Тип audience — evidence: v2/src/lib/constants.ts MARKETPLACE_INNS +
// v2/src/app/api/import/soliq/route.ts isMarketplace()/nameSimilarity().
// Пример продавца — вымышленный демо-сценарий (не реальные данные), как
// требует wave2-metadata.md §34. НЕ заявляется прямая интеграция/API с
// Uzum/Wildberries, проценты комиссии маркетплейсов не называются.
export default function Body({ topic }: { topic: Topic }) {
  const faq = topic.locales.ru.faq;
  const importTopic = getTopicById("03");
  const postingsTopic = getTopicById("05");
  const closingTopic = getTopicById("06");

  return (
    <div className="space-y-12">
      <Hero
        h1={topic.locales.ru.h1}
        lead="Продажи через маркетплейсы попадают в учёт так же, как любая другая выручка — с распознаванием контрагента при импорте и дальнейшей сверкой комиссии."
      />

      <section aria-labelledby="h2-recognize">
        <h2 id="h2-recognize" className="text-xl font-semibold text-black">
          Как распознаются платежи маркетплейса
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          При импорте банковской выписки или данных Soliq Contador сравнивает ИНН и название контрагента с
          известным списком маркетплейсов. Если совпадение найдено — операция помечается как поступление от
          маркетплейса автоматически, без ручной разметки. Прямого API-подключения к площадкам (Uzum Market,
          Wildberries UZ и другим) при этом нет — распознавание происходит только на основе уже загруженных
          данных выписки или Soliq.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {importTopic && (
            <a href={urlFor(importTopic, "ru")} className="block rounded border border-gray-200 p-4 hover:border-black transition-colors">
              <p className="font-medium text-black">{importTopic.locales.ru.h1}</p>
            </a>
          )}
          {postingsTopic && (
            <a href={urlFor(postingsTopic, "ru")} className="block rounded border border-gray-200 p-4 hover:border-black transition-colors">
              <p className="font-medium text-black">{postingsTopic.locales.ru.h1}</p>
            </a>
          )}
        </div>
      </section>

      <section aria-labelledby="h2-reconcile">
        <h2 id="h2-reconcile" className="text-xl font-semibold text-black">
          Сверка комиссии и выручки
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          Пример (вымышленные данные): ИП «Гулбахор Трейд» получает от маркетплейса одним переводом сумму за
          вычетом комиссии площадки. В выписке видна одна операция поступления от распознанного контрагента —
          дальше нужно свериться с отчётом самого маркетплейса, сколько было продано товара и сколько удержано
          комиссии, чтобы корректно отразить выручку и расходы отдельно. Contador не публикует и не подтверждает
          проценты комиссии конкретных площадок — эти данные нужно смотреть в своём личном кабинете продавца.
        </p>
      </section>

      <section aria-labelledby="h2-next">
        <h2 id="h2-next" className="text-xl font-semibold text-black">
          Что дальше в учёте
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          После распознавания операция обрабатывается как обычная выручка: проходит классификацию, разносится
          проводкой и попадает в закрытие месяца вместе с остальными операциями периода.
        </p>
        {closingTopic && (
          <div className="mt-4 rounded border border-gray-200 p-4">
            <a href={urlFor(closingTopic, "ru")} className="text-sm font-medium text-black underline">
              {closingTopic.locales.ru.h1}
            </a>
          </div>
        )}
      </section>

      <FAQ items={faq} locale="ru" />
      <CTA topicId={topic.id} locale="ru" location="bottom" />
    </div>
  );
}

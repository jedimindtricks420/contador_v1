import { Hero } from "@/components/marketing/Hero";
import { FAQ } from "@/components/marketing/FAQ";
import { RelatedPages } from "@/components/marketing/RelatedPages";
import { CTA } from "@/components/marketing/CTA";
import { getTopicById, urlFor } from "@/lib/manifest";
import type { Topic } from "@/lib/manifest";

// Тип feature — evidence: v2/src/app/closing/steps/Step6Soliq.tsx (шаг 6
// мастера закрытия, "Сверка с порталом my.soliq.uz") и отдельный от
// банковского импорт v2/src/app/api/import/soliq/route.ts. НЕ заявляется
// автоматическая отправка/приём ЭСФ — только сверка уже загруженных данных
// (wave2-metadata.md §35).
export default function Body({ topic }: { topic: Topic }) {
  const faq = topic.locales.ru.faq;
  const importTopic = getTopicById("03");
  const closingTopic = getTopicById("06");

  return (
    <div className="space-y-12">
      <Hero
        h1={topic.locales.ru.h1}
        lead="Шаг «Сверка с Soliq» в мастере закрытия месяца сравнивает загруженные данные счетов-фактур и авансов с вашим учётом — до того, как период финализирован."
      />

      <section aria-labelledby="h2-what">
        <h2 id="h2-what" className="text-xl font-semibold text-black">
          Что загружается из Soliq
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          Данные Soliq загружаются отдельным файлом — это самостоятельный путь импорта, не связанный с загрузкой
          банковской выписки. Загруженный реестр показывает счета-фактуры и авансы, которые затем можно сравнить с
          данными, уже отражёнными в учёте Contador.
        </p>
        {importTopic && (
          <div className="mt-4 rounded border border-gray-200 p-4">
            <p className="text-sm text-gray-600">
              Это отдельный источник данных — не тот же импорт, что для банковской выписки:
            </p>
            <a href={urlFor(importTopic, "ru")} className="mt-2 inline-block text-sm font-medium text-black underline">
              {importTopic.locales.ru.h1}
            </a>
          </div>
        )}
      </section>

      <section aria-labelledby="h2-reconcile">
        <h2 id="h2-reconcile" className="text-xl font-semibold text-black">
          Сверка авансов и ЭСФ
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          После загрузки Contador сравнивает суммы электронных счетов-фактур и авансов из реестра Soliq с данными
          вашего учёта и показывает расхождения. Устранение найденных расхождений — например, дозапись операции
          или уточнение суммы — остаётся задачей пользователя: сервис их не исправляет и не подаёт корректировки
          автоматически.
        </p>
      </section>

      <section aria-labelledby="h2-when">
        <h2 id="h2-when" className="text-xl font-semibold text-black">
          Когда это происходит в закрытии месяца
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          Сверка с Soliq — шаг 6 мастера закрытия месяца, «Сверка с порталом my.soliq.uz». Он идёт после того, как
          основные операции периода уже разнесены, и перед финализацией периода.
        </p>
        {closingTopic && (
          <div className="mt-4 rounded border border-gray-200 p-4">
            <a href={urlFor(closingTopic, "ru")} className="text-sm font-medium text-black underline">
              {closingTopic.locales.ru.h1}
            </a>
          </div>
        )}
        <p className="mt-4 text-sm text-gray-600">
          Contador не отправляет и не принимает электронные счета-фактуры напрямую через этот шаг — сверяются
          только данные, уже загруженные в сервис.
        </p>
      </section>

      <FAQ items={faq} locale="ru" />
      <RelatedPages topic={topic} locale="ru" />
      <CTA topicId={topic.id} locale="ru" location="bottom" />
    </div>
  );
}

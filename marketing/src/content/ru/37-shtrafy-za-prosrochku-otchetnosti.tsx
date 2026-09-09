import { Hero } from "@/components/marketing/Hero";
import { RelatedPages } from "@/components/marketing/RelatedPages";
import { CTA } from "@/components/marketing/CTA";
import { getTopicById, urlFor } from "@/lib/manifest";
import type { Topic } from "@/lib/manifest";

// Тип guide — самый юридически чувствительный текст этой волны (TASK-0004
// критическое ограничение §4 «37»). Единственная опора — статья 220
// Налогового кодекса РУз (nsbu_and_soliq_codex/Налоговый-кодекс-Республики-
// Узбекистан_Lex.uz.md, найдено и процитировано напрямую 2026-09-09): «За
// несвоевременное представление налоговой отчетности... привлекается к
// административной ответственности» — БЕЗ суммы или процента штрафа в тексте
// этой статьи. Конкретная мера ответственности отсылает к отдельному
// законодательству об административной ответственности, которого нет в этом
// репозитории — поэтому ни одна цифра здесь НЕ называется, только факт
// наличия ответственности и хедж-формулировки, как требует спека.
export default function Body({ topic }: { topic: Topic }) {
  const calendarTopic = getTopicById("31");
  const profitTopic = getTopicById("33");
  const regimeGuide = getTopicById("36");

  return (
    <div className="space-y-12">
      <Hero
        h1={topic.locales.ru.h1}
        lead="Налоговый кодекс Узбекистана прямо устанавливает, что за несвоевременную сдачу налоговой отчётности предусмотрена ответственность. Конкретные суммы и порядок штрафов этот материал не приводит — они устанавливаются отдельным законодательством и могут меняться, поэтому мы сознательно не называем цифр, которые могли бы устареть."
      />

      <section aria-labelledby="h2-principles">
        <h2 id="h2-principles" className="text-xl font-semibold text-black">
          Общие принципы ответственности
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          Статья 220 Налогового кодекса Республики Узбекистан «Непредставление налоговой отчетности»
          устанавливает: «За несвоевременное представление налоговой отчетности должностное лицо
          налогоплательщика — юридического лица или налогоплательщик — физическое лицо привлекается к
          административной ответственности». Сама статья кодекса не содержит конкретной суммы или процента
          штрафа — мера ответственности определяется отдельным законодательством об административной
          ответственности.
        </p>
        <p className="mt-3 text-sm text-gray-600">
          Мы намеренно не указываем здесь конкретную сумму или процент: любая названная цифра рисковала бы
          оказаться устаревшей или неточной для вашей ситуации. Размер и порядок ответственности устанавливает
          действующее законодательство — уточняйте его актуальную редакцию перед тем, как делать выводы.
        </p>
      </section>

      <section aria-labelledby="h2-avoid">
        <h2 id="h2-avoid" className="text-xl font-semibold text-black">
          Как не пропустить срок
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          Лучший способ не столкнуться с ответственностью за просрочку — не пропустить срок сдачи. Настройте
          персональные напоминания в налоговом календаре Contador по своим налогам и отчётам, а для налога на
          прибыль заранее готовьте квартальный расчёт, чтобы данные были под рукой к моменту подачи.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {calendarTopic && (
            <a href={urlFor(calendarTopic, "ru")} className="block rounded border border-gray-200 p-4 hover:border-black transition-colors">
              <p className="font-medium text-black">{calendarTopic.locales.ru.h1}</p>
            </a>
          )}
          {profitTopic && (
            <a href={urlFor(profitTopic, "ru")} className="block rounded border border-gray-200 p-4 hover:border-black transition-colors">
              <p className="font-medium text-black">{profitTopic.locales.ru.h1}</p>
            </a>
          )}
        </div>
      </section>

      <section aria-labelledby="h2-check">
        <h2 id="h2-check" className="text-xl font-semibold text-black">
          Где проверить актуальные нормы
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          Актуальную редакцию Налогового кодекса и законодательства об административной ответственности всегда
          проверяйте на <span className="font-mono text-xs">lex.uz</span>, а требования по конкретным отчётам — на{" "}
          <span className="font-mono text-xs">soliq.uz</span>. Этот материал — общее образовательное объяснение
          принципа, не юридическая консультация и не замена проверки действующего законодательства.
        </p>
        {regimeGuide && (
          <div className="mt-4 rounded border border-gray-200 p-4">
            <p className="text-sm text-gray-600">Смежная тема — выбор налогового режима:</p>
            <a href={urlFor(regimeGuide, "ru")} className="mt-2 inline-block text-sm font-medium text-black underline">
              {regimeGuide.locales.ru.h1}
            </a>
          </div>
        )}
      </section>

      <RelatedPages topic={topic} locale="ru" />
      <CTA topicId={topic.id} locale="ru" location="bottom" />
    </div>
  );
}

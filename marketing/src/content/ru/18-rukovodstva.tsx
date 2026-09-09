import { Hero } from "@/components/marketing/Hero";
import { CTA } from "@/components/marketing/CTA";
import { getTopicById, urlFor } from "@/lib/manifest";
import type { Topic } from "@/lib/manifest";

// Тип hub, порядок блоков — TASK-0003 §6: H1 и пояснение → полезные категории
// → дочерние карточки. В отличие от хабов 02/26 (которым пришлось ждать своих
// детей по фазам), хаб 18 публикуется сразу полным: все 7 руководств
// (19,20,22,23,24,25,30) построены в этой же фазе 4.
function Card({ topic, locale }: { topic: Topic; locale: "ru" }) {
  return (
    <a
      href={urlFor(topic, locale)}
      className="block rounded border border-gray-200 p-4 hover:border-black transition-colors"
    >
      <p className="font-medium text-black">{topic.locales[locale].h1}</p>
      <p className="mt-1 text-sm text-gray-600">{topic.locales[locale].description}</p>
    </a>
  );
}

export default function Body({ topic }: { topic: Topic }) {
  const prepStatement = getTopicById("19");
  const openingBalance = getTopicById("24");
  const chooseProgram = getTopicById("25");
  const fromExcel = getTopicById("30");
  const checkAi = getTopicById("20");
  const checklist = getTopicById("21");
  const profitCash = getTopicById("22");
  const readOsv = getTopicById("23");

  return (
    <div className="space-y-12">
      <Hero
        h1={topic.locales.ru.h1}
        lead="Практические руководства для тех, кто готовит данные для учёта, проверяет результат AI-классификации и разбирается в отчётах Contador."
      />
      <p className="text-xs text-gray-500">Обновлено: 9 сентября 2026</p>

      <section aria-labelledby="h2-start">
        <h2 id="h2-start" className="text-xl font-semibold text-black">
          Начало работы
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {prepStatement && <Card topic={prepStatement} locale="ru" />}
          {openingBalance && <Card topic={openingBalance} locale="ru" />}
          {chooseProgram && <Card topic={chooseProgram} locale="ru" />}
          {fromExcel && <Card topic={fromExcel} locale="ru" />}
        </div>
      </section>

      <section aria-labelledby="h2-checks">
        <h2 id="h2-checks" className="text-xl font-semibold text-black">
          Проверки и закрытие
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {checkAi && <Card topic={checkAi} locale="ru" />}
          {checklist && <Card topic={checklist} locale="ru" />}
        </div>
      </section>

      <section aria-labelledby="h2-reports">
        <h2 id="h2-reports" className="text-xl font-semibold text-black">
          Понимание отчётов
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {profitCash && <Card topic={profitCash} locale="ru" />}
          {readOsv && <Card topic={readOsv} locale="ru" />}
        </div>
      </section>

      <CTA topicId={topic.id} locale="ru" location="bottom" />
    </div>
  );
}

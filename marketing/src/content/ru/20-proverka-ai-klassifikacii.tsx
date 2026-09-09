import { Hero } from "@/components/marketing/Hero";
import { RelatedPages } from "@/components/marketing/RelatedPages";
import { CTA } from "@/components/marketing/CTA";
import type { Topic } from "@/lib/manifest";

// Тип guide, порядок блоков — TASK-0003 §6. Evidence темы 04: v2/src/lib/constants.ts
// AI.CONFIDENCE_THRESHOLD=70, ClarificationQueue.tsx, rulesEngine.ts+aiClassifier.ts.
// Конкретное число порога не показано пользователю в UI — здесь оно тоже не
// называется, чтобы не выдумывать несуществующий индикатор уверенности.
// Три вымышленных примера (перевод между счетами / аванс / обычная оплата) —
// требование раздела "Обязательное содержание" темы 20. Никакого чат-интерфейса.
const EXAMPLES = [
  {
    case: "Перевод между своими счетами",
    suggested: "Может быть предложена операционная категория по умолчанию",
    check: "Проверить, что это действительно перевод внутри компании, а не доход/расход — при необходимости выбрать категорию вручную",
  },
  {
    case: "Аванс поставщику",
    suggested: "Категория, близкая к обычному расходу",
    check: "Уточнить, что это именно аванс, а не окончательная оплата — такие операции лучше сверять с открытыми позициями",
  },
  {
    case: "Обычная оплата за услугу по договору",
    suggested: "Категория совпадает с назначением платежа",
    check: "Обычно достаточно быстро подтвердить — назначение платежа однозначно",
  },
];

export default function Body({ topic }: { topic: Topic }) {
  return (
    <div className="space-y-12">
      <Hero
        h1={topic.locales.ru.h1}
        lead="После автоматической классификации проверяйте предложенную категорию по назначению платежа, контрагенту и сумме. Операции, в которых система не уверена, автоматически попадают в очередь уточнения и требуют ручного выбора категории."
      />

      <nav aria-label="Содержание" className="text-sm">
        <p className="font-medium text-black">Содержание</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-gray-600">
          <li><a href="#h2-what" className="underline hover:text-black">Какие данные сверять</a></li>
          <li><a href="#h2-example" className="underline hover:text-black">Разбор неоднозначного платежа</a></li>
          <li><a href="#h2-confirm" className="underline hover:text-black">Подтверждение результата</a></li>
        </ul>
      </nav>

      <section aria-labelledby="h2-what">
        <h2 id="h2-what" className="text-xl font-semibold text-black">
          Какие данные сверять
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          Сначала операции проверяются по правилам, и только то, что правила не распознали, дополнительно обрабатывает
          AI-классификатор. Предложенная AI категория остаётся черновой — интерфейс явно отделяет «Предложено AI» от
          «Подтверждено» пользователем. При проверке смотрите на назначение платежа, контрагента и сумму: совпадает ли
          предложенная категория с тем, что реально произошло.
        </p>
      </section>

      <section aria-labelledby="h2-example">
        <h2 id="h2-example" className="text-xl font-semibold text-black">
          Разбор неоднозначного платежа
        </h2>
        <p className="mt-3 text-sm text-gray-600">Три вымышленных примера операций и что стоит проверить перед подтверждением:</p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <caption className="sr-only">Примеры операций и что проверить перед подтверждением категории</caption>
            <thead>
              <tr className="border-b border-gray-300 text-xs uppercase text-gray-500">
                <th className="py-2 pr-4 font-medium">Операция</th>
                <th className="py-2 pr-4 font-medium">Что предлагает система</th>
                <th className="py-2 font-medium">Что проверить</th>
              </tr>
            </thead>
            <tbody>
              {EXAMPLES.map((e) => (
                <tr key={e.case} className="border-b border-gray-100 align-top">
                  <td className="py-2 pr-4 text-gray-700">{e.case}</td>
                  <td className="py-2 pr-4 text-gray-600">{e.suggested}</td>
                  <td className="py-2 text-gray-600">{e.check}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="h2-confirm">
        <h2 id="h2-confirm" className="text-xl font-semibold text-black">
          Подтверждение результата
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          Когда уверенность классификации ниже порога, операция автоматически попадает в очередь уточнения — там
          категория выбирается вручную. После вашего подтверждения категория считается финальной, а не предположением
          AI, и операция переходит к следующему шагу мастера закрытия месяца. Это очередь проверки, а не диалоговый
          чат-интерфейс.
        </p>
      </section>

      <RelatedPages topic={topic} locale="ru" />
      <CTA topicId={topic.id} locale="ru" location="bottom" />
    </div>
  );
}

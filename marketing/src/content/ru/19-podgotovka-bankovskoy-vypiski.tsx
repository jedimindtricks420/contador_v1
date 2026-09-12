import { Hero } from "@/components/marketing/Hero";
import { FeatureSteps } from "@/components/marketing/FeatureSteps";
import { RelatedPages } from "@/components/marketing/RelatedPages";
import { CTA } from "@/components/marketing/CTA";
import type { Topic } from "@/lib/manifest";

// Тип guide, порядок блоков — TASK-0003 §6: краткий ответ → содержание →
// пошаговая инструкция → собственный пример → ошибки → связанные функции →
// CTA. Обучающий интент, отличный от продающей темы 03 (см. §6 "03 продаёт
// импорт / 19 учит подготовить файл"). Форматы/AUTO-определение/только шаг 1
// мастера — то же evidence, что и на теме 03, без противоречий.
const STEPS = [
  { num: 1, title: "Выгрузите выписку из банк-клиента", desc: "В формате 1CClientBankExchange (.txt), до 5 МиБ и 1000 операций." },
  { num: 2, title: "Проверьте формат и период", desc: "Файл должен покрывать именно нужный период — отдельного фильтра по датам при загрузке нет." },
  { num: 3, title: "Сверьте итоговые суммы", desc: "Сравните начальный и конечный остаток из выписки банка с ожидаемыми значениями." },
  { num: 4, title: "Загрузите на шаге 1 мастера закрытия", desc: "Импорт — первый шаг мастера закрытия месяца в разделе «Закрытие»." },
];

const COLUMNS = [
  { field: "Дата операции", note: "Обязательна для попадания операции в нужный период" },
  { field: "Сумма", note: "Положительная — поступление, отрицательная — списание" },
  { field: "Назначение платежа", note: "Используется правилами и AI для предложенной категории" },
];

const MISTAKES = [
  {
    problem: "Файл сохранён не в поддерживаемом формате (например, .csv из браузера банка)",
    cause: "Банковский импорт принимает только 1CClientBankExchange (.txt)",
    fix: "Выгрузить выписку заново из банк-клиента в формате 1CClientBankExchange, не переименовывая Excel или CSV",
  },
  {
    problem: "Одна и та же выписка загружена дважды",
    cause: "Повторные строки проверяются на дубликаты; результат загрузки нужно сверить",
    fix: "Проверить протокол. Для необработанной ошибочной партии владелец или администратор может запросить откат импорта; состояние счёта и периодов должно пройти проверки",
  },
  {
    problem: "В файле операции сразу за несколько месяцев",
    cause: "На шаге импорта нет фильтра по датам — загрузится всё, что есть в файле",
    fix: "Выгрузить из банк-клиента отдельный файл ровно за нужный период до загрузки в Contador",
  },
];

export default function Body({ topic }: { topic: Topic }) {
  return (
    <div className="space-y-12">
      <Hero
        h1={topic.locales.ru.h1}
        lead="Перед загрузкой проверьте формат 1CClientBankExchange (.txt), убедитесь, что файл покрывает нужный период, и сверьте итоговые суммы с данными банка — это снижает число ошибок на первом шаге мастера закрытия месяца."
      />

      <nav aria-label="Содержание" className="text-sm">
        <p className="font-medium text-black">Содержание</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-gray-600">
          <li><a href="#h2-format" className="underline hover:text-black">Проверьте формат и период</a></li>
          <li><a href="#h2-amounts" className="underline hover:text-black">Сопоставьте суммы</a></li>
          <li><a href="#h2-errors" className="underline hover:text-black">Разберите ошибку загрузки</a></li>
        </ul>
      </nav>

      <section aria-labelledby="h2-format">
        <h2 id="h2-format" className="text-xl font-semibold text-black">
          Проверьте формат и период
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          Contador принимает 1CClientBankExchange (.txt), до 5 МиБ и 1000 операций. Нужны номер счёта,
          период и контрольные остатки. Excel для банковских выписок не принимается. Отдельного фильтра
          по датам нет: заранее выгрузите файл за нужный период.
        </p>
        <div className="mt-4">
          <FeatureSteps steps={STEPS} />
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[420px] border-collapse text-left text-sm">
            <caption className="sr-only">Какие поля важны в файле выписки</caption>
            <thead>
              <tr className="border-b border-gray-300 text-xs uppercase text-gray-500">
                <th className="py-2 pr-4 font-medium">Поле</th>
                <th className="py-2 font-medium">Зачем оно нужно</th>
              </tr>
            </thead>
            <tbody>
              {COLUMNS.map((c) => (
                <tr key={c.field} className="border-b border-gray-100">
                  <td className="py-2 pr-4 text-gray-700">{c.field}</td>
                  <td className="py-2 text-gray-600">{c.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="h2-amounts">
        <h2 id="h2-amounts" className="text-xl font-semibold text-black">
          Сопоставьте суммы
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          Собственный пример: перед загрузкой посмотрите в самой выписке (или в банк-клиенте) остаток на начало и
          конец периода. Если, например, остаток на начало — 12 000 000 сум, сумма поступлений за период —
          94 000 000, а списаний — 81 400 000, то остаток на конец должен быть 24 600 000. Если итоговая сумма в
          выписке не сходится с этим расчётом — часть операций могла не попасть в файл при выгрузке из банк-клиента,
          и стоит перевыгрузить выписку до загрузки в Contador.
        </p>
      </section>

      <section aria-labelledby="h2-errors">
        <h2 id="h2-errors" className="text-xl font-semibold text-black">
          Разберите ошибку загрузки
        </h2>
        <p className="mt-3 text-sm text-gray-600">Три частые ошибки при подготовке выписки и как их исправить:</p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <caption className="sr-only">Частые ошибки загрузки выписки и исправления</caption>
            <thead>
              <tr className="border-b border-gray-300 text-xs uppercase text-gray-500">
                <th className="py-2 pr-4 font-medium">Проблема</th>
                <th className="py-2 pr-4 font-medium">Причина</th>
                <th className="py-2 font-medium">Как исправить</th>
              </tr>
            </thead>
            <tbody>
              {MISTAKES.map((m) => (
                <tr key={m.problem} className="border-b border-gray-100 align-top">
                  <td className="py-2 pr-4 text-gray-700">{m.problem}</td>
                  <td className="py-2 pr-4 text-gray-600">{m.cause}</td>
                  <td className="py-2 text-gray-600">{m.fix}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <RelatedPages topic={topic} locale="ru" />
      <CTA topicId={topic.id} locale="ru" location="bottom" />
    </div>
  );
}

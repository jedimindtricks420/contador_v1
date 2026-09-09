import { Hero } from "@/components/marketing/Hero";
import { ProductScreenshot } from "@/components/marketing/ProductScreenshot";
import { FeatureSteps } from "@/components/marketing/FeatureSteps";
import { FAQ } from "@/components/marketing/FAQ";
import { RelatedPages } from "@/components/marketing/RelatedPages";
import { CTA } from "@/components/marketing/CTA";
import type { Topic } from "@/lib/manifest";

// Реальные форматы и AUTO-определение — evidence: v2/src/app/closing/steps/Step1Import.tsx:137,145,158.
// Импорт доступен ТОЛЬКО как шаг 1 мастера закрытия месяца — отдельного
// самостоятельного экрана импорта в кабинете нет (честно отражено в тексте
// ниже, не изображается отдельный always-available экран).
const STEPS = [
  { num: 1, title: "Откройте мастер закрытия месяца", desc: "Импорт — первый шаг мастера в разделе «Закрытие»." },
  {
    num: 2,
    title: "Загрузите файл выписки",
    desc: "Формат определяется автоматически: .txt, .xls или .xlsx.",
  },
  {
    num: 3,
    title: "Проверьте импортированные операции",
    desc: "Список загруженных строк показывается для проверки перед классификацией.",
  },
  {
    num: 4,
    title: "При ошибке — отмените импорт",
    desc: "Откат убирает операции именно этой загрузки, не затрагивая остальные данные периода.",
  },
];

const SAMPLE_ROWS = [
  { date: "05.09.2026", amount: "12 500 000", type: "Поступление", note: "Оплата по договору №14 от ООО «Демо-Клиент»" },
  { date: "07.09.2026", amount: "−3 200 000", type: "Списание", note: "Аренда офиса за сентябрь" },
  { date: "09.09.2026", amount: "−450 000", type: "Списание", note: "Комиссия банка" },
];

export default function Body({ topic }: { topic: Topic }) {
  const faq = topic.locales.ru.faq;
  return (
    <div className="space-y-12">
      <Hero
        h1={topic.locales.ru.h1}
        lead="Импорт банковской выписки — первый шаг мастера закрытия месяца в Contador. Формат файла определяется автоматически, а ошибочную загрузку можно отменить."
      />

      <section aria-labelledby="h2-formats">
        <h2 id="h2-formats" className="text-xl font-semibold text-black">
          Какие файлы поддерживаются
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          Поддерживаются форматы .txt, .xlsx и .xls. Формат определяется автоматически при загрузке — отдельно
          указывать его не нужно. Файл .txt соответствует формату 1CClientBankExchange, который выгружают многие
          банк-клиенты; .xls/.xlsx — табличная выписка Excel.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[480px] border-collapse text-left text-sm">
            <caption className="sr-only">Пример строк банковской выписки (вымышленные данные)</caption>
            <thead>
              <tr className="border-b border-gray-300 text-gray-500">
                <th scope="col" className="py-2 pr-4 font-medium">Дата</th>
                <th scope="col" className="py-2 pr-4 font-medium">Сумма, сум</th>
                <th scope="col" className="py-2 pr-4 font-medium">Тип операции</th>
                <th scope="col" className="py-2 font-medium">Назначение платежа</th>
              </tr>
            </thead>
            <tbody>
              {SAMPLE_ROWS.map((row) => (
                <tr key={row.date + row.note} className="border-b border-gray-100">
                  <td className="py-2 pr-4 text-gray-700">{row.date}</td>
                  <td className="py-2 pr-4 text-gray-700">{row.amount}</td>
                  <td className="py-2 pr-4 text-gray-700">{row.type}</td>
                  <td className="py-2 text-gray-700">{row.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-gray-500">
          Пример на вымышленных данных — не реальная выписка клиента.
        </p>
      </section>

      <ProductScreenshot alt="Шаг 1 мастера закрытия месяца: загрузка файла банковской выписки" priority />

      <section aria-labelledby="h2-upload">
        <h2 id="h2-upload" className="text-xl font-semibold text-black">
          Загрузка и проверка операций
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          Импорт выполняется на первом шаге мастера закрытия месяца — отдельного самостоятельного экрана импорта
          вне мастера в кабинете нет. После загрузки файла операции показываются списком для проверки, прежде чем
          перейти к следующему шагу мастера — уточнению категорий.
        </p>
        <div className="mt-4">
          <FeatureSteps steps={STEPS} />
        </div>
      </section>

      <section aria-labelledby="h2-reimport">
        <h2 id="h2-reimport" className="text-xl font-semibold text-black">
          Что делать с повторным импортом
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          Если файл загружен по ошибке или не тот, доступен отдельный откат импорта: он убирает операции именно
          этой загрузки, не затрагивая остальные данные периода. Contador не обещает подключение по API ко всем
          банкам или импорт произвольных Excel-файлов — только перечисленные выше поддерживаемые форматы.
        </p>
      </section>

      <FAQ items={faq} locale="ru" />
      <RelatedPages topic={topic} locale="ru" />
      <CTA topicId={topic.id} locale="ru" location="bottom" />
    </div>
  );
}

import { Hero } from "@/components/marketing/Hero";
import { FAQ } from "@/components/marketing/FAQ";
import { RelatedPages } from "@/components/marketing/RelatedPages";
import { CTA } from "@/components/marketing/CTA";
import type { Topic } from "@/lib/manifest";

// Тип feature — реальные метки формы: evidence v2/src/app/tax-dashboard/TaxDashboardClient.tsx.
// Строки основной формы 010/020/062/080 и подпись "предварительно, до
// подтверждения" — дословно из UI. НЕ заявляется прямая отправка в
// my.soliq.uz — только расчёт/подготовка данных (wave2-metadata.md §33).
const FORM_LINES = [
  { code: "010", label: "Совокупный доход" },
  { code: "020", label: "Вычитаемые расходы" },
  { code: "062", label: "Налоговая база" },
  { code: "080", label: "Налог по ставке N%", note: "предварительно, до подтверждения" },
];

const QUARTERS = [
  "I квартал",
  "II квартал (полугодие)",
  "III квартал (9 месяцев)",
  "IV квартал (год)",
];

const STATUSES = [
  { label: "Заполнено", desc: "данные внесены и посчитаны" },
  { label: "Требует проверки", desc: "нужна ручная проверка перед подачей" },
  { label: "Только годовой отчёт", desc: "приложение относится лишь к годовому отчёту" },
  { label: "Не применимо (0)", desc: "показатель не относится к текущему периоду" },
];

export default function Body({ topic }: { topic: Topic }) {
  const faq = topic.locales.ru.faq;
  return (
    <div className="space-y-12">
      <Hero
        h1={topic.locales.ru.h1}
        lead="Расчёт зеркалит форму my.soliq.uz: от совокупного дохода до суммы налога, нарастающим итогом с начала года."
      />

      <section aria-labelledby="h2-structure">
        <h2 id="h2-structure" className="text-xl font-semibold text-black">
          Из чего складывается расчёт
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          Основная форма показывает четыре ключевых показателя, рассчитанных по данным вашего учёта:
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[420px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-gray-300 text-xs uppercase text-gray-500">
                <th className="py-2 pr-4 font-medium">Код</th>
                <th className="py-2 font-medium">Показатель</th>
              </tr>
            </thead>
            <tbody>
              {FORM_LINES.map((l) => (
                <tr key={l.code} className="border-b border-gray-100">
                  <td className="py-2 pr-4 font-mono text-xs text-gray-500">{l.code}</td>
                  <td className="py-2 text-gray-700">
                    {l.label}
                    {l.note && <span className="ml-2 text-xs text-amber-700">({l.note})</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-sm text-gray-600">
          Значение «Налог по ставке N%» помечено как «предварительно, до подтверждения» — это автоматический
          расчёт по введённым данным, который стоит проверить перед использованием как окончательного.
        </p>
      </section>

      <section aria-labelledby="h2-quarters">
        <h2 id="h2-quarters" className="text-xl font-semibold text-black">
          Кварталы и отчётные периоды
        </h2>
        <p className="mt-3 text-sm text-gray-600">Доступны четыре отчётных периода, каждый — нарастающим итогом с начала года:</p>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {QUARTERS.map((q) => (
            <li key={q} className="rounded border border-gray-200 p-3 text-sm text-gray-700">
              {q}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="h2-check">
        <h2 id="h2-check" className="text-xl font-semibold text-black">
          Проверка перед подачей
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          У каждого приложения расчёта есть статус готовности:
        </p>
        <ul className="mt-4 space-y-2">
          {STATUSES.map((s) => (
            <li key={s.label} className="rounded border border-gray-200 p-3 text-sm">
              <span className="font-medium text-black">{s.label}</span>
              <span className="text-gray-600"> — {s.desc}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-sm text-gray-600">
          Contador готовит и предварительно рассчитывает данные в формате, зеркалящем форму my.soliq.uz — саму
          подачу отчёта вы всегда выполняете на портале самостоятельно, сервис её не отправляет.
        </p>
      </section>

      <FAQ items={faq} locale="ru" />
      <RelatedPages topic={topic} locale="ru" />
      <CTA topicId={topic.id} locale="ru" location="bottom" />
    </div>
  );
}

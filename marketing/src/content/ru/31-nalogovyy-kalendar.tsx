import { Hero } from "@/components/marketing/Hero";
import { FAQ } from "@/components/marketing/FAQ";
import { RelatedPages } from "@/components/marketing/RelatedPages";
import { CTA } from "@/components/marketing/CTA";
import type { Topic } from "@/lib/manifest";

// Тип feature, порядок блоков — TASK-0003 §6, наследуется TASK-0004 §5.
// Реальные типы событий и периодичность — evidence: v2/src/app/settings/tax-calendar/page.tsx
// TAX_TYPES/FREQUENCIES. Это персональные напоминания в приложении, НЕ
// официальный государственный календарь — явно проговорено в каждом блоке
// (wave2-metadata.md §31). Конкретные "число месяца" сроки намеренно не
// называются как универсально верные на все годы — только общий принцип и
// ссылка сверить актуальные даты на soliq.uz/lex.uz.
const TAX_TYPES = [
  "НДС (Налог на добавленную стоимость)",
  "Налог с оборота",
  "Налог на прибыль",
  "НДФЛ (Налог на доходы физических лиц)",
  "Социальный налог",
  "Статистическая отчётность",
];

const FREQUENCIES = [
  { label: "Ежемесячно", desc: "Для отчётов, которые сдаются каждый месяц." },
  { label: "Ежеквартально", desc: "Для отчётов и платежей с квартальной периодичностью." },
  { label: "Ежегодно", desc: "Для годовых форм отчётности." },
];

export default function Body({ topic }: { topic: Topic }) {
  const faq = topic.locales.ru.faq;
  return (
    <div className="space-y-12">
      <Hero
        h1={topic.locales.ru.h1}
        lead="Налоговый календарь Contador — это персональные напоминания внутри вашего личного кабинета, а не официальный государственный календарь Soliq или ГНК."
      />

      <section aria-labelledby="h2-taxes">
        <h2 id="h2-taxes" className="text-xl font-semibold text-black">
          Какие налоги отслеживает календарь
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          В настройках можно завести правило напоминания для каждого из следующих типов событий:
        </p>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {TAX_TYPES.map((t) => (
            <li key={t} className="rounded border border-gray-200 p-3 text-sm text-gray-700">
              {t}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="h2-frequency">
        <h2 id="h2-frequency" className="text-xl font-semibold text-black">
          Периодичность напоминаний
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          Для каждого правила отдельно указывается периодичность:
        </p>
        <ul className="mt-4 space-y-2">
          {FREQUENCIES.map((f) => (
            <li key={f.label} className="rounded border border-gray-200 p-3 text-sm">
              <span className="font-medium text-black">{f.label}</span>
              <span className="text-gray-600"> — {f.desc}</span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="h2-setup">
        <h2 id="h2-setup" className="text-xl font-semibold text-black">
          Как настроить свои сроки
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          Для каждого правила календаря вы сами указываете число месяца, на которое приходится срок, и можете
          включать или отключать правило. Сроки сдачи разных видов отчётности в Узбекистане отличаются друг от
          друга и время от времени меняются — Contador не подставляет вместо вас «правильную» дату по умолчанию.
        </p>
        <p className="mt-3 text-sm text-gray-600">
          Актуальные требования и сроки всегда сверяйте на официальных источниках — <span className="font-mono text-xs">soliq.uz</span> и{" "}
          <span className="font-mono text-xs">lex.uz</span>. Календарь в Contador — инструмент, чтобы не забыть про
          уже известную вам дату, а не источник самой даты.
        </p>
      </section>

      <FAQ items={faq} locale="ru" />
      <RelatedPages topic={topic} locale="ru" />
      <CTA topicId={topic.id} locale="ru" location="bottom" />
    </div>
  );
}

import { Hero } from "@/components/marketing/Hero";
import { FeatureSteps } from "@/components/marketing/FeatureSteps";
import { RelatedPages } from "@/components/marketing/RelatedPages";
import { CTA } from "@/components/marketing/CTA";
import type { Topic } from "@/lib/manifest";

// Тип guide, порядок блоков — TASK-0003 §6. Таблица "что переносится
// поддерживаемым способом / что требует подготовки" — обязательное
// содержание темы 30. НЕ обещает конвертацию произвольной Excel-бухгалтерии
// одним кликом — только план подготовки данных, опираясь на реальные форматы
// импорта (тема 03) и маршрут начальных остатков (тема 24).
const TRANSFER = [
  { what: "Банковские операции", how: "Импорт выписки 1CClientBankExchange (.txt) на первом шаге мастера закрытия" },
  { what: "Начальные остатки по счетам", how: "Требует подготовки — собираются вручную и вводятся в разделе настроек «Начальные остатки»" },
  { what: "Историческая структура ваших таблиц Excel", how: "Требует подготовки — Contador не читает произвольные пользовательские таблицы, только поддерживаемый формат выписки" },
  { what: "Проводки по прошлым операциям", how: "Требует подготовки — переносятся только через собранные начальные остатки на дату начала, а не документ за документом" },
];

const STEPS = [
  { num: 1, title: "Выберите дату начала учёта", desc: "Обычно начало месяца или квартала — с этой даты Contador ведёт операции подробно." },
  { num: 2, title: "Соберите начальные остатки", desc: "По счетам, контрагентам и авансам на выбранную дату — см. руководство по начальным остаткам." },
  { num: 3, title: "Подготовьте банковские выписки", desc: "В формате 1CClientBankExchange (.txt) за периоды после даты начала." },
  { num: 4, title: "Загрузите и сверьте первый период", desc: "Импортируйте выписку, введите остатки и сравните первый отчёт с вашими таблицами." },
];

export default function Body({ topic }: { topic: Topic }) {
  return (
    <div className="space-y-12">
      <Hero
        h1={topic.locales.ru.h1}
        lead="Переход из таблиц в Contador — это не автоматическая конвертация вашей Excel-бухгалтерии одним кликом. Часть данных переносится поддерживаемым способом, а часть нужно подготовить вручную до начала работы."
      />

      <nav aria-label="Содержание" className="text-sm">
        <p className="font-medium text-black">Содержание</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-gray-600">
          <li><a href="#h2-scope" className="underline hover:text-black">Определите границы переноса</a></li>
          <li><a href="#h2-prepare" className="underline hover:text-black">Подготовьте остатки и выписки</a></li>
          <li><a href="#h2-verify" className="underline hover:text-black">Сверьте первый период</a></li>
        </ul>
      </nav>

      <section aria-labelledby="h2-scope">
        <h2 id="h2-scope" className="text-xl font-semibold text-black">
          Определите границы переноса
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          Прежде чем начинать, важно понимать, что переносится автоматически, а что нужно подготовить самим:
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[600px] border-collapse text-left text-sm">
            <caption className="sr-only">Что переносится поддерживаемым способом, а что требует подготовки</caption>
            <thead>
              <tr className="border-b border-gray-300 text-xs uppercase text-gray-500">
                <th className="py-2 pr-4 font-medium">Что</th>
                <th className="py-2 font-medium">Как переносится</th>
              </tr>
            </thead>
            <tbody>
              {TRANSFER.map((row) => (
                <tr key={row.what} className="border-b border-gray-100 align-top">
                  <td className="py-2 pr-4 text-gray-700">{row.what}</td>
                  <td className="py-2 text-gray-600">{row.how}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="h2-prepare">
        <h2 id="h2-prepare" className="text-xl font-semibold text-black">
          Подготовьте остатки и выписки
        </h2>
        <div className="mt-4">
          <FeatureSteps steps={STEPS} />
        </div>
      </section>

      <section aria-labelledby="h2-verify">
        <h2 id="h2-verify" className="text-xl font-semibold text-black">
          Сверьте первый период
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          После загрузки первой выписки и ввода начальных остатков сравните оборотно-сальдовую ведомость или баланс
          за первый период с вашими прежними таблицами. Если суммы не сходятся — чаще всего причина в неполных
          начальных остатках или в выписке, не покрывающей нужный период, а не в самом переходе.
        </p>
      </section>

      <RelatedPages topic={topic} locale="ru" />
      <CTA topicId={topic.id} locale="ru" location="bottom" />
    </div>
  );
}

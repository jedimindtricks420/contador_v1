import { Hero } from "@/components/marketing/Hero";
import { ProductScreenshot } from "@/components/marketing/ProductScreenshot";
import { RelatedPages } from "@/components/marketing/RelatedPages";
import { CTA } from "@/components/marketing/CTA";
import type { Topic } from "@/lib/manifest";

// Тип guide, порядок блоков — TASK-0003 §6. Реальный маршрут страницы —
// v2/src/app/settings/opening-balance (phase-1 evidence). Явно НЕ обещается
// автоматический перенос всей базы 1С — только разовый ручной ввод остатков.
const CHECKLIST = [
  "Денежные средства: остатки на банковских счетах и в кассе на дату начала учёта",
  "Расчёты с покупателями и поставщиками: суммы по каждому контрагенту, не закрытые на дату начала",
  "Авансы и подотчётные суммы: незакрытые выданные и полученные авансы",
  "Уставный капитал и прочие статьи собственного капитала на дату начала",
];

export default function Body({ topic }: { topic: Topic }) {
  return (
    <div className="space-y-12">
      <Hero
        h1={topic.locales.ru.h1}
        lead="Перед началом учёта в Contador задайте дату начала, соберите остатки по нужным счетам на эту дату и введите их в разделе настроек «Начальные остатки». Это разовый ручной ввод исходных данных, а не автоматический перенос базы 1С."
      />

      <nav aria-label="Содержание" className="text-sm">
        <p className="font-medium text-black">Содержание</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-gray-600">
          <li><a href="#h2-date" className="underline hover:text-black">Выберите дату начала</a></li>
          <li><a href="#h2-collect" className="underline hover:text-black">Соберите данные по счетам</a></li>
          <li><a href="#h2-check" className="underline hover:text-black">Проверьте введённые остатки</a></li>
        </ul>
      </nav>

      <section aria-labelledby="h2-date">
        <h2 id="h2-date" className="text-xl font-semibold text-black">
          Выберите дату начала
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          Начальные остатки вводятся в разделе настроек кабинета «Начальные остатки». Дата начала — это момент, с
          которого Contador начинает вести учёт по операциям; всё, что было раньше, отражается только суммарно через
          введённые остатки, а не отдельными операциями.
        </p>
      </section>

      <ProductScreenshot alt="Раздел настроек «Начальные остатки»: список счетов с полями для ввода сумм на дату начала учёта" />

      <section aria-labelledby="h2-collect">
        <h2 id="h2-collect" className="text-xl font-semibold text-black">
          Соберите данные по счетам
        </h2>
        <p className="mt-3 text-sm text-gray-600">Перед вводом остатков подготовьте суммы по каждому пункту:</p>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-gray-600">
          {CHECKLIST.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p className="mt-3 text-sm text-gray-600">
          Contador не переносит базу 1С или другую программу автоматически — эти суммы нужно собрать и ввести
          вручную, по каждому счёту отдельно.
        </p>
      </section>

      <section aria-labelledby="h2-check">
        <h2 id="h2-check" className="text-xl font-semibold text-black">
          Проверьте введённые остатки
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          После ввода остатков сверьте их с оборотно-сальдовой ведомостью и балансом на дату начала учёта: итоговые
          суммы по счетам должны совпасть с тем, что вы собрали на предыдущем шаге. Без введённых начальных остатков
          баланс и ОСВ будут отражать только операции, добавленные после начала учёта в Contador.
        </p>
      </section>

      <RelatedPages topic={topic} locale="ru" />
      <CTA topicId={topic.id} locale="ru" location="bottom" />
    </div>
  );
}
